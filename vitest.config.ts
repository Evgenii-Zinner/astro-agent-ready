import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    coverage: {
      provider: 'v8',
      include: ['src/**/*.ts'],
      reporter: ['text', 'json', 'html', 'lcov'],
      exclude: ['src/types.ts', 'src/virtual.d.ts'],
    },
  },
  plugins: [
    {
      name: 'virtual-astro-agent-ready-config',
      resolveId(id) {
        if (id === 'virtual:astro-agent-ready/config') {
          return '\0virtual:astro-agent-ready/config';
        }
      },
      load(id) {
        if (id === '\0virtual:astro-agent-ready/config') {
          return `
            export const agentReadyOptions = {
              title: 'Virtual SSR Site',
              description: 'Loaded from virtual module',
              corePages: [{ title: 'About', path: '/about' }],
            };
            export const ssrOptions = { cacheControl: 'public, max-age=60' };
            export const dynamicSources = [
              {
                name: 'posts',
                heading: 'Posts',
                load: async (siteUrl) => [
                  {
                    slug: '/posts/hello',
                    url: siteUrl + '/posts/hello',
                    title: 'Hello SSR',
                    description: 'Dynamic post',
                    body: 'Full body for hello post',
                  },
                ],
              },
            ];
            export const resolveContext = undefined;
            export const resolveMarkdown = async (pathname) => {
              if (pathname === '/posts/hello') {
                return '# Hello SSR\\n\\nMarkdown body';
              }
              return null;
            };
          `;
        }
      },
    },
  ],
});
