export interface DeleteDependencies {
 user(token:string):Promise<{id:string;email?:string;last_sign_in_at?:string}|null>;
 prepare(id:string):Promise<string>;
 erase(id:string,token:string):Promise<void>;
 complete(id:string):Promise<void>;
 now?:()=>number;
}
/** Server derives the subject exclusively from verified Auth, never from the body. */
export function deleteAccountHandler(deps:DeleteDependencies){return async(req:Request):Promise<Response>=>{
 const origin=req.headers.get('origin');const allowed='https://cadumporfirio-boop.github.io';
 const headers:Record<string,string>={'Content-Type':'application/json','Cache-Control':'no-store','Vary':'Origin','Access-Control-Allow-Methods':'POST, OPTIONS','Access-Control-Allow-Headers':'authorization, apikey, content-type, x-client-info'};
 if(origin===allowed)headers['Access-Control-Allow-Origin']=origin;
 const reply=(data:unknown,status=200)=>new Response(JSON.stringify(data),{status,headers});
 if(origin&&origin!==allowed)return reply({message:'Origem não permitida.'},403);
 if(req.method==='OPTIONS')return new Response(null,{status:204,headers});
 if(req.method!=='POST')return reply({message:'Método não permitido.'},405);
 const auth=req.headers.get('authorization')??'';if(!/^Bearer \S+$/i.test(auth))return reply({message:'Entre novamente na conta.'},401);
 if(Number(req.headers.get('content-length')??0)>1000)return reply({message:'Pedido inválido.'},400);
 try{
  const token=auth.slice(7);const user=await deps.user(token);if(!user)return reply({message:'Entre novamente na conta.'},401);
  const text=await req.text();if(text.length>1000)return reply({message:'Pedido inválido.'},400);
  let body:Record<string,unknown>;try{body=JSON.parse(text);}catch{return reply({message:'Pedido inválido.'},400);}
  if(!body||Array.isArray(body)||typeof body!=='object'||Object.keys(body).some(key=>!['confirmation','email'].includes(key))||body.confirmation!=='EXCLUIR'||typeof body.email!=='string'||body.email.trim().toLowerCase()!==user.email?.toLowerCase())return reply({message:'Confira o e-mail e a confirmação de exclusão.'},400);
  const elapsed=(deps.now?.()??Date.now())-Date.parse(user.last_sign_in_at??'');
  if(!Number.isFinite(elapsed)||elapsed<0||elapsed>300000)return reply({message:'Confirme sua senha novamente para excluir.',code:'REAUTH_REQUIRED'},403);
  const receipt=await deps.prepare(user.id);
  await deps.erase(user.id,token);
  // An interrupted ledger update must not turn an already successful deletion into a retry.
  let ledgerPending=false;try{await deps.complete(user.id);}catch{ledgerPending=true;}
  return reply({deleted:true,receipt,ledgerPending});
 }catch{return reply({message:'Não foi possível confirmar a exclusão. Seus dados não serão considerados apagados sem confirmação. Tente entrar novamente para conferir.'},503);}
};}
