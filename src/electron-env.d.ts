 // @ts-nocheck
/// <reference types="vite-plugin-electron/electron-env" />

declare namespace NodeJS {
    interface ProcessEnv {
      /**
       * The built directory structure
       *
       * ```tree
       * ├─┬─┬ dist
       * │ │ └── index.html
       * │ │
       * │ ├─┬ dist-electron
       * │ │ ├── main.js
       * │ │ └── preload.js
       * │
       * ```
       */
      DIST: string
      /** /dist/ or /public/ */
      VITE_PUBLIC: string
    }
  }
  
  // Used in Renderer process, expose in `preload.ts`
  interface Window {
    ipcRenderer: {
      invoke(channel: string, ...args: any[]): Promise<any>;
      // Ajoutez d'autres méthodes d'ipcRenderer si nécessaire
    };
  }
