// @ts-nocheck
import {createMemoryHistory , createRouter} from 'vue-router'
import HomeView from "@/views/HomeView.vue";
import {fileRoutes} from "@/routes/file.ts";
import {studentRoutes} from "@/routes/student.ts";


const routes = [
    {
        path : "/" ,
        name : "dashboard" ,
        component : HomeView ,
        children:[
            ...fileRoutes,
            ...studentRoutes
        ]
    }
]



const router = createRouter({
    history : createMemoryHistory() ,
    routes : routes
})


export {router}