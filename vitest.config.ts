import { defineConfig, mergeConfig } from 'vitest/config'
import viteConfig from './vite.config'

export default mergeConfig(viteConfig, defineConfig({
  test: {
    environment: 'jsdom',
    // Process CSS so element-plus CSS imports don't crash the test runner
    css: true,
    globals: true,
    server: {
      deps: {
        inline: ['element-plus'],
      },
    },
  },
}))
