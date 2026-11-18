import {Injectable,signal} from '@angular/core';
import {blankLibrary,parseTraining,saveRevision,startStructured,latestWorkouts} from './training';
import type {TrainingLibrary,Workout,TrainingSession} from './training';

@Injectable({providedIn:'root'})
export class TrainingStore {
 readonly data=signal<TrainingLibrary>(blankLibrary());
 readonly error=signal('');
 readonly screen=signal<'library'|'edit'|'run'|'detail'>('library');
 readonly selected=signal<TrainingSession|null>(null);
 private readonly key='ritmo.training.v2';
 private raw:string|null=null;
 private blocked=false;
 private unreadable=false;
 constructor(){
  try{this.raw=localStorage.getItem(this.key);if(this.raw)this.data.set(parseTraining<TrainingLibrary>(JSON.parse(this.raw),'library'));}
  catch{this.blocked=true;this.unreadable=true;this.error.set('Não foi possível ler a biblioteca. O conteúdo original foi preservado. Exporte uma cópia antes de restaurar.');}
 }
 touch():void {
  this.data.update(data=>({...data}));
  if(this.blocked)return;
  try{
   const checked=parseTraining<TrainingLibrary>(this.data(),'library');
   if(localStorage.getItem(this.key)!==this.raw){this.blocked=true;throw Error('Outra aba alterou a biblioteca. Exporte esta sessão e recarregue antes de continuar.');}
   const serialized=JSON.stringify(checked);
   if(this.raw)localStorage.setItem(this.key+'.previous',this.raw);
   localStorage.setItem(this.key,serialized);this.raw=serialized;this.error.set('');
  }catch(error){this.error.set(error instanceof Error?error.message:'Não foi possível salvar. Exporte uma cópia.');}
 }
 save(plan:Workout):Workout {if(this.blocked)throw Error(this.error()||'Restaure uma cópia válida antes de salvar.');const saved=saveRevision(this.data(),plan);this.touch();if(this.error())throw Error(this.error());return saved;}
 startPlanned(plan:Workout,origin:NonNullable<TrainingSession['planning']>):void {if(this.blocked||this.error())throw Error(this.error()||'Armazenamento indisponível.');if(this.data().active)throw Error('Finalize a sessão em andamento antes de iniciar a planejada.');const previous=this.data();this.data.set({...previous,active:{...startStructured(plan),planning:structuredClone(origin)}});this.touch();if(this.error()){this.data.set(previous);throw Error(this.error());}this.screen.set('run');}
 start(id:string):void {
  if(this.data().active){this.screen.set('run');return;}
  const plan=latestWorkouts(this.data()).find(item=>item.id===id);
  if(!plan)throw Error('Ficha não encontrada.');
  this.data().active=startStructured(plan);this.touch();this.screen.set('run');
 }
 finish():void {
  const active=this.data().active;if(!active)return;
  if(this.data().sessions.length>=500)throw Error('Limite de sessões atingido. Exporte sua biblioteca.');
  const saved=parseTraining<TrainingSession>({...active,completed:true},'session');
  this.data().sessions.push(saved);this.data().active=null;this.touch();this.screen.set('library');
 }
 restore(raw:unknown):void {
  const checked=parseTraining<TrainingLibrary>(raw,'library');
  const previous=localStorage.getItem(this.key);
  const serialized=JSON.stringify(checked);
  if(previous)localStorage.setItem(this.key+'.previous',previous);
  localStorage.setItem(this.key,serialized);this.raw=serialized;this.blocked=false;this.unreadable=false;this.error.set('');this.data.set(checked);this.screen.set('library');
 }
 exportRaw():string{return this.unreadable&&this.raw?this.raw:JSON.stringify(this.data(),null,2);}
}
