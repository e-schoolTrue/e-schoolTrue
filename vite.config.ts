import { defineConfig, type Plugin } from 'vite'
import path from 'node:path'
import electron from 'vite-plugin-electron/simple'
import vue from '@vitejs/plugin-vue'
import AutoImport from 'unplugin-auto-import/vite'
import Components from 'unplugin-vue-components/vite'
import {ElementPlusResolver} from "unplugin-vue-components/resolvers";
import ElementPlus from 'unplugin-element-plus/vite'

function copyTemplates(): Plugin {
  return {
    name: 'copy-templates',
    closeBundle: async () => {
      const fs = await import('fs/promises')
      const srcDir = path.join(__dirname, 'electron/templates')
      const destDir = path.join(__dirname, 'dist-electron/templates')
      try {
        await fs.mkdir(path.dirname(destDir), { recursive: true })
        await fs.cp(srcDir, destDir, { recursive: true })
        console.log('Templates copied successfully')
      } catch (err) {
        console.error('Error copying templates:', err)
      }
    }
  }
}

// https://vitejs.dev/config/
export default defineConfig({
  resolve : {
    alias: {
      "@": path.resolve('src'),
      "#electron":path.resolve('electron'),
      "#app":path.resolve('.'),
    }
  },
  plugins: [
    vue(),
    AutoImport({
      resolvers: [ElementPlusResolver()],
    }),
    Components({
      resolvers: [ElementPlusResolver()],
    }),
    ElementPlus({
      // options
    }),
    electron({
      main: {
        entry: 'electron/main.ts',
        vite:{
          resolve:{
            alias: {
              "#electron":path.resolve('electron'),
              "#app":path.resolve('.'),
            }
          },
          build:{
            rollupOptions:{
              external:["typeorm", "electron-print-preview"]
            }
          }
        }
      },
      preload: {
        input: path.join(__dirname, 'electron/preload.ts'),
      },
      renderer: {},
    }),
    copyTemplates(),
  ],

  worker: {
    format: 'es', // ou 'esm'
  },
  server: {
    proxy: {
      '/updates': {
        target: 'http://localhost:3000',
        changeOrigin: true,
        rewrite: (path) => path.replace(/^\/updates/, '/updates')
      }
    }
  }
})
