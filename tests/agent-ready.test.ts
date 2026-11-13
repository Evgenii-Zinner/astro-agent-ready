import * as fs from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';
import { pathToFileURL } from 'node:url';
import type { AstroConfig, AstroIntegrationLogger } from 'astro';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  agentReady,
  astroAgentReady,
  estimateTokenCount,
  formatTokens,
  generateLlmsFullTxt,
  generateLlmsTxt,
  parseAstroFile,
  parseMarkdownFile,
  parseSourceFile,
  parseYamlFrontmatter,
  scanSourceDirectory,
} from '../src/index.js';
import type { AgentReadyOptions, ContentDocument, SourceConfig } from '../src/types.js';

describe('astro-agent-ready Comprehensive Test Suite', () => {
  let tempDir: string;

  beforeEach(() => {
    tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'astro-agent-ready-test-'));
  });

  afterEach(() => {
    fs.rmSync(tempDir, { recursive: true, force: true });
  });

  describe('YAML & Markdown Parser (parser.ts)', () => {
    it('parses standard YAML frontmatter types correctly', () => {
      const yaml = `
# Comment line
title: "My Great Article"
description: 'A deep dive into edge isolates'
published: true
draft: false
views: 1250
rating: 4.8
tags: [edge, systems, v8]
categories:
  - Architecture
  - DevOps
`;
      const result = parseYamlFrontmatter(yaml);
      expect(result.title).toBe('My Great Article');
      expect(result.description).toBe('A deep dive into edge isolates');
      expect(result.published).toBe(true);
      expect(result.draft).toBe(false);
      expect(result.views).toBe(1250);
      expect(result.rating).toBe(4.8);
      expect(result.tags).toEqual(['edge', 'systems', 'v8']);
      expect(result.categories).toEqual(['Architecture', 'DevOps']);
    });

    it('parses markdown file and separates frontmatter from body', () => {
      const content = `---
title: "Hello World"
description: "Introductory post"
---

# Hello World

This is the body content with \`inline code\` and a code fence:

\`\`\`typescript
const greeting = "hello";
\`\`\`
`;
      const parsed = parseMarkdownFile(content);
      expect(parsed.metadata.title).toBe('Hello World');
      expect(parsed.metadata.description).toBe('Introductory post');
      expect(parsed.body).toContain('# Hello World');
      expect(parsed.body).toContain('const greeting = "hello";');
    });

    it('handles markdown file without frontmatter gracefully', () => {
      const content = `# Raw Markdown
Just body text without frontmatter fence.`;
      const parsed = parseMarkdownFile(content);
      expect(parsed.metadata).toEqual({});
      expect(parsed.body).toBe(content);
    });

    it('parses Astro file extracting exported variables and stripping layout wrappers', () => {
      const content = `---
import Layout from "../../layouts/ArticleLayout.astro";

export const title = "Astro Article Title";
export const description = "Astro article description";
export const date = "2026-10-24";
export const tag = "Systems";
export const tags = ["Edge", "Astro"];
export const draft = false;
export const order = 5;
---
<BlogPostLayout title={title} order={order}>
  <h2>Main Section</h2>
  <p>This is the article content body.</p>
</BlogPostLayout>
`;
      const parsed = parseAstroFile(content);
      expect(parsed.metadata.title).toBe('Astro Article Title');
      expect(parsed.metadata.description).toBe('Astro article description');
      expect(parsed.metadata.date).toBe('2026-10-24');
      expect(parsed.metadata.tag).toBe('Systems');
      expect(parsed.metadata.tags).toEqual(['Edge', 'Astro']);
      expect(parsed.metadata.draft).toBe(false);
      expect(parsed.metadata.order).toBe(5);
      expect(parsed.body).toContain('<h2>Main Section</h2>');
      expect(parsed.body).not.toContain('<BlogPostLayout');
    });

    it('handles Astro files with backticks and multiline exports', () => {
      const content = `---
export const title = \`Complex Title with Template Literal\`;
export const preview = 'Alternative preview field';
---
<div>Content</div>`;
      const parsed = parseAstroFile(content);
      expect(parsed.metadata.title).toBe('Complex Title with Template Literal');
      expect(parsed.metadata.preview).toBe('Alternative preview field');
      expect(parsed.body).toBe('<div>Content</div>');
    });

    it('dispatches to correct parser via parseSourceFile', () => {
      const astroContent = `---
export const title = "From Astro";
---
Body`;
      const mdContent = `---
title: "From MD"
---
Body`;

      expect(parseSourceFile('post.astro', astroContent).metadata.title).toBe('From Astro');
      expect(parseSourceFile('post.md', mdContent).metadata.title).toBe('From MD');
      expect(parseSourceFile('post.mdx', mdContent).metadata.title).toBe('From MD');
    });
  });

  describe('Token Count Estimator (tokens.ts)', () => {
    it('estimates token counts for empty and non-empty strings', () => {
      expect(estimateTokenCount('')).toBe(0);
      const sample = 'The quick brown fox jumps over the lazy dog.';
      const tokens = estimateTokenCount(sample);
      expect(tokens).toBeGreaterThan(5);
      expect(tokens).toBeLessThan(20);
    });

    it('formats tokens into human readable notations', () => {
      expect(formatTokens(450)).toBe('450 tokens');
      expect(formatTokens(1500)).toBe('1.5k tokens');
      expect(formatTokens(2_400_000)).toBe('2.4M tokens');
    });
  });

  describe('Source Scanner (scanner.ts)', () => {
    it('returns empty array when target directory does not exist', () => {
      const source: SourceConfig = {
        name: 'missing',
        heading: 'Missing',
        dir: path.join(tempDir, 'does-not-exist'),
      };
      const docs = scanSourceDirectory(source, tempDir, 'https://example.com');
      expect(docs).toEqual([]);
    });

    it('scans mixed markdown and astro files, sorting by date descending by default', () => {
      const articlesDir = path.join(tempDir, 'articles');
      fs.mkdirSync(articlesDir);

      fs.writeFileSync(
        path.join(articlesDir, 'first-post.md'),
        `---
title: "First Post"
description: "Old post"
date: "2026-01-01"
tag: "Legacy"
---
Content of first post`,
      );

      fs.writeFileSync(
        path.join(articlesDir, 'second-post.astro'),
        `---
export const title = "Second Post";
export const description = "Newer post";
export const date = "2026-10-20";
export const tag = "Modern";
---
Content of second post`,
      );

      const source: SourceConfig = {
        name: 'articles',
        heading: 'Articles',
        dir: 'articles',
        urlPrefix: '/articles',
      };

      const docs = scanSourceDirectory(source, tempDir, 'https://example.com');
      expect(docs).toHaveLength(2);
      expect(docs[0].title).toBe('Second Post'); // Newer date first
      expect(docs[0].url).toBe('https://example.com/articles/second-post');
      expect(docs[0].date).toBe('2026-10-20');
      expect(docs[0].tag).toBe('Modern');

      expect(docs[1].title).toBe('First Post');
      expect(docs[1].url).toBe('https://example.com/articles/first-post');
    });

    it('supports custom sorting orders (date-asc and title)', () => {
      const docsDir = path.join(tempDir, 'docs');
      fs.mkdirSync(docsDir);

      fs.writeFileSync(
        path.join(docsDir, 'b.md'),
        '---\ntitle: "Beta"\ndate: "2026-05-01"\n---\nBody',
      );
      fs.writeFileSync(
        path.join(docsDir, 'a.md'),
        '---\ntitle: "Alpha"\ndate: "2026-01-01"\n---\nBody',
      );

      const ascSource: SourceConfig = {
        name: 'docs',
        heading: 'Docs',
        dir: 'docs',
        sortBy: 'date-asc',
      };
      const ascDocs = scanSourceDirectory(ascSource, tempDir, 'https://example.com');
      expect(ascDocs[0].title).toBe('Alpha');

      const titleSource: SourceConfig = {
        name: 'docs',
        heading: 'Docs',
        dir: 'docs',
        sortBy: 'title',
      };
      const titleDocs = scanSourceDirectory(titleSource, tempDir, 'https://example.com');
      expect(titleDocs[0].title).toBe('Alpha');
      expect(titleDocs[1].title).toBe('Beta');
    });

    it('automatically excludes drafts by default and allows opting in via excludeDrafts: false', () => {
      const postsDir = path.join(tempDir, 'drafts-test');
      fs.mkdirSync(postsDir);

      fs.writeFileSync(
        path.join(postsDir, 'published.md'),
        '---\ntitle: "Published Post"\ndraft: false\n---\nBody',
      );
      fs.writeFileSync(
        path.join(postsDir, 'wip.md'),
        '---\ntitle: "WIP Post"\ndraft: true\n---\nBody',
      );
      fs.writeFileSync(
        path.join(postsDir, 'astro-wip.astro'),
        '---\nexport const title = "Astro WIP";\nexport const draft = true;\n---\nBody',
      );

      // Default: excludeDrafts is true
      const defaultSource: SourceConfig = {
        name: 'posts',
        heading: 'Posts',
        dir: 'drafts-test',
      };
      const filtered = scanSourceDirectory(defaultSource, tempDir, 'https://example.com');
      expect(filtered).toHaveLength(1);
      expect(filtered[0].title).toBe('Published Post');

      // Opt in: excludeDrafts is false
      const includeDraftsSource: SourceConfig = {
        name: 'posts',
        heading: 'Posts',
        dir: 'drafts-test',
        excludeDrafts: false,
      };
      const allDocs = scanSourceDirectory(includeDraftsSource, tempDir, 'https://example.com');
      expect(allDocs).toHaveLength(3);
    });

    it('respects custom filters', () => {
      const postsDir = path.join(tempDir, 'posts');
      fs.mkdirSync(postsDir);

      fs.writeFileSync(
        path.join(postsDir, 'public.md'),
        '---\ntitle: "Public"\ndraft: false\n---\nBody',
      );
      fs.writeFileSync(
        path.join(postsDir, 'draft.md'),
        '---\ntitle: "Draft"\ndraft: true\n---\nBody',
      );

      const source: SourceConfig = {
        name: 'posts',
        heading: 'Posts',
        dir: 'posts',
        filter: (doc) => doc.metadata?.draft !== true,
      };

      const docs = scanSourceDirectory(source, tempDir, 'https://example.com');
      expect(docs).toHaveLength(1);
      expect(docs[0].title).toBe('Public');
    });
  });

  describe('Markdown Generators (formatter.ts)', () => {
    const mockSource: SourceConfig = {
      name: 'articles',
      heading: 'Technical Articles',
      dir: 'articles',
    };

    const mockDocs: ContentDocument[] = [
      {
        slug: '/articles/intro',
        url: 'https://example.com/articles/intro',
        title: 'Introduction to Agents',
        description: 'A primer on autonomous systems',
        date: '2026-10-24',
        tag: 'AI',
        body: 'Full body content of article.',
      },
    ];

    it('generates spec-compliant llms.txt with core pages, sections, and contact links', () => {
      const options: AgentReadyOptions = {
        siteUrl: 'https://example.com',
        title: 'Agent Site',
        description: 'An AI-friendly modern website.',
        intro: 'Custom intro text describing the agent map.',
        corePages: [
          { title: 'About', path: '/about', description: 'About the author' },
          { title: 'External Docs', path: 'https://docs.example.com', description: 'External API' },
        ],
        contact: {
          email: 'test@example.com',
          github: 'Evgenii-Zinner',
          linkedin: 'evgenii-zinner',
          x: '@EvgeniiZinner',
        },
      };

      const sourcesMap = new Map<SourceConfig, ContentDocument[]>([[mockSource, mockDocs]]);
      const output = generateLlmsTxt(options, sourcesMap);

      expect(output).toContain('# Agent Site');
      expect(output).toContain('> An AI-friendly modern website.');
      expect(output).toContain('Custom intro text describing the agent map.');
      expect(output).toContain('## Core Pages');
      expect(output).toContain('- [About](https://example.com/about): About the author');
      expect(output).toContain('- [External Docs](https://docs.example.com): External API');
      expect(output).toContain('## Technical Articles');
      expect(output).toContain(
        '- [Introduction to Agents](https://example.com/articles/intro): A primer on autonomous systems (Published: 2026-10-24, Tags: AI)',
      );
      expect(output).toContain('## Direct Contact');
      expect(output).toContain('- **Email:** test@example.com');
      expect(output).toContain('- **GitHub:** [Evgenii-Zinner](https://github.com/Evgenii-Zinner)');
      expect(output).toContain(
        '- **LinkedIn:** [evgenii-zinner](https://www.linkedin.com/in/evgenii-zinner/)',
      );
      expect(output).toContain('- **X/Twitter:** [@EvgeniiZinner](https://x.com/EvgeniiZinner)');
      expect(output).toContain('*Data formatted in accordance with the llms.txt standard.*');
    });

    it('supports array contact format and custom footer in llms.txt', () => {
      const options: AgentReadyOptions = {
        title: 'Site',
        description: 'Description',
        contact: ['- Contact via discord: @user', '- Telegram: @bot'],
        customFooter: 'Custom footer text here.',
      };

      const output = generateLlmsTxt(options, new Map());
      expect(output).toContain('## Direct Contact');
      expect(output).toContain('- Contact via discord: @user');
      expect(output).toContain('- Telegram: @bot');
      expect(output).toContain('Custom footer text here.');
      expect(output).not.toContain('*Data formatted in accordance with the llms.txt standard.*');
    });

    it('generates llms-full.txt with document headers and body concatenation', () => {
      const options: AgentReadyOptions = {
        title: 'Agent Site',
        description: 'Full context description',
        generateFull: true,
      };

      const sourcesMap = new Map<SourceConfig, ContentDocument[]>([[mockSource, mockDocs]]);
      const fullOutput = generateLlmsFullTxt(options, sourcesMap);

      expect(fullOutput).toContain('# Agent Site — Full Content Context');
      expect(fullOutput).toContain('---');
      expect(fullOutput).toContain('# Introduction to Agents');
      expect(fullOutput).toContain('URL: https://example.com/articles/intro');
      expect(fullOutput).toContain('Date: 2026-10-24');
      expect(fullOutput).toContain('Tags: AI');
      expect(fullOutput).toContain('Description: A primer on autonomous systems');
      expect(fullOutput).toContain('Full body content of article.');
    });

    it('respects includeInFull filter for llms-full.txt', () => {
      const otherSource: SourceConfig = {
        name: 'internal',
        heading: 'Internal Notes',
        dir: 'internal',
      };
      const otherDoc: ContentDocument[] = [
        {
          slug: '/internal/secret',
          url: '/internal/secret',
          title: 'Secret Notes',
          body: 'Do not include',
        },
      ];

      const options: AgentReadyOptions = {
        title: 'Filtered Site',
        description: 'Filter test',
        includeInFull: ['articles'], // Exclude 'internal'
      };

      const sourcesMap = new Map<SourceConfig, ContentDocument[]>([
        [mockSource, mockDocs],
        [otherSource, otherDoc],
      ]);

      const fullOutput = generateLlmsFullTxt(options, sourcesMap);
      expect(fullOutput).toContain('# Introduction to Agents');
      expect(fullOutput).not.toContain('# Secret Notes');
    });
  });

  describe('Astro Integration Lifecycle Hooks (index.ts)', () => {
    it('executes full build lifecycle writing llms.txt and llms-full.txt into outDir', async () => {
      // 1. Create a dummy project structure
      const srcArticles = path.join(tempDir, 'src', 'pages', 'articles');
      fs.mkdirSync(srcArticles, { recursive: true });

      fs.writeFileSync(
        path.join(srcArticles, 'post.astro'),
        `---
export const title = "Integration Article";
export const description = "Tested through Astro lifecycle";
export const date = "2026-10-24";
---
<p>Article body content here</p>`,
      );

      const distDir = path.join(tempDir, 'dist');
      fs.mkdirSync(distDir);

      const integration = agentReady({
        title: 'Test Integration Site',
        description: 'Automated test suite',
        corePages: [{ title: 'Home', path: '/', description: 'Landing page' }],
        sources: [
          {
            name: 'articles',
            heading: 'Articles',
            dir: 'src/pages/articles',
            urlPrefix: '/articles',
          },
        ],
        generateFull: true,
      });

      // Mock Astro config hook
      const configSetupHook = integration.hooks['astro:config:setup'] as (params: {
        config: Partial<AstroConfig>;
      }) => void;
      configSetupHook({
        config: {
          root: pathToFileURL(tempDir),
          site: 'https://testsite.com',
        },
      });

      // Mock Astro build done hook
      const logger: AstroIntegrationLogger = {
        options: { dest: { write: vi.fn() }, level: 'info' },
        label: 'test',
        fork: vi.fn(),
        info: vi.fn(),
        warn: vi.fn(),
        error: vi.fn(),
        debug: vi.fn(),
      };
      const buildDoneHook = integration.hooks['astro:build:done'] as (params: {
        dir: URL;
        logger: AstroIntegrationLogger;
      }) => Promise<void>;

      await buildDoneHook({
        dir: pathToFileURL(`${distDir}/`),
        logger,
      });

      // Verify files were generated
      const llmsTxtPath = path.join(distDir, 'llms.txt');
      const llmsFullPath = path.join(distDir, 'llms-full.txt');

      expect(fs.existsSync(llmsTxtPath)).toBe(true);
      expect(fs.existsSync(llmsFullPath)).toBe(true);

      const llmsTxtContent = fs.readFileSync(llmsTxtPath, 'utf-8');
      expect(llmsTxtContent).toContain('# Test Integration Site');
      expect(llmsTxtContent).toContain('- [Home](https://testsite.com/): Landing page');
      expect(llmsTxtContent).toContain(
        '- [Integration Article](https://testsite.com/articles/post): Tested through Astro lifecycle',
      );

      const llmsFullContent = fs.readFileSync(llmsFullPath, 'utf-8');
      expect(llmsFullContent).toContain('# Test Integration Site — Full Content Context');
      expect(llmsFullContent).toContain('# Integration Article');
      expect(llmsFullContent).toContain('<p>Article body content here</p>');

      // Verify logger was called with stats
      expect(logger.info).toHaveBeenCalledWith(
        expect.stringContaining('Generated /llms.txt with 1 documents'),
      );
      expect(logger.info).toHaveBeenCalledWith(
        expect.stringContaining('Generated /llms-full.txt full context'),
      );
    });

    it('exports astroAgentReady as alias identical to default agentReady', () => {
      expect(astroAgentReady).toBe(agentReady);
    });

    it('injects dynamic SSR route and virtual config when output is "server"', async () => {
      interface VirtualPlugin {
        name: string;
        resolveId: (id: string) => string | undefined;
        load: (id: string) => string | undefined;
      }

      let capturedPlugins: VirtualPlugin[] = [];
      const updateConfig = (cfg: { vite?: { plugins?: VirtualPlugin[] } }) => {
        capturedPlugins = cfg.vite?.plugins || [];
      };
      const injectRoute = vi.fn();
      const addMiddleware = vi.fn();
      const logger: AstroIntegrationLogger = {
        options: { dest: { write: vi.fn() }, level: 'info' },
        label: 'test',
        fork: vi.fn(),
        info: vi.fn(),
        warn: vi.fn(),
        error: vi.fn(),
        debug: vi.fn(),
      };

      const integration = agentReady({
        title: 'SSR Site',
        description: 'Running on Workers',
        corePages: [{ title: 'CV', path: '/cv' }],
        ssr: {
          sourcesModule: './src/lib/llms-sources.ts',
          cacheControl: 'public, max-age=120',
          full: true,
        },
      });

      const setupHook = integration.hooks['astro:config:setup'] as (params: {
        config: Partial<AstroConfig>;
        updateConfig: typeof updateConfig;
        injectRoute: typeof injectRoute;
        addMiddleware: typeof addMiddleware;
        logger: AstroIntegrationLogger;
      }) => void;

      setupHook({
        config: {
          root: pathToFileURL(tempDir),
          site: 'https://ssr.example.com',
          output: 'server',
        },
        updateConfig,
        injectRoute,
        addMiddleware,
        logger,
      });

      expect(injectRoute).toHaveBeenCalledWith({
        pattern: '/llms.txt',
        entrypoint: 'astro-agent-ready/llms-route',
      });
      expect(injectRoute).toHaveBeenCalledWith({
        pattern: '/llms-full.txt',
        entrypoint: 'astro-agent-ready/llms-full-route',
      });
      expect(addMiddleware).toHaveBeenCalledWith({
        entrypoint: 'astro-agent-ready/middleware',
        order: 'pre',
      });
      expect(logger.info).toHaveBeenCalledWith(expect.stringContaining('Detected SSR output mode'));

      expect(capturedPlugins).toHaveLength(1);
      const plugin = capturedPlugins[0];
      expect(plugin.resolveId('virtual:astro-agent-ready/config')).toBe(
        '\0virtual:astro-agent-ready/config',
      );
      expect(plugin.resolveId('unrelated-id')).toBeUndefined();

      const loaded = plugin.load('\0virtual:astro-agent-ready/config');
      expect(loaded).toContain('export const agentReadyOptions =');
      expect(loaded).toContain('llms-sources.ts');
      expect(loaded).toContain('export const dynamicSources =');
      expect(plugin.load('unrelated-id')).toBeUndefined();

      // Verify astro:build:done is a no-op in SSR mode
      const distDir = path.join(tempDir, 'dist-ssr');
      fs.mkdirSync(distDir, { recursive: true });
      const buildDoneHook = integration.hooks['astro:build:done'] as (params: {
        dir: URL;
        logger: AstroIntegrationLogger;
      }) => Promise<void>;

      await buildDoneHook({
        dir: pathToFileURL(`${distDir}/`),
        logger,
      });
      expect(fs.existsSync(path.join(distDir, 'llms.txt'))).toBe(false);
    });

    it('supports ssr: false, ssr.enabled: false, and default empty dynamicSources', () => {
      interface VirtualPlugin {
        name: string;
        resolveId: (id: string) => string | undefined;
        load: (id: string) => string | undefined;
      }

      const injectRouteDisabled = vi.fn();
      const logger: AstroIntegrationLogger = {
        options: { dest: { write: vi.fn() }, level: 'info' },
        label: 'test',
        fork: vi.fn(),
        info: vi.fn(),
        warn: vi.fn(),
        error: vi.fn(),
        debug: vi.fn(),
      };

      const disabledIntegration = agentReady({
        title: 'Disabled SSR',
        description: 'No route',
        ssr: { enabled: false },
      });
      const setupDisabled = disabledIntegration.hooks['astro:config:setup'] as (params: {
        config: Partial<AstroConfig>;
        updateConfig: () => void;
        injectRoute: typeof injectRouteDisabled;
        addMiddleware: () => void;
        logger: AstroIntegrationLogger;
      }) => void;
      setupDisabled({
        config: { output: 'server' },
        updateConfig: vi.fn(),
        injectRoute: injectRouteDisabled,
        addMiddleware: vi.fn(),
        logger,
      });
      expect(injectRouteDisabled).not.toHaveBeenCalled();

      const falseIntegration = agentReady({
        title: 'False SSR',
        description: 'No route',
        ssr: false,
      });
      const setupFalse = falseIntegration.hooks['astro:config:setup'] as typeof setupDisabled;
      setupFalse({
        config: { output: 'server' },
        updateConfig: vi.fn(),
        injectRoute: injectRouteDisabled,
        addMiddleware: vi.fn(),
        logger,
      });
      expect(injectRouteDisabled).not.toHaveBeenCalled();

      // Test SSR without sourcesModule (absolute path fallback not used)
      let pluginsNoSources: VirtualPlugin[] = [];
      const noSourcesIntegration = agentReady({
        title: 'SSR No Sources',
        description: 'Only core pages',
      });
      const setupNoSources = noSourcesIntegration.hooks['astro:config:setup'] as (params: {
        config: Partial<AstroConfig>;
        updateConfig: (cfg: { vite?: { plugins?: VirtualPlugin[] } }) => void;
        injectRoute: typeof injectRouteDisabled;
        addMiddleware: () => void;
        logger: AstroIntegrationLogger;
      }) => void;
      setupNoSources({
        config: { output: 'server' },
        updateConfig: (cfg) => {
          pluginsNoSources = cfg.vite?.plugins || [];
        },
        injectRoute: vi.fn(),
        addMiddleware: vi.fn(),
        logger,
      });

      const loaded = pluginsNoSources[0].load('\0virtual:astro-agent-ready/config');
      expect(loaded).toContain('export const dynamicSources = [];');
    });
  });

  describe('SSR Route Handler (ssr.ts & llms-route.ts)', () => {
    it('creates an APIRoute handler that resolves dynamicSources and normalizes URLs', async () => {
      const { createLlmsTxtRoute } = await import('../src/ssr.js');

      const handler = createLlmsTxtRoute({
        title: 'CMS Blog',
        description: 'Powered by EmDash',
        corePages: [{ title: 'About', path: '/about' }],
        dynamicSources: [
          {
            name: 'articles',
            heading: 'Articles',
            load: async () => [
              {
                slug: '/articles/edge-csp',
                url: '/articles/edge-csp',
                title: 'Edge CSP',
                description: 'Strict CSP on Cloudflare',
                date: '2026-11-11',
              },
            ],
          },
        ],
        ssr: {
          cacheControl: 'public, max-age=600',
          contentType: 'text/markdown; charset=utf-8',
        },
      });

      const response = await handler({
        url: new URL('https://blog.example.com/llms.txt'),
        site: new URL('https://blog.example.com'),
      } as Parameters<typeof handler>[0]);

      expect(response.status).toBe(200);
      expect(response.headers.get('Content-Type')).toBe('text/markdown; charset=utf-8');
      expect(response.headers.get('Cache-Control')).toBe('public, max-age=600');

      const text = await response.text();
      expect(text).toContain('# CMS Blog');
      expect(text).toContain('- [About](https://blog.example.com/about)');
      expect(text).toContain('## Articles');
      expect(text).toContain(
        '- [Edge CSP](https://blog.example.com/articles/edge-csp): Strict CSP on Cloudflare (Published: 2026-11-11)',
      );
    });

    it('falls back to request origin when siteUrl and context.site are omitted', async () => {
      const { createLlmsTxtRoute } = await import('../src/ssr.js');

      const handler = createLlmsTxtRoute({
        title: 'Origin Fallback',
        description: 'No site configured',
        corePages: [{ title: 'Contact', path: '/contact' }],
      });

      const response = await handler({
        url: new URL('https://origin.example.com/llms.txt'),
      } as Parameters<typeof handler>[0]);

      expect(response.headers.get('Content-Type')).toBe('text/plain; charset=utf-8');
      expect(response.headers.get('Cache-Control')).toBe('public, max-age=300, s-maxage=3600');

      const text = await response.text();
      expect(text).toContain('- [Contact](https://origin.example.com/contact)');
    });

    it('executes llms-route GET entrypoint using virtual module config', async () => {
      const { GET } = await import('../src/llms-route.js');

      const response = await GET({
        url: new URL('https://virtual.example.com/llms.txt'),
      } as Parameters<typeof GET>[0]);

      expect(response.status).toBe(200);
      expect(response.headers.get('Cache-Control')).toBe('public, max-age=60');

      const text = await response.text();
      expect(text).toContain('# Virtual SSR Site');
      expect(text).toContain('- [About](https://virtual.example.com/about)');
      expect(text).toContain(
        '- [Hello SSR](https://virtual.example.com/posts/hello): Dynamic post',
      );
    });

    it('supports full dynamic resolveContext(), ETag 304, and CDN-Cache-Control', async () => {
      const { createLlmsTxtRoute } = await import('../src/ssr.js');

      const handler = createLlmsTxtRoute({
        resolveContext: async (siteUrl) => ({
          title: 'Dynamic CMS Title',
          description: 'Hydrated from DB',
          corePages: [{ title: 'Pricing', path: '/pricing' }],
          contact: { email: 'team@cms.dev' },
          sources: [
            {
              heading: 'Guides',
              docs: [
                {
                  slug: '/guides/start',
                  url: `${siteUrl}/guides/start`,
                  title: 'Getting Started',
                  description: 'Quickstart guide',
                },
              ],
            },
          ],
        }),
        ssr: {
          cdnCacheControl: 'max-age=7200',
        },
      });

      const firstRes = await handler({
        url: new URL('https://cms.dev/llms.txt'),
        request: new Request('https://cms.dev/llms.txt'),
      } as Parameters<typeof handler>[0]);

      expect(firstRes.status).toBe(200);
      expect(firstRes.headers.get('CDN-Cache-Control')).toBe('max-age=7200');
      const etag = firstRes.headers.get('ETag');
      expect(etag).toMatch(/^"[0-9a-f]{16}"$/);

      const firstBody = await firstRes.text();
      expect(firstBody).toContain('# Dynamic CMS Title');
      expect(firstBody).toContain('> Hydrated from DB');
      expect(firstBody).toContain('- [Pricing](https://cms.dev/pricing)');
      expect(firstBody).toContain('- [Getting Started](https://cms.dev/guides/start)');
      expect(firstBody).toContain('- **Email:** team@cms.dev');

      // Conditional request with matching ETag returns 304 Not Modified
      const secondRes = await handler({
        url: new URL('https://cms.dev/llms.txt'),
        request: new Request('https://cms.dev/llms.txt', {
          headers: { 'if-none-match': etag ?? '' },
        }),
      } as Parameters<typeof handler>[0]);

      expect(secondRes.status).toBe(304);
      expect(await secondRes.text()).toBe('');
    });

    it('enforces maxDocs and maxTokens guardrails in createLlmsFullTxtRoute and llms-full-route', async () => {
      const { createLlmsFullTxtRoute } = await import('../src/ssr.js');
      const { GET: fullRouteGet } = await import('../src/llms-full-route.js');

      const handler = createLlmsFullTxtRoute({
        title: 'Bounded SSR',
        description: 'Guardrail test',
        dynamicSources: [
          {
            name: 'posts',
            heading: 'Posts',
            load: () => [
              {
                slug: '/p1',
                url: '/p1',
                title: 'Post 1',
                body: 'Short body one.',
              },
              {
                slug: '/p2',
                url: '/p2',
                title: 'Post 2',
                body: 'A'.repeat(2000), // ~500 tokens, exceeds maxTokens: 50
              },
              {
                slug: '/p3',
                url: '/p3',
                title: 'Post 3',
                body: 'Should be skipped by maxDocs/maxTokens',
              },
            ],
          },
        ],
        ssr: {
          full: { enabled: true, maxDocs: 2, maxTokens: 50 },
        },
      });

      const res = await handler({
        url: new URL('https://bounded.dev/llms-full.txt'),
        request: new Request('https://bounded.dev/llms-full.txt'),
      } as Parameters<typeof handler>[0]);

      expect(res.status).toBe(200);
      const text = await res.text();
      expect(text).toContain('# Post 1');
      expect(text).not.toContain('# Post 2');
      expect(text).not.toContain('# Post 3');

      // Test llms-full-route virtual entrypoint
      const virtualFullRes = await fullRouteGet({
        url: new URL('https://virtual.dev/llms-full.txt'),
        request: new Request('https://virtual.dev/llms-full.txt'),
      } as Parameters<typeof fullRouteGet>[0]);
      expect(virtualFullRes.status).toBe(200);
      expect(await virtualFullRes.text()).toContain('Full body for hello post');
    });
  });

  describe('SSR Middleware (.md routes, Accept negotiation & discovery headers)', () => {
    it('serves .md suffix routes and Accept: text/markdown negotiation with ETag/Vary', async () => {
      const { createAgentReadyMiddleware } = await import('../src/middleware.js');

      const middleware = createAgentReadyMiddleware({
        resolveMarkdown: async (pathname) => {
          if (pathname === '/articles/post-1') return '# Post 1\n\nClean markdown.';
          if (pathname === '/') return '# Home\n\nWelcome.';
          return null;
        },
      });

      // 1. .md suffix route
      const mdRes = await middleware(
        {
          url: new URL('https://example.com/articles/post-1.md'),
          request: new Request('https://example.com/articles/post-1.md'),
          locals: {},
        },
        async () => new Response('<html>HTML</html>', { headers: { 'content-type': 'text/html' } }),
      );

      expect(mdRes.status).toBe(200);
      expect(mdRes.headers.get('Content-Type')).toBe('text/markdown; charset=utf-8');
      expect(mdRes.headers.get('Vary')).toBe('Accept');
      expect(mdRes.headers.get('ETag')).toBeTruthy();
      expect(await mdRes.text()).toBe('# Post 1\n\nClean markdown.');

      // 2. /index.md maps to /
      const indexMdRes = await middleware(
        {
          url: new URL('https://example.com/index.md'),
          request: new Request('https://example.com/index.md'),
          locals: {},
        },
        async () => new Response('<html>Home</html>', { headers: { 'content-type': 'text/html' } }),
      );
      expect(await indexMdRes.text()).toBe('# Home\n\nWelcome.');

      // 3. Accept: text/markdown content negotiation
      const negotiatedRes = await middleware(
        {
          url: new URL('https://example.com/articles/post-1'),
          request: new Request('https://example.com/articles/post-1', {
            headers: { Accept: 'text/markdown, text/html;q=0.9' },
          }),
          locals: {},
        },
        async () => new Response('<html>HTML</html>', { headers: { 'content-type': 'text/html' } }),
      );

      expect(negotiatedRes.status).toBe(200);
      expect(negotiatedRes.headers.get('Content-Type')).toBe('text/markdown; charset=utf-8');
      expect(await negotiatedRes.text()).toBe('# Post 1\n\nClean markdown.');

      // 4. Normal HTML request falls through and gets Link discovery + Vary: Accept headers
      const htmlRes = await middleware(
        {
          url: new URL('https://example.com/articles/post-1'),
          request: new Request('https://example.com/articles/post-1', {
            headers: { Accept: 'text/html' },
          }),
          locals: {},
        },
        async () =>
          new Response('<html><body>Hello</body></html>', {
            headers: {
              'content-type': 'text/html; charset=utf-8',
              Link: '</feed.xml>; rel="alternate"',
              Vary: 'Accept-Encoding',
            },
          }),
      );

      expect(htmlRes.headers.get('Link')).toBe(
        '</feed.xml>; rel="alternate", </llms.txt>; rel="alternate"; type="text/markdown"',
      );
      expect(htmlRes.headers.get('Vary')).toBe('Accept-Encoding, Accept');

      // 5. Unknown .md path falls through to next()
      const notFoundRes = await middleware(
        {
          url: new URL('https://example.com/unknown.md'),
          request: new Request('https://example.com/unknown.md'),
          locals: {},
        },
        async () => new Response('Not Found', { status: 404 }),
      );
      expect(notFoundRes.status).toBe(404);
    });

    it('executes onRequest middleware entrypoint via virtual config', async () => {
      const { onRequest } = await import('../src/middleware.js');

      const mdRes = await onRequest(
        {
          url: new URL('https://virtual.example.com/posts/hello.md'),
          request: new Request('https://virtual.example.com/posts/hello.md'),
          locals: {},
        },
        async () => new Response('<html>Fallback</html>'),
      );

      expect(mdRes.status).toBe(200);
      expect(mdRes.headers.get('Content-Type')).toBe('text/markdown; charset=utf-8');
      expect(await mdRes.text()).toContain('# Hello SSR');
    });
  });
});
