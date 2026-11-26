/** Each tab keeps its workspace; guest data is never moved or deleted by login. */
export const WORKSPACE_KEY='ritmo.workspace.v1';
export function workspace():string {try{return sessionStorage.getItem(WORKSPACE_KEY)||'guest';}catch{return 'guest';}}
export function physicalKey(key:string,owner=workspace()):string {return owner==='guest'?key:`ritmo.account.${owner}.${key}`;}
export const appStorage={
 getItem(key:string){return localStorage.getItem(physicalKey(key));},
 setItem(key:string,value:string){const keyName=physicalKey(key);if(localStorage.getItem(keyName)===value)return;localStorage.setItem(keyName,value);if(!key.endsWith('.previous'))window.dispatchEvent(new Event('ritmo-data-change'));},
 removeItem(key:string){const keyName=physicalKey(key);if(localStorage.getItem(keyName)===null)return;localStorage.removeItem(keyName);window.dispatchEvent(new Event('ritmo-data-change'));}
};
export function selectWorkspace(owner:string){if(owner!=='guest'&&!/^[a-f0-9-]{36}$/.test(owner))throw Error('Conta inválida.');sessionStorage.setItem(WORKSPACE_KEY,owner);}
