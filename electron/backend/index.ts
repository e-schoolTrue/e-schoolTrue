import "reflect-metadata";
import {contextBridge} from "electron";


// --------- Expose some API to the Renderer process ---------
contextBridge.exposeInMainWorld('backend', {
    async initDb(){
    }
})