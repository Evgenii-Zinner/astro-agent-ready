import * as fs from 'node:fs';
import * as path from 'node:path';
import { fileURLToPath } from 'node:url';
import type { AstroIntegration } from 'astro';
import { generateLlmsFullTxt, generateLlmsTxt } from './formatter.js';
import { scanSourceDirectory } from './scanner.js';
import { resolveSsrFullSettings } from './ssr.js';
import { estimateTokenCount, formatTokens } from './tokens.js';
import type {
  AgentReadyOptions,
  ContentDocument,
  LlmsSectionSource,
  SsrAgentReadyOptions,
} from './types.js';

export * from './formatter.js';
export * from './middleware.js';
export * from './parser.js';
export * from './scanner.js';
export * from './ssr.js';
export * from './tokens.js';
export * from './types.js';

const VIRTUAL_CONFIG_ID = 'virtual:astro-agent-ready/config';
const RESOLVED_VIRTUAL_CONFIG_ID = `\0${VIRTUAL_CONFIG_ID}`;

/**
 * Resolves the SSR configuration option, returning `false` when explicitly disabled.
 */
function resolveSsrOption(
  option: boolean | SsrAgentReadyOptions | undefined,
): SsrAgentReadyOptions | false {
  if (option === false) return false;
  if (typeof option === 'object' && option !== null) {
    if (option.enabled === false) {
      return false;
    }
    return option;
  }
  return {};
}

/**
 * Builds the virtual module source code exposing serializable config and optional dynamic loaders.
 */
function buildVirtualConfigModule(
  options: AgentReadyOptions,
  ssrOpt: SsrAgentReadyOptions,
  siteUrl: string,
  projectRoot: string,
): string {
  const serializableOptions: Omit<
    AgentReadyOptions,
    'dynamicSources' | 'resolveContext' | 'resolveMarkdown' | 'sources'
  > = {
    siteUrl: siteUrl || undefined,
    title: options.title,
    description: options.description,
    intro: options.intro,
    corePages: options.corePages,
    outputFileName: options.outputFileName,
    fullFileName: options.fullFileName,
    includeInFull: options.includeInFull,
    contact: options.contact,
    customFooter: options.customFooter,
    logStats: options.logStats,
  };

  const lines: string[] = [
    `export const agentReadyOptions = ${JSON.stringify(serializableOptions)};`,
    `export const ssrOptions = ${JSON.stringify(ssrOpt)};`,
  ];

  if (ssrOpt.sourcesModule) {
    const resolvedModulePath = path.isAbsolute(ssrOpt.sourcesModule)
      ? ssrOpt.sourcesModule
      : path.resolve(projectRoot, ssrOpt.sourcesModule);
    lines.push(
      `import * as userSourcesModule from ${JSON.stringify(resolvedModulePath)};`,
      'export const dynamicSources = Array.isArray(userSourcesModule.default) ? userSourcesModule.default : (userSourcesModule.dynamicSources ?? []);',
      'export const resolveContext = userSourcesModule.resolveContext ?? (typeof userSourcesModule.default === "function" ? userSourcesModule.default : undefined);',
      'export const resolveMarkdown = userSourcesModule.resolveMarkdown;',
    );
  } else {
    lines.push(
      'export const dynamicSources = [];',
      'export const resolveContext = undefined;',
      'export const resolveMarkdown = undefined;',
    );
  }

  return lines.join('\n');
}

/**
 * Creates the astro-agent-ready integration for Astro.
 *
 * - **SSR Mode (`output: "server"`)**: Registers `/llms.txt` (and optionally bounded `/llms-full.txt`)
 *   plus middleware for `.md` routes, `Accept: text/markdown` negotiation, `ETag`/cache headers,
 *   and `Link` discovery headers.
 * - **SSG Mode (`output: "static"`)**: Scans local content sources at build time
 *   and emits `/llms.txt` (and optionally `/llms-full.txt`) into `dist/`.
 *
 * @param options - Configuration options for agent readiness.
 * @returns AstroIntegration object.
 */
