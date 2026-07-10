// @ts-check
import { defineConfig } from 'astro/config';

// https://astro.build/config
export default defineConfig({
  site: 'https://crashserver.github.io',
  markdown: {
    shikiConfig: {
      theme: 'github-dark',
    },
  },
});
