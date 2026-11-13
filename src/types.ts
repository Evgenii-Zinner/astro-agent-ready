/**
 * Represents a single core page link pinned in llms.txt.
 */
export interface CorePage {
  /** Title of the page displayed in the link */
  title: string;
  /** Relative path (e.g. "/about") or absolute URL */
  path: string;
  /** Short description explaining what this page covers for the LLM */
  description?: string;
}

/**
 * Standardized metadata and body for an extracted content document.
 */
export interface ContentDocument {
  /** Relative URL path (e.g. "/articles/my-post") */
  slug: string;
  /** Full absolute URL if siteUrl is available */
  url: string;
  /** Document title */
  title: string;
  /** Short summary or excerpt */
  description?: string;
  /** ISO date string or human-readable date */
  date?: string;
  /** Category or tag label */
  tag?: string;
  /** Raw markdown content body (frontmatter stripped) */
  body?: string;
  /** Additional custom frontmatter or metadata properties */
  metadata?: Record<string, unknown>;
}

/**
 * Minimal source descriptor required by the llms.txt formatter.
 */
export interface LlmsSectionSource {
  /** Identifier name for this source (e.g. "articles", "blog", "docs") */
  name: string;
  /** Heading displayed above this section in llms.txt */
  heading: string;
}

/**
 * Configuration for a content source (Content Collection or pages directory).
 */
export interface SourceConfig extends LlmsSectionSource {
  /** Directory path relative to project root (e.g. "src/content/blog" or "src/pages/articles") */
  dir: string;
  /** File extensions or glob pattern to scan (default: [".md", ".mdx", ".astro"]) */
  extensions?: string[];
  /** URL prefix prepended to file slugs (e.g. "/articles") */
  urlPrefix?: string;
  /** Frontmatter/export property name for title (default: "title") */
  titleField?: string;
  /** Frontmatter/export property name for description (default: "description", falls back to "preview") */
  descriptionField?: string;
  /** Frontmatter/export property name for date (default: "date") */
  dateField?: string;
  /** Frontmatter/export property name for tags/category (default: "tag", falls back to "tags") */
  tagField?: string;
  /** Frontmatter/export property name for draft flag (default: "draft") */
  draftField?: string;
  /** Whether to automatically exclude draft documents (default: true) */
  excludeDrafts?: boolean;
  /** Optional filter function to include/exclude specific documents */
  filter?: (doc: ContentDocument) => boolean;
  /** Sorting order for documents in this section (default: "date-desc") */
  sortBy?: 'date-desc' | 'date-asc' | 'title' | 'none';
}

/**
 * Dynamic runtime content source for SSR mode (e.g., querying a CMS or database per request).
 */
export interface DynamicSourceConfig extends LlmsSectionSource {
  /** Async or sync loader returning ContentDocument entries for the current request */
  load: (siteUrl: string) => Promise<ContentDocument[]> | ContentDocument[];
}

/**
 * Full dynamic context returned by `resolveContext` in SSR mode.
 * Allows a CMS or database to hydrate the entire `/llms.txt` and `/llms-full.txt` dynamically.
 */
export interface ResolvedAgentContext {
  /** Site title rendered as top-level H1 (overrides static `title` if provided) */
  title?: string;
  /** Site description rendered as blockquote summary (overrides static `description` if provided) */
  description?: string;
  /** Optional introductory text below the blockquote */
  intro?: string;
  /** Core site pages pinned at the top of llms.txt */
  corePages?: CorePage[];
  /** Contact links rendered in the Direct Contact footer */
  contact?: ContactConfig | string[];
  /** Optional custom markdown footer */
  customFooter?: string;
  /** Dynamic content sections and their documents */
  sources?: Array<{
    name?: string;
    heading: string;
    docs: ContentDocument[];
  }>;
}

/**
 * Async or sync context resolver for hydrating all llms.txt metadata and sources in SSR.
 */
export type AgentReadyContextResolver = (
  siteUrl: string,
  request?: Request,
) => Promise<ResolvedAgentContext> | ResolvedAgentContext;

/**
 * Request metadata passed to `resolveMarkdown`.
 */
export interface MarkdownResolveContext {
  siteUrl: string;
  request: Request;
  locals: Record<string, unknown>;
}

/**
 * Per-page Markdown resolver for `.md` suffix routes and `Accept: text/markdown` negotiation.
 * Return `null` or `undefined` to fall through to normal Astro routing.
 */
export type AgentReadyMarkdownResolver = (
  pathname: string,
  context: MarkdownResolveContext,
) => Promise<string | null | undefined> | string | null | undefined;

