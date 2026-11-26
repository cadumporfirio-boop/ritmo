import {restore} from './domain.ts';
import type {State} from './domain.ts';
import {parseTraining} from './training.ts';
import type {TrainingLibrary} from './training.ts';
import {validateProgram} from './planning.ts';
import type {Program} from './planning.ts';
import {validateActiveCycle} from './active-cycle.ts';
import type {ActiveCycle} from './active-cycle.ts';
export interface CloudSnapshot {kind:'ritmoBackup';schemaVersion:1;legacy:State|null;training:TrainingLibrary|null;planning:Program[];cycle:ActiveCycle|null}
export interface KeyStorage {getItem(key:string):string|null;setItem(key:string,value:string):void;removeItem(key:string):void}
export const LEGACY_KEY='ritmo.v1';
export function validateSnapshot(raw:unknown):CloudSnapshot {
 if(!raw||typeof raw!=='object'||Array.isArray(raw))throw Error('Cópia da conta inválida.');const data=raw as CloudSnapshot;
 if(data.kind!=='ritmoBackup'||data.schemaVersion!==1||Object.keys(data).some(key=>!['kind','schemaVersion','legacy','training','planning','cycle'].includes(key))||!Array.isArray(data.planning)||data.planning.length>100)throw Error('Cópia da conta incompatível.');
 if(new TextEncoder().encode(JSON.stringify(data)).length>8000000)throw Error('Cópia maior que 8 MB. Exporte os dados para revisão.');
 if(data.legacy!==null)restore(JSON.stringify(data.legacy));if(data.training!==null)parseTraining(data.training,'library');const seen=new Set<string>();for(const rawPlan of data.planning){const plan=validateProgram(rawPlan),key=plan.id+':'+plan.revision;if(seen.has(key))throw Error('Versões de planejamento repetidas.');seen.add(key);}if(data.cycle!==null)validateActiveCycle(data.cycle);return structuredClone(data);
}
export function readSnapshot(storage:KeyStorage):CloudSnapshot {const read=(key:string)=>{const value=storage.getItem(key);return value===null?null:JSON.parse(value);};return validateSnapshot({kind:'ritmoBackup',schemaVersion:1,legacy:read(LEGACY_KEY),training:read('ritmo.training.v2'),planning:read('ritmo.planning.v1')??[],cycle:read('ritmo.active-cycle.v1')});}
export function applySnapshot(storage:KeyStorage,raw:unknown){const data=validateSnapshot(raw),values:Record<string,unknown>={[LEGACY_KEY]:data.legacy,'ritmo.training.v2':data.training,'ritmo.planning.v1':data.planning,'ritmo.active-cycle.v1':data.cycle};const previous=Object.fromEntries(Object.keys(values).map(key=>[key,storage.getItem(key)]));storage.setItem('ritmo.before-cloud.v1',JSON.stringify(previous));try{for(const [key,value] of Object.entries(values))if(value===null)storage.removeItem(key);else storage.setItem(key,JSON.stringify(value));}catch(error){for(const [key,value] of Object.entries(previous))try{if(value===null)storage.removeItem(key);else storage.setItem(key,value);}catch{}throw error;}}
export function snapshotSummary(data:CloudSnapshot){return {workouts:data.training?.workouts.length??0,sessions:(data.training?.sessions.length??0)+(data.legacy?.sessions.length??0),plans:new Set(data.planning.map(plan=>plan.id)).size,ongoing:!!(data.training?.active||data.legacy?.active)};}
export function syncDecision(local:string,base:string|null,remote:string|null):'same'|'upload'|'download'|'conflict' {if(remote===local)return 'same';if(base===null)return remote===null?'upload':'conflict';if(local===base)return 'download';if(remote===base)return 'upload';return 'conflict';}
/** Stable across Postgres jsonb key ordering. */
export function snapshotText(value:unknown):string {return JSON.stringify(value,(_key,item)=>item&&typeof item==='object'&&!Array.isArray(item)?Object.fromEntries(Object.keys(item).sort().map(key=>[key,item[key]])):item);}
