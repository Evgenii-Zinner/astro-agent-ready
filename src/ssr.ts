import type { APIRoute } from 'astro';
import { generateLlmsFullTxt, generateLlmsTxt, resolveUrl } from './formatter.js';
import { estimateTokenCount } from './tokens.js';
import type {
  AgentReadyContextResolver,
  AgentReadyMarkdownResolver,
  AgentReadyOptions,
  ContentDocument,
  DynamicSourceConfig,
  LlmsSectionSource,
  SsrAgentReadyOptions,
  SsrFullTxtOptions,
} from './types.js';

export const DEFAULT_CACHE_CONTROL = 'public, max-age=300, s-maxage=3600';
export const DEFAULT_CONTENT_TYPE = 'text/plain; charset=utf-8';
export const DEFAULT_MAX_DOCS = 20;
export const DEFAULT_MAX_TOKENS = 100_000;

/**
 * Shape of the build-time Vite virtual module `virtual:astro-agent-ready/config`.
 */
export interface VirtualConfigModule {
  agentReadyOptions?: AgentReadyOptions;
  ssrOptions?: SsrAgentReadyOptions;
  dynamicSources?: DynamicSourceConfig[];
  resolveContext?: AgentReadyContextResolver;
  resolveMarkdown?: AgentReadyMarkdownResolver;
}

/**
 * Lazily imports `virtual:astro-agent-ready/config` and merges it into `AgentReadyOptions`.
 * Falls back to empty defaults when invoked outside a Vite/Astro build.
 *
 * @returns Merged `AgentReadyOptions` resolved from the virtual module.
 */
export async function loadVirtualAgentReadyOptions(): Promise<AgentReadyOptions> {
  let config: VirtualConfigModule = {};
  try {
    config = await import('virtual:astro-agent-ready/config');
  } catch {
    // Virtual module not available outside Astro/Vite runtime
  }

  const baseOptions: AgentReadyOptions = config.agentReadyOptions ?? {};
  return {
    ...baseOptions,
    ssr: config.ssrOptions ?? baseOptions.ssr,
    dynamicSources: config.dynamicSources ?? baseOptions.dynamicSources,
    resolveContext: config.resolveContext ?? baseOptions.resolveContext,
    resolveMarkdown: config.resolveMarkdown ?? baseOptions.resolveMarkdown,
  };
}

/**
 * Creates a lazily initialized `APIRoute` backed by `virtual:astro-agent-ready/config`.
 *
 * @param createHandler - Route handler factory (`createLlmsTxtRoute` or `createLlmsFullTxtRoute`).
 * @returns Memoized Astro `APIRoute` handler.
 */
export function createVirtualLlmsRoute(
  createHandler: (options: AgentReadyOptions) => APIRoute,
): APIRoute {
  let cachedHandler: APIRoute | null = null;

  return async (context) => {
    if (!cachedHandler) {
      const mergedOptions = await loadVirtualAgentReadyOptions();
      cachedHandler = createHandler(mergedOptions);
    }
    return cachedHandler(context);
  };
}

/**
 * Resolves SSR-specific configuration from `AgentReadyOptions.ssr`.
 */
export function resolveSsrSettings(ssr: AgentReadyOptions['ssr']): SsrAgentReadyOptions {
  if (typeof ssr === 'object' && ssr !== null) {
    return ssr;
  }
  return {};
}

/**
 * Resolves `/llms-full.txt` guardrail settings for SSR mode.
 */
export function resolveSsrFullSettings(
  full: SsrAgentReadyOptions['full'],
): Required<SsrFullTxtOptions> {
  if (full === true) {
    return { enabled: true, maxDocs: DEFAULT_MAX_DOCS, maxTokens: DEFAULT_MAX_TOKENS };
  }
  if (typeof full === 'object' && full !== null) {
    return {
      enabled: full.enabled ?? true,
      maxDocs: full.maxDocs ?? DEFAULT_MAX_DOCS,
      maxTokens: full.maxTokens ?? DEFAULT_MAX_TOKENS,
    };
  }
  return { enabled: false, maxDocs: DEFAULT_MAX_DOCS, maxTokens: DEFAULT_MAX_TOKENS };
}

/**
 * Computes a deterministic strong ETag using dual 32-bit FNV-1a hashes (edge-safe, synchronous, zero deps).
 */
