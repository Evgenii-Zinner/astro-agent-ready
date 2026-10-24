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
---
<ArticleLayout title={title}>
  <h2>Main Section</h2>
  <p>This is the article content body.</p>
</ArticleLayout>
`;
      const parsed = parseAstroFile(content);
      expect(parsed.metadata.title).toBe('Astro Article Title');
      expect(parsed.metadata.description).toBe('Astro article description');
      expect(parsed.metadata.date).toBe('2026-10-24');
      expect(parsed.metadata.tag).toBe('Systems');
      expect(parsed.metadata.tags).toEqual(['Edge', 'Astro']);
      expect(parsed.body).toContain('<h2>Main Section</h2>');
      expect(parsed.body).not.toContain('<ArticleLayout');
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
  });
});
