// @ts-nocheck

import {createClient, SupabaseClient} from '@supabase/supabase-js'

let supabase : SupabaseClient<any, "public", any> ;
if(process.env.NODE_ENV !== "production"){
    console.log("database : " , import.meta.env.VITE_SUPABASE_URL)
    supabase = createClient(import.meta.env.VITE_SUPABASE_URL, import.meta.env.VITE_SUPABASE_KEY );
}else{
    console.log("database : " , import.meta.env.VITE_SUPABASE_URL)
    //if(!supabase){
        supabase = createClient(import.meta.env.VITE_SUPABASE_URL, import.meta.env.VITE_SUPABASE_KEY);
    //}
}


export default supabase ;