export function computeEtag(content: string): string {
  let h1 = 0x811c9dc5;
  let h2 = 0x9e3779b9;
  for (let i = 0; i < content.length; i++) {
    const c = content.charCodeAt(i);
    h1 ^= c;
    h1 = Math.imul(h1, 0x01000193);
    h2 ^= c + i;
    h2 = Math.imul(h2, 0x85ebca6b);
  }
  return `"${(h1 >>> 0).toString(16).padStart(8, '0')}${(h2 >>> 0).toString(16).padStart(8, '0')}"`;
}

/**
 * Checks whether an `If-None-Match` header matches the computed ETag.
 */
function etagMatches(ifNoneMatch: string | null, etag: string): boolean {
  if (!ifNoneMatch) return false;
  if (ifNoneMatch.trim() === '*') return true;
  return ifNoneMatch
    .split(',')
    .map((part) => part.trim())
    .some((candidate) => candidate === etag || candidate === `W/${etag}`);
}

export interface CachedResponseOptions {
  contentType: string;
  cacheControl: string;
  cdnCacheControl?: string;
  vary?: string;
  enableEtag: boolean;
}

/**
 * Constructs an HTTP `Response` with `Cache-Control`, optional `CDN-Cache-Control`,
 * `Vary`, and `ETag` / `304 Not Modified` conditional handling.
 */
export function buildCachedResponse(
  request: Request | undefined,
  body: string,
  options: CachedResponseOptions,
): Response {
  const headers = new Headers();
  headers.set('Content-Type', options.contentType);
  headers.set('Cache-Control', options.cacheControl);

  if (options.cdnCacheControl) {
    headers.set('CDN-Cache-Control', options.cdnCacheControl);
  }
  if (options.vary) {
    headers.set('Vary', options.vary);
  }

  if (options.enableEtag) {
    const etag = computeEtag(body);
    headers.set('ETag', etag);

    if (etagMatches(request?.headers.get('if-none-match') ?? null, etag)) {
      return new Response(null, { status: 304, headers });
    }
  }

  return new Response(body, { status: 200, headers });
}

/**
 * Normalizes `doc.url` to an absolute URL when a relative path or slug is provided.
 */
function normalizeDocumentUrls(docs: ContentDocument[], siteUrl: string): ContentDocument[] {
  return docs.map((doc) => ({
    ...doc,
    url: resolveUrl(doc.url || doc.slug, siteUrl),
  }));
}

/**
 * Trims all trailing `/` characters in linear O(N) time without polynomial regexes.
 */
export function trimTrailingSlashes(value: string): string {
  let end = value.length;
  while (end > 0 && value.charCodeAt(end - 1) === 47) {
    end--;
  }
  return end < value.length ? value.slice(0, end) : value;
}

/**
 * Trims all leading `/` characters in linear O(N) time without polynomial regexes.
 */
export function trimLeadingSlashes(value: string): string {
  let start = 0;
  while (start < value.length && value.charCodeAt(start) === 47) {
    start++;
  }
  return start > 0 ? value.slice(start) : value;
}

/**
 * Resolves `siteUrl` from explicit options, Astro `context.site`, or `context.url.origin`.
 */
export function resolveRequestSiteUrl(
  explicitSiteUrl: string | undefined,
  site: URL | undefined,
  url: URL | undefined,
): string {
  const contextSite = site ? trimTrailingSlashes(site.toString()) : '';
  const requestOrigin = url?.origin || '';
  return trimTrailingSlashes(explicitSiteUrl || contextSite || requestOrigin);
}

/**
 * Hydrates full `AgentReadyOptions` and `sourceResults` for an SSR request
 * by running `resolveContext` (if configured) and `dynamicSources`.
 */
async function resolveSsrData(
  options: AgentReadyOptions,
  siteUrl: string,
  request: Request | undefined,
): Promise<{
  resolvedOptions: AgentReadyOptions;
  sourceResults: Map<LlmsSectionSource, ContentDocument[]>;
}> {
  const dynamicContext = options.resolveContext
    ? await options.resolveContext(siteUrl, request)
    : undefined;

  const resolvedOptions: AgentReadyOptions = {
    ...options,
    siteUrl,
    title: dynamicContext?.title ?? options.title,
    description: dynamicContext?.description ?? options.description,
    intro: dynamicContext?.intro ?? options.intro,
    corePages: dynamicContext?.corePages ?? options.corePages,
    contact: dynamicContext?.contact ?? options.contact,
    customFooter: dynamicContext?.customFooter ?? options.customFooter,
  };

  const sourceResults = new Map<LlmsSectionSource, ContentDocument[]>();

  if (dynamicContext?.sources) {
    for (const section of dynamicContext.sources) {
      const sourceKey: LlmsSectionSource = {
        name: section.name || section.heading.toLowerCase().replace(/\s+/g, '-'),
        heading: section.heading,
      };
      sourceResults.set(sourceKey, normalizeDocumentUrls(section.docs, siteUrl));
    }
  }

  const dynamicSources = options.dynamicSources ?? [];
  if (dynamicSources.length > 0) {
    const loaded = await Promise.all(
      dynamicSources.map(async (source) => {
        const docs = await source.load(siteUrl);
        return [source, normalizeDocumentUrls(docs, siteUrl)] as const;
      }),
    );

    for (const [source, docs] of loaded) {
      sourceResults.set(source, docs);
    }
  }

  return { resolvedOptions, sourceResults };
}

