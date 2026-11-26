import {createClient} from '@supabase/supabase-js'
// Public (publishable) values: safe in frontend code. Env vars override them if set.
const u=import.meta.env.VITE_SUPABASE_URL||'https://hzrlheynaxjzenxkqfth.supabase.co'
const k=import.meta.env.VITE_SUPABASE_ANON_KEY||'sb_publishable_o6ZBN_XNPHL2gYHx2nDUaQ_zFA2VJVs'
export const ok=!!(u&&k)
export const sb=createClient(u,k)
export const supaUrl=u,supaKey=k
