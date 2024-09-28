// @ts-nocheck
import {createApp} from 'vue'
import '@/style.css'
import App from '@/App.vue'
import {router} from "@/routes";
import {ElMessageBox} from "element-plus";
import supabase from "@/data-source.ts";


import fr from 'element-plus/es/locale/lang/fr'





createApp(App).use({locale: fr}).use(router).mount('#app').$nextTick(() => {
  // Use contextBridge
})
