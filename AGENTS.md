# AGENTS.md — Development Guidelines for AI Assistants

This repository contains `astro-agent-ready`, a zero-runtime-dependency Astro integration for AI agents and LLMs, generating spec-compliant `/llms.txt` and `/llms-full.txt` surfaces, SSR `.md` / `Accept: text/markdown` content negotiation, content collection discovery, and future WebMCP readiness.

---

## 1. Core Architecture Principles

1. **Zero Runtime Dependencies**:
   - The package MUST maintain **zero production runtime dependencies** (`"dependencies": {}` in `package.json`).
   - Build-time modules (`src/index.ts`, `src/parser.ts`, `src/scanner.ts`) may only rely on native Node.js / Bun standard library modules (`node:fs`, `node:path`, `node:url`).
   - Do NOT introduce external DOM or HTML parsers (like `jsdom`, `cheerio`, `unified`, `rehype`).

2. **SSR & Edge Worker Compatibility**:
   - Runtime SSR modules (`src/ssr.ts`, `src/middleware.ts`, `src/llms-route.ts`, `src/llms-full-route.ts`, `src/formatter.ts`) MUST NOT import `node:*` modules (`node:fs`, `node:crypto`, etc.) so they run cleanly on Cloudflare Workers and other edge runtimes.
   - Use the synchronous FNV-1a hash in `src/ssr.ts` for `ETag` generation.
   - Keep `/llms-full.txt` bounded in SSR (`maxDocs`, `maxTokens`) to avoid exhausting edge Worker memory/CPU limits.

3. **Strict TypeScript & Clean Code**:
   - Strict mode is enabled (`"strict": true` in `tsconfig.json`).
   - **Zero `any` policy**: Do not use `as any`, `: any`, `<any>`, or untyped casts.
   - Do not use non-null assertions (`!`) where avoidable. Use standard conditionals or optional chaining instead.
   - Do not use `@ts-ignore` or `@ts-expect-error`.

4. **Zero Markdown-to-HTML Roundtrips & Linear Parsing**:
   - Parse source content (`.md`, `.mdx`, and `.astro`) directly to preserve original markdown formatting, code fences, and headings without conversion loss or artifact generation.
   - Avoid polynomial/ReDoS-prone regular expressions on untrusted input (e.g. HTTP headers, query strings, HTML/frontmatter); prefer linear-time string scanning helpers.

---

## 2. Development Workflow & Commands

Always use the following npm scripts:

- **Lint & Format**:
  - `npm run lint` — Runs Biome linter and formatting checks.
  - `npm run lint:fix` — Automatically applies safe Biome fixes.
  - `npm run format` — Formats all source, test, and config files.
- **Testing**:
  - `npm run test` — Runs the complete Vitest test suite.
  - `npm run test:coverage` — Runs tests with V8 coverage (must maintain >95% coverage).
- **Build**:
  - `npm run build` — Compiles TypeScript into ESM, CJS, and DTS bundles in `dist/`.
- **Pre-publish Validation**:
  - `npm run prepublishOnly` — Runs linting, rebuilding, and the full test suite in sequence.

---

## 3. Reference Documentation

Consult these files before modifying integration behavior:

- **[`DOCS.md`](./DOCS.md)** — Full configuration schema, SSR explicit routing, and programmatic API reference.
- **[`README.md`](./README.md)** — Problem-first overview, quickstart, and configuration examples.
- **[`src/types.ts`](./src/types.ts)** — Canonical TypeScript types and option definitions.
- **[`src/ssr.ts`](./src/ssr.ts)** & **[`src/middleware.ts`](./src/middleware.ts)** — Edge-compatible SSR handlers, ETag caching, and `.md` content negotiation.
