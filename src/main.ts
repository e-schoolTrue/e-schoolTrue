import { createApp } from 'vue'
import { createPinia } from 'pinia'
import App from './App.vue'
import ElementPlus from 'element-plus'
import 'element-plus/dist/index.css'
import '@/style.css'
import { router } from "@/routes";
import fr from 'element-plus/es/locale/lang/fr'
import '@iconify/vue';
import './plugins/iconify';
import { Icon } from '@iconify/vue'

const app = createApp(App)
const pinia = createPinia()

app.use(pinia)
app.use(ElementPlus, { locale: fr })
app.use(router)
app.component('Icon', Icon);
app.mount('#app')