export function agentReady(options: AgentReadyOptions): AstroIntegration {
  let projectRoot = process.cwd();
  let resolvedSiteUrl = options.siteUrl || '';
  let isSsrActive = false;

  const ssrOpt = resolveSsrOption(options.ssr);

  return {
    name: 'astro-agent-ready',
    hooks: {
      'astro:config:setup': ({ config, updateConfig, injectRoute, addMiddleware, logger }) => {
        if (config.root) {
          projectRoot = fileURLToPath(config.root);
        }
        if (!resolvedSiteUrl && config.site) {
          resolvedSiteUrl = config.site;
        }

        if (config.output === 'server' && ssrOpt !== false) {
          isSsrActive = true;
          const outputFileName = (options.outputFileName || 'llms.txt').replace(/^\/+/, '');
          const fullFileName = (options.fullFileName || 'llms-full.txt').replace(/^\/+/, '');
          const routePattern = `/${outputFileName}`;
          const fullRoutePattern = `/${fullFileName}`;
          const fullSettings = resolveSsrFullSettings(ssrOpt.full);

          logger.info(
            `[astro-agent-ready] Detected SSR output mode. Injecting dynamic ${routePattern} route.`,
          );

          updateConfig({
            vite: {
              plugins: [
                {
                  name: 'astro-agent-ready-virtual-config',
                  resolveId(id: string) {
                    if (id === VIRTUAL_CONFIG_ID) {
                      return RESOLVED_VIRTUAL_CONFIG_ID;
                    }
                    return undefined;
                  },
                  load(id: string) {
                    if (id === RESOLVED_VIRTUAL_CONFIG_ID) {
                      return buildVirtualConfigModule(
                        options,
                        ssrOpt,
                        resolvedSiteUrl,
                        projectRoot,
                      );
                    }
                    return undefined;
                  },
                },
              ],
            },
          });

          injectRoute({
            pattern: routePattern,
            entrypoint: 'astro-agent-ready/llms-route',
          });

          if (fullSettings.enabled) {
            injectRoute({
              pattern: fullRoutePattern,
              entrypoint: 'astro-agent-ready/llms-full-route',
            });
          }

          if (ssrOpt.sourcesModule || ssrOpt.discoveryHeader !== false) {
            addMiddleware({
              entrypoint: 'astro-agent-ready/middleware',
              order: 'pre',
            });
          }
        }
      },

      'astro:build:done': async ({ dir, logger }) => {
        if (isSsrActive) {
          return;
        }

        const outDir = fileURLToPath(dir);
        const resolvedOptions: AgentReadyOptions = {
          ...options,
          siteUrl: resolvedSiteUrl,
        };

        const sources = resolvedOptions.sources || [];
        const sourceResults = new Map<LlmsSectionSource, ContentDocument[]>();

        let totalDocsCount = 0;

        for (const source of sources) {
          const docs = scanSourceDirectory(source, projectRoot, resolvedSiteUrl);
          sourceResults.set(source, docs);
          totalDocsCount += docs.length;
        }

        // 1. Generate /llms.txt
        const outputFileName = resolvedOptions.outputFileName || 'llms.txt';
        const llmsTxtContent = generateLlmsTxt(resolvedOptions, sourceResults);
        const llmsTxtPath = path.join(outDir, outputFileName);

        fs.writeFileSync(llmsTxtPath, llmsTxtContent, 'utf-8');

        const llmsTokens = estimateTokenCount(llmsTxtContent);
        const llmsBytes = Buffer.byteLength(llmsTxtContent, 'utf-8');

        if (resolvedOptions.logStats !== false) {
          logger.info(
            `Generated /${outputFileName} with ${totalDocsCount} documents (${formatTokens(llmsTokens)}, ${(llmsBytes / 1024).toFixed(1)} kB)`,
          );
        }

        // 2. Generate /llms-full.txt if enabled (SSG only)
        if (resolvedOptions.generateFull) {
          const fullFileName = resolvedOptions.fullFileName || 'llms-full.txt';
          const llmsFullContent = generateLlmsFullTxt(resolvedOptions, sourceResults);
          const llmsFullPath = path.join(outDir, fullFileName);

          fs.writeFileSync(llmsFullPath, llmsFullContent, 'utf-8');

          const fullTokens = estimateTokenCount(llmsFullContent);
          const fullBytes = Buffer.byteLength(llmsFullContent, 'utf-8');

          if (resolvedOptions.logStats !== false) {
            logger.info(
              `Generated /${fullFileName} full context (${formatTokens(fullTokens)}, ${(fullBytes / 1024).toFixed(1)} kB)`,
            );
          }
        }
      },
    },
  };
}

export const astroAgentReady = agentReady;
export default agentReady;
