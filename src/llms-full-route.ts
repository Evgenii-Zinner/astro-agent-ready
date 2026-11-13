import type { APIRoute } from 'astro';
import { createLlmsFullTxtRoute, createVirtualLlmsRoute } from './ssr.js';

/**
 * Standard Astro SSR route entrypoint for `/llms-full.txt` registered via `injectRoute()`.
 */
export const GET: APIRoute = createVirtualLlmsRoute(createLlmsFullTxtRoute);
