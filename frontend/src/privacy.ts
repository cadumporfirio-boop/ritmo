/** Never touch another account, a portfolio project, or unrelated browser storage. */
export function accountKeys(storage:Storage,id:string):string[]{if(!/^[a-f0-9-]{36}$/.test(id))throw Error('Conta inválida.');const prefix='ritmo.account.'+id+'.';return Array.from({length:storage.length},(_,i)=>storage.key(i)).filter((key):key is string=>!!key&&key.startsWith(prefix));}
export function eraseAccountCache(storage:Storage,id:string){for(const key of accountKeys(storage,id))storage.removeItem(key);}
/** Guest copies survive migration; removing these is an additional explicit choice. */
export function eraseGuestCache(storage:Storage){const exact=['ritmo.v1','ritmo.portfolio.beta.v2','ritmo.training.v2','ritmo.planning.v1','ritmo.active-cycle.v1','ritmo.sync.v1','ritmo.before-cloud.v1'];for(const key of exact){storage.removeItem(key);storage.removeItem(key+'.previous');}}
export function downloadJson(value:unknown,name:string){const link=document.createElement('a');const url=URL.createObjectURL(new Blob([JSON.stringify(value,null,2)],{type:'application/json'}));link.href=url;link.download=name;link.click();setTimeout(()=>URL.revokeObjectURL(url),500);}
