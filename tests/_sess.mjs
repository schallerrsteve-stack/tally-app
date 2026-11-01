import { createClient } from '@supabase/supabase-js';
import fs from 'fs';
const u=JSON.parse(fs.readFileSync('/tmp/live_users.json'));
const out={};
for(const i of [0,2]){const c=createClient('https://rwodweszrlvjgxgtpvxz.supabase.co','sb_publishable_QWCFBPRNjno3sVLe37CuSg_eDXZsJvZ',{auth:{persistSession:false}});
 const {data,error}=await c.auth.signInWithPassword({email:u.emails[i],password:u.password});if(error)throw error;out[i===0?'alice':'carol']=data.session;}
fs.writeFileSync('/tmp/sessions.json',JSON.stringify(out));console.log('ok');
