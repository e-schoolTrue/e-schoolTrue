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
    on(channel: string, listener: (event: Electron.IpcRendererEvent, ...args: any[]) => void): void;
    off(channel: string, listener: (event: Electron.IpcRendererEvent, ...args: any[]) => void): void;
    send(channel: string, ...args: any[]): Promise<void>;
    invoke(channel: string, ...args: any[]): Promise<any>;
  }
}