/**
 * Applies `maxDocs` and `maxTokens` guardrails to SSR sources for `/llms-full.txt`.
 */
function applyFullTxtGuardrails(
  sourceResults: Map<LlmsSectionSource, ContentDocument[]>,
  maxDocs: number,
  maxTokens: number,
): Map<LlmsSectionSource, ContentDocument[]> {
  const bounded = new Map<LlmsSectionSource, ContentDocument[]>();
  let docCount = 0;
  let tokenCount = 0;

  for (const [source, docs] of sourceResults.entries()) {
    if (docCount >= maxDocs || tokenCount >= maxTokens) break;

    const kept: ContentDocument[] = [];
    for (const doc of docs) {
      if (docCount >= maxDocs) break;
      const docTokens = estimateTokenCount(
        `${doc.title}\n${doc.description ?? ''}\n${doc.body ?? ''}`,
      );
      if (docCount > 0 && tokenCount + docTokens > maxTokens) {
        tokenCount = maxTokens;
        break;
      }
      kept.push(doc);
      docCount++;
      tokenCount += docTokens;
    }

    if (kept.length > 0) {
      bounded.set(source, kept);
    }
  }

  return bounded;
}

/**
 * Creates an Astro SSR `APIRoute` (`GET`) handler that dynamically generates `/llms.txt`.
 * Supports `resolveContext`, `dynamicSources`, ETag/304 conditional responses, and edge cache headers.
 *
 * @param options - AgentReady configuration including optional `resolveContext` / `dynamicSources`.
 * @returns Astro `APIRoute` handler.
 */
export function createLlmsTxtRoute(options: AgentReadyOptions): APIRoute {
  const ssrSettings = resolveSsrSettings(options.ssr);
  const cacheControl = ssrSettings.cacheControl ?? DEFAULT_CACHE_CONTROL;
  const contentType = ssrSettings.contentType ?? DEFAULT_CONTENT_TYPE;
  const enableEtag = ssrSettings.etag ?? true;

  return async (context) => {
    const siteUrl = resolveRequestSiteUrl(options.siteUrl, context.site, context.url);
    const { resolvedOptions, sourceResults } = await resolveSsrData(
      options,
      siteUrl,
      context.request,
    );

    const body = generateLlmsTxt(resolvedOptions, sourceResults);

    return buildCachedResponse(context.request, body, {
      contentType,
      cacheControl,
      cdnCacheControl: ssrSettings.cdnCacheControl,
      enableEtag,
    });
  };
}

/**
 * Creates an Astro SSR `APIRoute` (`GET`) handler for bounded `/llms-full.txt` generation.
 * Enforces `maxDocs` and `maxTokens` guardrails so edge runtimes never OOM on large sites.
 *
 * @param options - AgentReady configuration with `ssr.full` guardrails.
 * @returns Astro `APIRoute` handler.
 */
export function createLlmsFullTxtRoute(options: AgentReadyOptions): APIRoute {
  const ssrSettings = resolveSsrSettings(options.ssr);
  const fullSettings = resolveSsrFullSettings(ssrSettings.full);
  const cacheControl = ssrSettings.cacheControl ?? DEFAULT_CACHE_CONTROL;
  const contentType = ssrSettings.contentType ?? DEFAULT_CONTENT_TYPE;
  const enableEtag = ssrSettings.etag ?? true;

  return async (context) => {
    const siteUrl = resolveRequestSiteUrl(options.siteUrl, context.site, context.url);
    const { resolvedOptions, sourceResults } = await resolveSsrData(
      options,
      siteUrl,
      context.request,
    );

    const boundedSources = applyFullTxtGuardrails(
      sourceResults,
      fullSettings.maxDocs,
      fullSettings.maxTokens,
    );
    const body = generateLlmsFullTxt(resolvedOptions, boundedSources);

    return buildCachedResponse(context.request, body, {
      contentType,
      cacheControl,
      cdnCacheControl: ssrSettings.cdnCacheControl,
      enableEtag,
    });
  };
}
