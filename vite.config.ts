import { defineConfig } from 'vite'
import path from 'node:path'
import electron from 'vite-plugin-electron/simple'
import vue from '@vitejs/plugin-vue'
import AutoImport from 'unplugin-auto-import/vite'
import Components from 'unplugin-vue-components/vite'
import {ElementPlusResolver} from "unplugin-vue-components/resolvers";
import ElementPlus from 'unplugin-element-plus/vite'

// https://vitejs.dev/config/
export default defineConfig({
  resolve:{
    alias: [
      {find : "@" ,  replacement : path.resolve('./src')},
      {find : "@electron" ,  replacement : path.resolve('./electron')},
      {find : "@app" ,  replacement : path.resolve('.')}
    ]
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
        // Shortcut of `build.lib.entry`.
        entry: 'electron/main.ts',
        vite:{
          resolve:{
            alias: [
              {find : "@" ,  replacement : path.resolve('./src')},
              {find : "@electron" ,  replacement : path.resolve('./electron')},
              {find : "@app" ,  replacement : path.resolve('.')}
            ]
          },
          build:{
            rollupOptions:{
              external:["typeorm" , "better-sqlite3"]
            }
          },
          test:{
            globals:true,
            env:"node"
          }
        }
      },
      preload: {
        // Shortcut of `build.rollupOptions.input`.
        // Preload scripts may contain Web assets, so use the `build.rollupOptions.input` instead `build.lib.entry`.
        input: path.join(__dirname, 'electron/preload.ts'),
        vite:{
          resolve:{
            alias: [
              {find : "@" ,  replacement: path.resolve('./src')},
              {find : "@electron" ,  replacement: path.resolve('./electron')},
              {find : "@app" ,  replacement: path.resolve('.')}
            ]
          },
          test:{
            globals:true,
            env:"node",
          }
        }

      },
      // Ployfill the Electron and Node.js API for Renderer process.
      // If you want use Node.js in Renderer process, the `nodeIntegration` needs to be enabled in the Main process.
      // See 👉 https://github.com/electron-vite/vite-plugin-electron-renderer
      renderer: {},
    }),
    // Supprimez ou commentez cette partie
  ],
  optimizeDeps: {
    include: ['@mdi/js'],
  },
})
