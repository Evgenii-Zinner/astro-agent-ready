# astro-agent-ready

[![CI](https://github.com/Evgenii-Zinner/astro-agent-ready/actions/workflows/ci.yml/badge.svg)](https://github.com/Evgenii-Zinner/astro-agent-ready/actions/workflows/ci.yml)
[![codecov](https://codecov.io/gh/Evgenii-Zinner/astro-agent-ready/graph/badge.svg)](https://codecov.io/gh/Evgenii-Zinner/astro-agent-ready)
[![npm version](https://img.shields.io/npm/v/astro-agent-ready.svg?color=cb3837)](https://www.npmjs.com/package/astro-agent-ready)
[![dependencies](https://img.shields.io/badge/dependencies-0-success.svg)](https://www.npmjs.com/package/astro-agent-ready)
[![code style: biome](https://img.shields.io/badge/code_style-biome-60a5fa.svg?style=flat)](https://biomejs.dev)
[![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg)](https://opensource.org/licenses/MIT)

> Zero-dependency Astro integration that makes your site natively readable by AI coding agents, CLI tools, and LLM search engines — for both static (SSG) and server-rendered (SSR) projects.

---

## Why Your Astro Site Needs This

When AI coding assistants (Cursor, Claude, Antigravity), documentation fetchers, or AI search engines visit a normal Astro site, they hit four immediate problems:

- **HTML Bloat Burns Context Windows:** Navigation bars, footers, layout wrappers, CSS classes, and hydration scripts inflate responses before an agent reaches your actual content.
- **Scrapers Mangle Code & Tables:** Tools that convert rendered HTML back into Markdown (via `jsdom`, `unified`, `rehype`) often break fenced code blocks, strip types, or corrupt formatting.
- **No Single Map for Agents:** Crawling HTML links or guessing sitemap URLs wastes roundtrips when an agent just wants a structured overview of what your site covers.
- **Static Files Go Stale on SSR Sites:** Sites backed by a CMS or database (`output: "server"`) need live `/llms.txt`, per-page Markdown responses, and `ETag` caching without exhausting edge Worker memory.

`astro-agent-ready` solves all four with **zero runtime dependencies** and **0 kB added to your client bundle**.

---

## How It Works

The integration adapts to your Astro `output` mode:

- **SSG (`output: "static"`)**: Reads your `.md`, `.mdx`, and `.astro` source files directly at build time — with zero HTML-to-Markdown conversion roundtrips — and emits spec-compliant [`/llms.txt`](https://llmstxt.org/) and `/llms-full.txt` into `dist/`.
- **SSR (`output: "server"` / `"hybrid"`)**: Automatically registers live `/llms.txt` (and optional bounded `/llms-full.txt`) endpoints plus middleware that handles:
  - **`.md` suffix routes** (e.g. `/articles/my-post.md`)
  - **`Accept: text/markdown` content negotiation** (with `Vary: Accept`)
  - **`Link` discovery headers** (`rel="alternate"; type="text/markdown"`) on HTML pages
  - **`ETag` / `304 Not Modified`** and `Cache-Control` headers for edge/CDN caching

---

## Installation

```bash
# npm
npm install -D astro-agent-ready

# pnpm
pnpm add -D astro-agent-ready

# bun
bun add -d astro-agent-ready
```

---

## Configuration Examples

### 1. Static Site (SSG)

Point `sources` at your content collections or pages directory. `astro-agent-ready` reads frontmatter and `.astro` exports (`export const title = ...`) directly during `astro build`:

```typescript
// astro.config.mjs
import { defineConfig } from "astro/config";
import agentReady from "astro-agent-ready";

export default defineConfig({
  site: "https://www.example.com",
  integrations: [
    agentReady({
      title: "My Engineering Site",
      description: "Notes on distributed systems, edge compute, and TypeScript.",
      corePages: [
        { title: "About", path: "/about", description: "Background and focus areas." },
      ],
      sources: [
        {
          name: "articles",
          heading: "Technical Articles",
          dir: "src/pages/articles", // or "src/content/blog"
          urlPrefix: "/articles",
          sortBy: "date-desc",
          filter: (doc) => !doc.metadata?.draft,
        },
      ],
      generateFull: true, // Also emits /llms-full.txt
    }),
  ],
});
```

### 2. Dynamic / CMS Site (SSR)

When `output: "server"` is set, point `ssr.sourcesModule` to a module that loads your live content from any CMS or database:

```typescript
// astro.config.mjs
import { defineConfig } from "astro/config";
import agentReady from "astro-agent-ready";

export default defineConfig({
  output: "server",
  site: "https://www.example.com",
  integrations: [
    agentReady({
      ssr: {
        sourcesModule: "./src/lib/llms.ts",
        cacheControl: "public, max-age=300, s-maxage=3600",
        full: {
          enabled: true,
          maxDocs: 20,      // Prevents edge Worker OOM on large sites
          maxTokens: 100000,
        },
      },
    }),
  ],
});
```

Export `resolveContext` (for `/llms.txt` and `/llms-full.txt`) and/or `resolveMarkdown` (for `.md` routes and `Accept: text/markdown` requests):

```typescript
// src/lib/llms.ts
import type { AgentReadyContextResolver, AgentReadyMarkdownResolver } from "astro-agent-ready";
import { getCollection, getEntry } from "your-cms";

export const resolveContext: AgentReadyContextResolver = async (siteUrl) => {
  const posts = await getCollection("posts");

  return {
    title: "My Blog",
    description: "Live engineering articles.",
    corePages: [{ title: "About", path: "/about" }],
    sources: [
      {
        heading: "Articles",
        docs: posts.map((post) => ({
          slug: `/articles/${post.slug}`,
          url: `${siteUrl}/articles/${post.slug}`,
          title: post.title,
          description: post.excerpt,
          date: post.publishedAt,
        })),
      },
    ],
  };
};

export const resolveMarkdown: AgentReadyMarkdownResolver = async (pathname) => {
  if (!pathname.startsWith("/articles/")) return null;
  const slug = pathname.slice("/articles/".length);
  const post = await getEntry("posts", slug);
  if (!post) return null;
  return `# ${post.title}\n\n${post.bodyMarkdown}`;
};
```

> Prefer explicit file-based routing? Set `ssr: false` and export `GET = createLlmsTxtRoute(...)` from `src/pages/llms.txt.ts`. See [DOCS.md](./DOCS.md) for examples.

---

## What Agents See (`/llms.txt`)

```markdown
# My Engineering Site

> Notes on distributed systems, edge compute, and TypeScript.

## Core Pages
- [About](https://www.example.com/about): Background and focus areas.

## Technical Articles
- [The Real Economics of Edge Compute](https://www.example.com/articles/edge-compute): Active CPU billing vs container overhead. (Published: 2026-04-10)
```

---

## Technical Reference

For the full configuration schema, programmatic API exports (`generateLlmsTxt`, `scanSourceDirectory`, `estimateTokenCount`, `createLlmsTxtRoute`), and SSR middleware details, see **[DOCS.md](./DOCS.md)**.

---

## License

MIT © [Evgenii Zinner](https://github.com/Evgenii-Zinner)
