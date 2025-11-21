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

// Définir les interfaces pour les événements de mise à jour
interface UpdateInfo {
  version: string;
  releaseNotes?: string;
  releaseDate?: string;
  downloaded?: boolean;
}

interface DownloadProgress {
  percent: number;
  bytesPerSecond: number;
  total: number;
  transferred: number;
}


interface IpcRenderer {
  on(channel: string, listener: (event: Electron.IpcRendererEvent, ...args: any[]) => void): void;
  off(channel: string, listener: (event: Electron.IpcRendererEvent, ...args: any[]) => void): void;
  send(channel: string, ...args: any[]): Promise<void>;
  invoke(channel: string, ...args: any[]): Promise<any>;
}

interface ElectronAPI {
  isElectron: boolean;
  print: (options: any) => Promise<boolean>;
  printStudentCards: (data: any) => Promise<any>;
  showItemInFolder: (filePath: string) => Promise<boolean>;
  autoUpdater: {
    checkForUpdates(): Promise<{updateInfo: UpdateInfo}>;
    downloadUpdate(): Promise<void>;
    installUpdate(): Promise<void>;
    onUpdateAvailable(callback: (info: UpdateInfo) => void): () => void;
    onUpdateDownloaded(callback: (info: UpdateInfo) => void): () => void;
    onDownloadProgress(callback: (progress: DownloadProgress) => void): () => void;
    onError(callback: (error: Error) => void): () => void;
  };
}

declare global {
  interface Window {
    ipcRenderer: IpcRenderer;
    electronAPI: ElectronAPI;
    documentContent: {
      get: () => Promise<{ success: boolean; data: import('../../electron/backend/entities/documentContent').DocumentContentEntity }>;
      update: (data: Partial<import('../../electron/backend/entities/documentContent').DocumentContentEntity>) => Promise<{ success: boolean; data: import('../../electron/backend/entities/documentContent').DocumentContentEntity }>;
    };
  }
}
export {}; 
