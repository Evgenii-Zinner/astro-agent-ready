import * as fs from 'node:fs';
import * as path from 'node:path';
import { fileURLToPath } from 'node:url';
import type { AstroConfig, AstroIntegration, AstroIntegrationLogger } from 'astro';
import { generateLlmsFullTxt, generateLlmsTxt } from './formatter.js';
import { scanSourceDirectory } from './scanner.js';
import { estimateTokenCount, formatTokens } from './tokens.js';
import type { AgentReadyOptions, ContentDocument, SourceConfig } from './types.js';

export * from './formatter.js';
export * from './parser.js';
export * from './scanner.js';
export * from './tokens.js';
export * from './types.js';

/**
 * Creates the astro-agent-ready integration for Astro.
 * Automatically generates spec-compliant /llms.txt and /llms-full.txt files
 * from Content Collections, pages directories, and configured core pages.
 *
 * @param options - Configuration options for agent readiness.
 * @returns AstroIntegration object.
 */
export function agentReady(options: AgentReadyOptions): AstroIntegration {
  let projectRoot = process.cwd();
  let resolvedSiteUrl = options.siteUrl || '';

  return {
    name: 'astro-agent-ready',
    hooks: {
      'astro:config:setup': ({ config }: { config: AstroConfig }) => {
        if (config.root) {
          projectRoot = fileURLToPath(config.root);
        }
        if (!resolvedSiteUrl && config.site) {
          resolvedSiteUrl = config.site;
        }
      },

      'astro:build:done': async ({ dir, logger }: { dir: URL; logger: AstroIntegrationLogger }) => {
        const outDir = fileURLToPath(dir);
        const resolvedOptions: AgentReadyOptions = {
          ...options,
          siteUrl: resolvedSiteUrl,
        };

        const sources = resolvedOptions.sources || [];
        const sourceResults = new Map<SourceConfig, ContentDocument[]>();

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

        // 2. Generate /llms-full.txt if enabled
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
