import {contextBridge} from "electron";
import {testDb} from "./services/photo.service.ts";

// --------- Expose some API to the Renderer process ---------
contextBridge.exposeInMainWorld('backend', {
    async initDb(){
    },
    testDb
})