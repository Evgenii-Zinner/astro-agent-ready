import type { APIRoute } from 'astro';
import { createLlmsTxtRoute, createVirtualLlmsRoute } from './ssr.js';

/**
 * Standard Astro SSR route entrypoint for `/llms.txt` registered via `injectRoute()`.
 */
export const GET: APIRoute = createVirtualLlmsRoute(createLlmsTxtRoute);
