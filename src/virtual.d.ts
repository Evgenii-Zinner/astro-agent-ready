declare module 'virtual:astro-agent-ready/config' {
  import type {
    AgentReadyContextResolver,
    AgentReadyMarkdownResolver,
    AgentReadyOptions,
    DynamicSourceConfig,
    SsrAgentReadyOptions,
  } from './types.js';

  export const agentReadyOptions: AgentReadyOptions | undefined;
  export const ssrOptions: SsrAgentReadyOptions | undefined;
  export const dynamicSources: DynamicSourceConfig[] | undefined;
  export const resolveContext: AgentReadyContextResolver | undefined;
  export const resolveMarkdown: AgentReadyMarkdownResolver | undefined;
}
