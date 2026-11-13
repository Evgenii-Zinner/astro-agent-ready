import type { APIRoute } from 'astro';
import { createLlmsTxtRoute } from './ssr.js';
import type {
  AgentReadyContextResolver,
  AgentReadyOptions,
  DynamicSourceConfig,
  SsrAgentReadyOptions,
} from './types.js';

interface VirtualConfigModule {
  agentReadyOptions?: AgentReadyOptions;
  ssrOptions?: SsrAgentReadyOptions;
  dynamicSources?: DynamicSourceConfig[];
  resolveContext?: AgentReadyContextResolver;
}

let cachedHandler: APIRoute | null = null;

/**
 * Standard Astro SSR route entrypoint for `/llms.txt` registered via `injectRoute()`.
 * Lazily resolves configuration and optional dynamic CMS loaders from `virtual:astro-agent-ready/config`.
 */
export const GET: APIRoute = async (context) => {
  if (!cachedHandler) {
    let config: VirtualConfigModule = {};
    try {
      config = await import('virtual:astro-agent-ready/config');
    } catch {
      // Virtual module not available (e.g., direct import outside Vite)
    }

    const baseOptions: AgentReadyOptions = config.agentReadyOptions ?? {};

    cachedHandler = createLlmsTxtRoute({
      ...baseOptions,
      ssr: config.ssrOptions ?? baseOptions.ssr,
      dynamicSources: config.dynamicSources ?? baseOptions.dynamicSources,
      resolveContext: config.resolveContext ?? baseOptions.resolveContext,
    });
  }

  return cachedHandler(context);
};
