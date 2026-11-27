import {createClient} from 'npm:@supabase/supabase-js@2.119.2';
import {deleteAccountHandler} from './handler.ts';
const url=Deno.env.get('SUPABASE_URL')!;
const admin=createClient(url,Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,{auth:{persistSession:false,autoRefreshToken:false}});
async function hash(id:string){return Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256',new TextEncoder().encode(id)))).map(b=>b.toString(16).padStart(2,'0')).join('');}
Deno.serve(deleteAccountHandler({
 async user(token){const {data,error}=await admin.auth.getUser(token);return error?null:data.user;},
 async prepare(id){const subject_hash=await hash(id);const {data:existing,error:readError}=await admin.from('ritmo_erasure_log').select('receipt').eq('subject_hash',subject_hash).maybeSingle();if(readError)throw readError;if(existing)return existing.receipt;const {data,error}=await admin.from('ritmo_erasure_log').insert({subject_hash}).select('receipt').single();if(error)throw error;return data.receipt;},
 async erase(id,token){const {error:revokeError}=await admin.auth.admin.signOut(token,'global');if(revokeError)throw revokeError;const {error}=await admin.auth.admin.deleteUser(id,false);if(error)throw error;},
 async complete(id){const {error}=await admin.from('ritmo_erasure_log').update({completed_at:new Date().toISOString()}).eq('subject_hash',await hash(id));if(error)throw error;}
}));
