import {
  buildCachedResponse,
  DEFAULT_CACHE_CONTROL,
  resolveRequestSiteUrl,
  resolveSsrSettings,
} from './ssr.js';
import type {
  AgentReadyMarkdownResolver,
  AgentReadyOptions,
  SsrAgentReadyOptions,
} from './types.js';

const MARKDOWN_CONTENT_TYPE = 'text/markdown; charset=utf-8';

export interface MiddlewareContext {
  url: URL;
  request: Request;
  site?: URL;
  locals: Record<string, unknown>;
}

export type MiddlewareNext = () => Promise<Response>;

export type AgentReadyMiddlewareHandler = (
  context: MiddlewareContext,
  next: MiddlewareNext,
) => Promise<Response>;

/**
 * Strips `.md` suffix to normalize the target page pathname for `resolveMarkdown`.
 */
function stripMarkdownExtension(pathname: string): string {
  const withoutExt = pathname.slice(0, -3);
  if (withoutExt === '' || withoutExt === '/index') {
    return '/';
  }
  return withoutExt;
}

/**
 * Checks whether the request explicitly asks for `text/markdown` via `Accept` header.
 */
function acceptsMarkdown(request: Request): boolean {
  const accept = request.headers.get('accept');
  if (!accept) return false;
  return accept.toLowerCase().includes('text/markdown');
}

/**
 * Appends `Accept` to the `Vary` header without duplicating existing directives.
 */
function appendVaryAccept(headers: Headers): void {
  const existing = headers.get('Vary');
  if (!existing) {
    headers.set('Vary', 'Accept');
    return;
  }
  const values = existing.split(',').map((v) => v.trim().toLowerCase());
  if (!values.includes('accept') && !values.includes('*')) {
    headers.set('Vary', `${existing}, Accept`);
  }
}

/**
 * Appends `<llmsPath>; rel="alternate"; type="text/markdown"` to the `Link` header.
 */
function appendDiscoveryLink(headers: Headers, llmsPath: string): void {
  const linkEntry = `<${llmsPath}>; rel="alternate"; type="text/markdown"`;
  const existing = headers.get('Link');
  if (!existing) {
    headers.set('Link', linkEntry);
    return;
  }
  if (!existing.includes(linkEntry)) {
    headers.set('Link', `${existing}, ${linkEntry}`);
  }
}

/**
 * Creates an Astro SSR middleware handler providing:
 * 1. Per-page `.md` suffix routing (e.g. `/articles/post.md`)
 * 2. `Accept: text/markdown` content negotiation with `Vary: Accept`
 * 3. `ETag` / `304 Not Modified` and cache headers for Markdown responses
 * 4. `Link: </llms.txt>; rel="alternate"; type="text/markdown"` discovery header on HTML responses
 *
 * @param options - AgentReady configuration including `resolveMarkdown` and `ssr` options.
 */
export function createAgentReadyMiddleware(
  options: AgentReadyOptions = {},
): AgentReadyMiddlewareHandler {
  const ssrSettings = resolveSsrSettings(options.ssr);
  const cacheControl = ssrSettings.cacheControl ?? DEFAULT_CACHE_CONTROL;
  const enableEtag = ssrSettings.etag ?? true;
  const markdownNegotiation = ssrSettings.markdownNegotiation ?? true;
  const discoveryHeader = ssrSettings.discoveryHeader ?? true;
  const outputFileName = (options.outputFileName || 'llms.txt').replace(/^\/+/, '');
  const fullFileName = (options.fullFileName || 'llms-full.txt').replace(/^\/+/, '');
  const llmsPath = `/${outputFileName}`;
  const llmsFullPath = `/${fullFileName}`;
  const resolveMarkdown = options.resolveMarkdown;

  return async (context, next) => {
    const pathname = context.url.pathname;
    const isReservedRoute =
      pathname === llmsPath || pathname === llmsFullPath || pathname.startsWith('/_astro/');

    if (resolveMarkdown && markdownNegotiation && !isReservedRoute) {
      const isMdSuffix = pathname.endsWith('.md') && pathname.length > 3;
      const isAcceptMd = !isMdSuffix && acceptsMarkdown(context.request);

      if (isMdSuffix || isAcceptMd) {
        const targetPath = isMdSuffix ? stripMarkdownExtension(pathname) : pathname;
        const siteUrl = resolveRequestSiteUrl(options.siteUrl, context.site, context.url);
        const markdown = await resolveMarkdown(targetPath, {
          siteUrl,
          request: context.request,
          locals: context.locals,
        });

        if (typeof markdown === 'string') {
          return buildCachedResponse(context.request, markdown, {
            contentType: MARKDOWN_CONTENT_TYPE,
            cacheControl,
            cdnCacheControl: ssrSettings.cdnCacheControl,
            vary: 'Accept',
            enableEtag,
          });
        }
      }
    }

    const response = await next();
    const contentType = response.headers.get('content-type') || '';

    if (contentType.includes('text/html')) {
      if (discoveryHeader) {
        appendDiscoveryLink(response.headers, llmsPath);
      }
      if (resolveMarkdown && markdownNegotiation) {
        appendVaryAccept(response.headers);
      }
    }

    return response;
  };
}

interface VirtualConfigModule {
  agentReadyOptions?: AgentReadyOptions;
  ssrOptions?: SsrAgentReadyOptions;
  resolveMarkdown?: AgentReadyMarkdownResolver;
}

let cachedMiddleware: AgentReadyMiddlewareHandler | null = null;

/**
 * Standard Astro middleware entrypoint registered via `addMiddleware()`.
 */
export const onRequest: AgentReadyMiddlewareHandler = async (context, next) => {
  if (!cachedMiddleware) {
    let config: VirtualConfigModule = {};
    try {
      config = await import('virtual:astro-agent-ready/config');
    } catch {
      // Virtual module not available
    }

    const baseOptions: AgentReadyOptions = config.agentReadyOptions ?? {};

    cachedMiddleware = createAgentReadyMiddleware({
      ...baseOptions,
      ssr: config.ssrOptions ?? baseOptions.ssr,
      resolveMarkdown: config.resolveMarkdown ?? baseOptions.resolveMarkdown,
    });
  }

  return cachedMiddleware(context, next);
};
