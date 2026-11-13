# astro-agent-ready

[![CI](https://github.com/Evgenii-Zinner/astro-agent-ready/actions/workflows/ci.yml/badge.svg)](https://github.com/Evgenii-Zinner/astro-agent-ready/actions/workflows/ci.yml)
[![codecov](https://codecov.io/gh/Evgenii-Zinner/astro-agent-ready/graph/badge.svg)](https://codecov.io/gh/Evgenii-Zinner/astro-agent-ready)
[![npm version](https://img.shields.io/npm/v/astro-agent-ready.svg?color=cb3837)](https://www.npmjs.com/package/astro-agent-ready)
[![dependencies](https://img.shields.io/badge/dependencies-0-success.svg)](https://www.npmjs.com/package/astro-agent-ready)
[![code style: biome](https://img.shields.io/badge/code_style-biome-60a5fa.svg?style=flat)](https://biomejs.dev)
[![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg)](https://opensource.org/licenses/MIT)

> **Zero-Dependency Astro Integration for AI Agents and LLMs. Generates spec-compliant `/llms.txt` and `/llms-full.txt`, auto-discovers content collections, and prepares your site for the modern agentic web.**

---

## 1. Executive Summary & Value Proposition

As autonomous coding agents (Claude Computer Use, Google Jules / Antigravity, Cursor, OpenAI Operator) and AI search engines (Perplexity, ChatGPT Search) become the primary consumers of documentation and technical content, standard HTML pages waste precious context window tokens on navigation trees, boilerplate layout tags, CSS styles, and client scripts.

The **[`llms.txt` standard](https://llmstxt.org/)** (proposed by Jeremy Howard / Answer.AI) provides clean, structured Markdown surfaces hosted at `/llms.txt` and `/llms-full.txt` that allow AI tools to instantly index and ingest your website's knowledge base.

`astro-agent-ready` automates this entire lifecycle with **zero external dependencies** and **zero markdown-to-HTML conversion roundtrips**.

---

## 2. Core Features & Advantages

- **Zero HTML-to-Markdown Roundtrips:**
  Unlike bloated alternatives that pull in 12+ dependencies (`jsdom`, `unified`, `rehype`, `remark`) to parse rendered HTML back into markdown, `astro-agent-ready` reads your source files (`.md`, `.mdx`, and `.astro`) directly. It strips frontmatter and preserves pristine code blocks, formatting, and tables without conversion artifacts.
- **Spec-Compliant Dual Generation (`llmstxt.org`):**
  - **`/llms.txt`**: Curated index with top-level H1, blockquote summary, categorized sections, and pinned core pages.
  - **`/llms-full.txt`**: Concatenated full-text context of all documents for deep context ingestion by reasoning models.
- **Universal Content Discovery:**
  - Standard Astro Content Collections (`src/content/**` and Astro 5 Content Layer).
  - Standalone article directories (e.g. `src/pages/articles/*.astro`, `src/pages/blog/*.md`).
  - Supports both YAML frontmatter and `.astro` variable exports (`export const title = ...`).
- **Token Count & Size Analytics:**
  - Calculates subword token estimates and file sizes during `astro build`, reporting stats directly in the build console.
- **100% Zero Runtime Dependencies:**
  - Built exclusively on native Node.js / Bun APIs (`node:fs`, `node:path`, `node:url`). 0 kB added to client bundles.

---

## 3. Installation & Usage

```bash
# npm
npm install -D astro-agent-ready

# pnpm
pnpm add -D astro-agent-ready

# bun
bun add -d astro-agent-ready
```

### Basic Configuration (`astro.config.mjs`)

```typescript
import { defineConfig } from "astro/config";
import agentReady from "astro-agent-ready";

export default defineConfig({
  site: "https://www.example.com",
  integrations: [
    agentReady({
      title: "My Engineering Portfolio",
      description: "Full-stack edge architecture, systems programming, and autonomous agents.",
      sources: [
        {
          name: "articles",
          heading: "Technical Articles",
          dir: "src/pages/articles", // or "src/content/blog"
          urlPrefix: "/articles",
        },
      ],
      generateFull: true, // Also emits /llms-full.txt
    }),
  ],
});
```

---

## 4. Full Configuration Reference

```typescript
import { defineConfig } from "astro/config";
import agentReady from "astro-agent-ready";

export default defineConfig({
  site: "https://www.example.com",
  integrations: [
    agentReady({
      // 1. Site Metadata
      title: "Evgenii Zinner — Troubleshooter",
      description: "Full-stack engineer across edge infrastructure, distributed systems, and agent pipelines.",
      intro: "This file is a map of the site optimized for Large Language Models (LLMs) and AI agents.",

      // 2. Core Pinned Pages
      corePages: [
        { title: "About", path: "/about", description: "Background, positioning, and engineering philosophy." },
        { title: "Now", path: "/now", description: "Current commercial priorities and what I'm doing right now." },
        { title: "CV", path: "/cv", description: "Capabilities, edge diagnostics, and reverse-chronological experience." },
        { title: "Pet Projects", path: "/pet", description: "Personal craft and engineering sandboxes." },
      ],

      // 3. Content Sources (Collections or Pages directories)
      sources: [
        {
          name: "articles",
          heading: "Technical Articles & Post-Mortems",
          dir: "src/pages/articles", // Directory relative to project root
          urlPrefix: "/articles",     // Prepended to file slugs
          extensions: [".astro", ".md", ".mdx"], // File extensions to include
          sortBy: "date-desc",        // "date-desc" | "date-asc" | "title" | "none"
          // Optional custom field mapping if using custom frontmatter / export names:
          titleField: "title",
          descriptionField: "description", // Falls back to "preview"
          dateField: "date",
          tagField: "tag",                 // Falls back to "tags"
          filter: (doc) => !doc.metadata?.draft, // Filter out drafts
        },
      ],

      // 4. Concatenated Full-Content File (/llms-full.txt)
      generateFull: true,
      fullFileName: "llms-full.txt",
      // includeInFull: ["articles"], // Optional: restrict which sources appear in full context

      // 5. Contact & Social Links
      contact: {
        email: "contact@example.com",
        github: "Evgenii-Zinner",
        linkedin: "evgenii-zinner",
        x: "@EvgeniiZinner",
      },

      // 6. SSR Mode (output: "server")
      ssr: {
        enabled: true, // Auto-injects dynamic /llms.txt route & agent middleware when output === "server"
        sourcesModule: "./src/lib/llms.ts", // Module exporting resolveContext, dynamicSources, and/or resolveMarkdown
        cacheControl: "public, max-age=300, s-maxage=3600",
        // cdnCacheControl: "max-age=3600", // Optional CDN-Cache-Control header
        etag: true, // ETag + 304 Not Modified support
        markdownNegotiation: true, // Enables .md suffix routes & Accept: text/markdown negotiation
        discoveryHeader: true, // Attaches Link: </llms.txt>; rel="alternate"; type="text/markdown" on HTML
        full: {
          enabled: false, // Enable bounded /llms-full.txt in SSR
          maxDocs: 20,
          maxTokens: 100000,
        },
      },

      // 7. Build & Logging Options
      outputFileName: "llms.txt",
      logStats: true, // Logs token estimates & file sizes in build output
    }),
  ],
});
```

---

## 4.1. SSR Mode & Dynamic CMS Integration

When Astro runs with `output: "server"`, `astro-agent-ready` automatically registers:
- `GET /llms.txt` (dynamic index with `ETag` / `304 Not Modified` and cache headers)
- `GET /llms-full.txt` (optional, bounded by `maxDocs` and `maxTokens` so edge Workers never OOM)
- Middleware handling `.md` suffix routes (`/articles/post.md`), `Accept: text/markdown` content negotiation (`Vary: Accept`), and `Link` discovery headers on HTML pages.

### Option A: `ssr.sourcesModule` (Zero Hardcoded Config in `astro.config.mjs`)
Export `resolveContext` (to hydrate `title`, `description`, `corePages`, `contact`, and `sources` from any CMS/DB) and/or `resolveMarkdown` (to serve clean Markdown for individual pages):

```typescript
// src/lib/llms.ts
import type { AgentReadyContextResolver, AgentReadyMarkdownResolver } from "astro-agent-ready";
import { getEmDashCollection, getEmDashEntry } from "emdash";

export const resolveContext: AgentReadyContextResolver = async (siteUrl) => {
  const { entries } = await getEmDashCollection("posts", {
    orderBy: { published_at: "desc" },
  });

  return {
    title: "My Blog",
    description: "Dynamic SSR site.",
    corePages: [{ title: "About", path: "/about" }],
    sources: [
      {
        heading: "Technical Articles",
        docs: entries.map((post) => ({
          slug: `/articles/${post.data.slug}`,
          url: `${siteUrl}/articles/${post.data.slug}`,
          title: post.data.title,
          description: post.data.excerpt,
          date: post.data.publishedAt?.toISOString().split("T")[0],
        })),
      },
    ],
  };
};

export const resolveMarkdown: AgentReadyMarkdownResolver = async (pathname) => {
  if (!pathname.startsWith("/articles/")) return null;
  const slug = pathname.replace(/^\/articles\//, "");
  const entry = await getEmDashEntry("posts", slug);
  if (!entry) return null;
  return `# ${entry.data.title}\n\n${entry.data.excerpt ?? ""}`;
};
```

### Option B: Explicit `src/pages/llms.txt.ts` via `createLlmsTxtRoute`
If you prefer explicit file-based routing, set `ssr: false` in `agentReady(...)` and export `GET` from `src/pages/llms.txt.ts`:

```typescript
// src/pages/llms.txt.ts
import { createLlmsTxtRoute } from "astro-agent-ready";
import { getEmDashCollection } from "emdash";

export const GET = createLlmsTxtRoute({
  title: "My Blog",
  description: "SSR blog powered by EmDash.",
  corePages: [{ title: "About", path: "/about" }],
  dynamicSources: [
    {
      name: "articles",
      heading: "Technical Articles",
      load: async (siteUrl) => {
        const { entries } = await getEmDashCollection("posts", {
          orderBy: { published_at: "desc" },
        });
        return entries.map((post) => ({
          slug: `/articles/${post.data.slug}`,
          url: `${siteUrl}/articles/${post.data.slug}`,
          title: post.data.title,
          description: post.data.excerpt,
        }));
      },
    },
  ],
});
```

---

## 5. Generated Output Examples

### `/llms.txt`
```markdown
# Evgenii Zinner — Troubleshooter

> Full-stack engineer across edge infrastructure, distributed systems, and agent pipelines.

This file is a map of the site optimized for Large Language Models (LLMs) and AI agents.

## Core Pages
- [About](https://www.example.com/about): Background, positioning, and engineering philosophy.
- [CV](https://www.example.com/cv): Capabilities, edge diagnostics, and reverse-chronological experience.
- [Pet Projects](https://www.example.com/pet): Personal craft and engineering sandboxes.

## Technical Articles & Post-Mortems
- [Compiling Inline Event Handlers for Strict CSP in Astro](https://www.example.com/articles/compiling-inline-event-handlers): How astro-strict-csp extracts inline handlers into delegated bundles. (Published: 2026-10-19, Tags: DevOps & Systems)
- [The Real Economics of Edge Compute](https://www.example.com/articles/the-real-economics-of-edge-compute): A breakdown of active CPU billing vs container overhead. (Published: 2026-04-10, Tags: Cloud & Systems)

## Direct Contact
- **Email:** contact@example.com
- **GitHub:** [Evgenii-Zinner](https://github.com/Evgenii-Zinner)
- **LinkedIn:** [evgenii-zinner](https://www.linkedin.com/in/evgenii-zinner/)
- **X/Twitter:** [@EvgeniiZinner](https://x.com/EvgeniiZinner)

*Data formatted in accordance with the llms.txt standard.*
```

### `/llms-full.txt`
```markdown
# Evgenii Zinner — Troubleshooter — Full Content Context

> Full-stack engineer across edge infrastructure, distributed systems, and agent pipelines.

This file contains the concatenated full content of all documents from Evgenii Zinner — Troubleshooter, optimized for ingestion by reasoning models and Large Language Models.

---

# Compiling Inline Event Handlers for Strict CSP in Astro
URL: https://www.example.com/articles/compiling-inline-event-handlers
Date: 2026-10-19
Tags: DevOps & Systems
Description: How astro-strict-csp extracts inline handlers into delegated bundles.

[Pristine article markdown body with exact code blocks and headings]
```

---

## 6. Programmatic API Exports

In addition to the Astro integration, `astro-agent-ready` exports all parsing and formatting functions for custom pipelines:

```typescript
import {
  generateLlmsTxt,
  generateLlmsFullTxt,
  scanSourceDirectory,
  parseSourceFile,
  parseMarkdownFile,
  parseAstroFile,
  parseYamlFrontmatter,
  estimateTokenCount,
  formatTokens,
} from "astro-agent-ready";
```

---

## 7. Roadmap to Modern Agent Readiness

- [x] Spec-compliant `/llms.txt` generation
- [x] Full-text concatenated `/llms-full.txt` context generation
- [x] Astro Content Collections & standalone `.astro` page export discovery
- [x] Zero-dependency YAML frontmatter & markdown parser
- [x] Token estimation analytics
- [ ] WebMCP Readiness (generating browser-agent tool manifests)
- [ ] JSON-LD Agent Cards (`/.well-known/agent.json`)

---

## 8. License

MIT © [Evgenii Zinner](https://github.com/Evgenii-Zinner)
