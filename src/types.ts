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
 * Configuration for a content source (Content Collection or pages directory).
 */
export interface SourceConfig {
  /** Identifier name for this source (e.g. "articles", "blog", "docs") */
  name: string;
  /** Heading displayed above this section in llms.txt */
  heading: string;
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
  /** Site title rendered as top-level H1 in llms.txt */
  title: string;
  /** Site description rendered as blockquote summary */
  description: string;
  /** Optional introductory text or notes below the blockquote */
  intro?: string;
  /** Core site pages pinned at the top of llms.txt (e.g. About, CV, Pricing) */
  corePages?: CorePage[];
  /** Content sources (directories or collections) to scan and include */
  sources?: SourceConfig[];
  /** Whether to generate /llms-full.txt with full concatenated article bodies (default: false) */
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