/**
 * Guardrail configuration for on-demand `/llms-full.txt` generation in SSR mode.
 */
export interface SsrFullTxtOptions {
  /** Whether `/llms-full.txt` route is enabled in SSR mode (default: false) */
  enabled?: boolean;
  /** Maximum number of documents to include across all sources (default: 20) */
  maxDocs?: number;
  /** Maximum estimated token budget before truncating remaining documents (default: 100000) */
  maxTokens?: number;
}

/**
 * Configuration for SSR mode (`output: "server"`).
 */
export interface SsrAgentReadyOptions {
  /**
   * Whether SSR routes and middleware are enabled when Astro runs in `output: "server"`.
   * Set to `false` if you manage routes manually via `createLlmsTxtRoute()`.
   * @default true
   */
  enabled?: boolean;

  /**
   * Path (relative to project root, e.g. "./src/lib/llms.ts") to a module exporting
   * `resolveContext`, `dynamicSources`, and/or `resolveMarkdown` for SSR requests.
   */
  sourcesModule?: string;

  /**
   * Cache-Control header value for SSR `/llms.txt`, `/llms-full.txt`, and `.md` responses.
   * @default "public, max-age=300, s-maxage=3600"
   */
  cacheControl?: string;

  /**
   * Optional CDN-Cache-Control header value for edge caches (e.g. Cloudflare).
   */
  cdnCacheControl?: string;

  /**
   * Content-Type header value for the SSR `/llms.txt` response.
   * @default "text/plain; charset=utf-8"
   */
  contentType?: string;

  /**
   * Compute strong ETag hashes and respond with `304 Not Modified` on `If-None-Match` hits.
   * @default true
   */
  etag?: boolean;

  /**
   * Enable `.md` suffix routing (e.g. `/articles/post.md`) and `Accept: text/markdown`
   * content negotiation in middleware when `resolveMarkdown` is configured.
   * @default true
   */
  markdownNegotiation?: boolean;

  /**
   * Attach `Link: </llms.txt>; rel="alternate"; type="text/markdown"` header on HTML responses.
   * @default true
   */
  discoveryHeader?: boolean;

  /**
   * Enable bounded on-demand `/llms-full.txt` in SSR with `maxDocs` / `maxTokens` guardrails.
   * @default false
   */
  full?: boolean | SsrFullTxtOptions;
}

/**
 * Contact or author link configuration.
 */
export interface ContactConfig {
  email?: string;
  github?: string;
  linkedin?: string;
  x?: string;
  twitter?: string;
  [key: string]: string | undefined;
}

/**
 * Main configuration options for astro-agent-ready integration.
 */
export interface AgentReadyOptions {
  /** Base website URL (e.g. "https://www.example.com"). Falls back to `site` in astro.config if omitted */
  siteUrl?: string;
  /** Site title rendered as top-level H1 in llms.txt (optional in SSR when using `resolveContext`) */
  title?: string;
  /** Site description rendered as blockquote summary (optional in SSR when using `resolveContext`) */
  description?: string;
  /** Optional introductory text or notes below the blockquote */
  intro?: string;
  /** Core site pages pinned at the top of llms.txt (e.g. About, CV, Pricing) */
  corePages?: CorePage[];
  /** Content sources (directories or collections) to scan and include in static SSG builds */
  sources?: SourceConfig[];
  /** Dynamic runtime content sources for SSR (`createLlmsTxtRoute`) */
  dynamicSources?: DynamicSourceConfig[];
  /** Dynamic full-context resolver for SSR (`createLlmsTxtRoute`) */
  resolveContext?: AgentReadyContextResolver;
  /** Per-page Markdown resolver for `.md` routes and `Accept: text/markdown` negotiation */
  resolveMarkdown?: AgentReadyMarkdownResolver;
  /** SSR mode configuration (`output: "server"`). Set `false` to disable automatic route/middleware injection */
  ssr?: boolean | SsrAgentReadyOptions;
  /** Whether to generate /llms-full.txt with full concatenated article bodies in SSG (default: false) */
  generateFull?: boolean;
  /** Filename for the index file (default: "llms.txt") */
  outputFileName?: string;
  /** Filename for the concatenated full content file (default: "llms-full.txt") */
  fullFileName?: string;
  /** List of source names to include in llms-full.txt (default: all sources) */
  includeInFull?: string[];
  /** Contact information rendered in the Direct Contact footer */
  contact?: ContactConfig | string[];
  /** Optional custom markdown text appended to the bottom of llms.txt */
  customFooter?: string;
  /** Whether to log generated file stats and estimated tokens in build output (default: true) */
  logStats?: boolean;
}
