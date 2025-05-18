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
  resolve : {
    alias: {
      "@": path.resolve('src'),
      "#electron":path.resolve('electron'),
      "#app":path.resolve('.'),
    }
  } ,
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
            alias: {
              "#electron":path.resolve('electron'),
              "#app":path.resolve('.'),
            }
          },
          build:{
            rollupOptions:{
              external:["typeorm", "electron-print-preview", "typeorm"]
            }
          }
        }
      },
      preload: {
       
        input: path.join(__dirname, 'electron/preload.ts'),
      },
      
      renderer: {
      },
    }),
  
  ],

  worker: {
    format: 'es', // ou 'esm'
  
  }
})
