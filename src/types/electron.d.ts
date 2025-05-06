interface ElectronAPI {
  isElectron: boolean;
  print: (options: any) => Promise<boolean>;
  printStudentCards: (data: any) => Promise<boolean>;
}

declare global {
  interface Window {
    electronAPI?: ElectronAPI;
    ipcRenderer: any;
  }
}

export {}; 