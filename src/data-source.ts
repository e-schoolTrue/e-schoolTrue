// @ts-nocheck

import {createClient, SupabaseClient} from '@supabase/supabase-js'

let supabase : SupabaseClient<any, "public", any> ;
if(process.env.NODE_ENV !== "production"){
    console.log("database : " , import.meta.env.VITE_DATABASE_URL)
    supabase = createClient(import.meta.env.VITE_DATABASE_URL, import.meta.env.VITE_DATABASE_TOKEN );
}else{
    console.log("database : " , import.meta.env.VITE_DATABASE_URL)
    //if(!supabase){
        supabase = createClient(import.meta.env.VITE_DATABASE_URL, import.meta.env.VITE_DATABASE_TOKEN);
    //}
}


export default supabase ;

