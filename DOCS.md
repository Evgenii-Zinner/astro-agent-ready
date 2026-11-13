# Technical Reference — `astro-agent-ready`

This document covers the full configuration schema, SSR route/middleware internals, explicit file-based routing, and programmatic API exports.

---

## Full Configuration Reference (`astro.config.mjs`)

```typescript
import { defineConfig } from "astro/config";
import agentReady from "astro-agent-ready";

export default defineConfig({
  site: "https://www.example.com",
  integrations: [
    agentReady({
      // 1. Site Metadata
      title: "My Engineering Site",
      description: "Full-stack engineer across edge infrastructure, distributed systems, and agent pipelines.",
      intro: "This file is a map of the site optimized for Large Language Models (LLMs) and AI agents.",

      // 2. Core Pinned Pages
      corePages: [
        { title: "About", path: "/about", description: "Background, positioning, and engineering philosophy." },
        { title: "CV", path: "/cv", description: "Capabilities, edge diagnostics, and experience." },
      ],

      // 3. Static Content Sources (Collections or Pages directories)
      sources: [
        {
          name: "articles",
          heading: "Technical Articles & Post-Mortems",
          dir: "src/pages/articles",              // Directory relative to project root
          urlPrefix: "/articles",                 // Prepended to file slugs
          extensions: [".astro", ".md", ".mdx"],  // File extensions to include
          sortBy: "date-desc",                    // "date-desc" | "date-asc" | "title" | "none"
          titleField: "title",
          descriptionField: "description",        // Falls back to "preview"
          dateField: "date",
          tagField: "tag",                        // Falls back to "tags"
          filter: (doc) => !doc.metadata?.draft,  // Filter out drafts
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

      // 6. SSR Mode (output: "server" | "hybrid")
      ssr: {
        enabled: true, // Set false to disable auto-injected routes and middleware
        sourcesModule: "./src/lib/llms.ts",
        cacheControl: "public, max-age=300, s-maxage=3600",
        // cdnCacheControl: "max-age=3600", // Optional CDN-Cache-Control header
        etag: true,                         // Synchronous FNV-1a ETag + 304 Not Modified
        markdownNegotiation: true,          // .md suffix routes & Accept: text/markdown
        discoveryHeader: true,              // Link: </llms.txt>; rel="alternate"; type="text/markdown"
        full: {
          enabled: false,
          maxDocs: 20,
          maxTokens: 100000,
        },
      },

      // 7. Build & Logging Options
      outputFileName: "llms.txt",
      logStats: true,
    }),
  ],
});
```

---

## SSR Option B: Explicit `src/pages/llms.txt.ts`

If you prefer explicit file-based routing over `ssr.sourcesModule`, set `ssr: false` in `agentReady(...)` and export `GET` from `src/pages/llms.txt.ts`:

```typescript
// src/pages/llms.txt.ts
import { createLlmsTxtRoute } from "astro-agent-ready";
import { getCollection } from "your-cms";

export const GET = createLlmsTxtRoute({
  title: "My Blog",
  description: "SSR blog.",
  corePages: [{ title: "About", path: "/about" }],
  dynamicSources: [
    {
      name: "articles",
      heading: "Technical Articles",
      load: async (siteUrl) => {
        const entries = await getCollection("posts");
        return entries.map((post) => ({
          slug: `/articles/${post.slug}`,
          url: `${siteUrl}/articles/${post.slug}`,
          title: post.title,
          description: post.excerpt,
        }));
      },
    },
  ],
});
```

---

## Generated `/llms-full.txt` Format

```markdown
# My Engineering Site — Full Content Context

> Full-stack engineer across edge infrastructure, distributed systems, and agent pipelines.

This file contains the concatenated full content of all documents from My Engineering Site, optimized for ingestion by reasoning models and Large Language Models.

---

# Compiling Inline Event Handlers for Strict CSP in Astro
URL: https://www.example.com/articles/compiling-inline-event-handlers
Date: 2026-10-19
Tags: DevOps & Systems
Description: How astro-strict-csp extracts inline handlers into delegated bundles.

[Pristine article markdown body with exact code blocks and headings]
```

In SSR mode, `ssr.full.maxDocs` and `ssr.full.maxTokens` cap how many documents and estimated tokens are concatenated so edge Workers stay within CPU and memory limits.

---

## Programmatic API Exports

All parsing, token estimation, and formatting helpers are exported for custom pipelines:

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
  createLlmsTxtRoute,
  createLlmsFullTxtRoute,
} from "astro-agent-ready";
```

---

## Roadmap

- [x] Spec-compliant `/llms.txt` generation
- [x] Full-text concatenated `/llms-full.txt` context generation
- [x] Astro Content Collections & standalone `.astro` page export discovery
- [x] Zero-dependency YAML frontmatter & markdown parser
- [x] Token estimation analytics
- [x] SSR mode (`resolveContext`, `resolveMarkdown`, `.md` negotiation, `ETag` caching, bounded `/llms-full.txt`)
- [ ] WebMCP Readiness (generating browser-agent tool manifests)
- [ ] JSON-LD Agent Cards (`/.well-known/agent.json`)
