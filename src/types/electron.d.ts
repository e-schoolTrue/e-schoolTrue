interface IpcRenderer {
  invoke(channel: string, ...args: any[]): Promise<any>;
  on(channel: string, listener: (...args: any[]) => void): void;
  off(channel: string, listener: (...args: any[]) => void): void;
  send(channel: string, ...args: any[]): void;
}

interface ElectronAPI {
  isElectron: boolean;
  print: (options: any) => Promise<boolean>;
  printStudentCards: (data: any) => Promise<any>;
  showItemInFolder: (filePath: string) => Promise<boolean>;
}

declare global {
  interface Window {
    ipcRenderer: IpcRenderer;
    electronAPI: ElectronAPI;
  }
}

export {}; 