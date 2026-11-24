import {Injectable,signal,inject,DestroyRef} from '@angular/core';
import {PlanningStore} from './planning.store';
import {buildGuidedProgram} from './guided';
import {validateProgram} from './planning';
import type {Program} from './planning';
import {uid} from './training';
import {localDateKey,dateOrdinal,validateActiveCycle} from './active-cycle';
import type {ActiveCycle} from './active-cycle';
@Injectable({providedIn:'root'})
export class ActiveCycleStore {
 private readonly planning=inject(PlanningStore);private readonly key='ritmo.active-cycle.v1';private raw:string|null=null;private unreadable=false;
 readonly active=signal<ActiveCycle|null>(null);readonly error=signal('');readonly today=signal(localDateKey());
 constructor(){try{this.raw=localStorage.getItem(this.key);if(this.raw)this.active.set(validateActiveCycle(JSON.parse(this.raw)));}catch{this.unreadable=true;this.error.set('Não foi possível ler o ciclo ativo. O conteúdo original foi preservado.');}
 const refresh=()=>{try{const stored=localStorage.getItem(this.key);if(stored!==this.raw)this.reload(stored);}catch{this.error.set('Armazenamento do ciclo indisponível. As alterações podem não ser preservadas.');}this.refreshDate();};const changed=(event:StorageEvent)=>{if(event.key===this.key)this.reload(event.newValue);};window.addEventListener('storage',changed);const timer=setInterval(refresh,30000);window.addEventListener('focus',refresh);document.addEventListener('visibilitychange',refresh);
 inject(DestroyRef).onDestroy(()=>{clearInterval(timer);window.removeEventListener('storage',changed);window.removeEventListener('focus',refresh);document.removeEventListener('visibilitychange',refresh);});}
 private reload(raw:string|null){this.raw=raw;try{this.active.set(raw?validateActiveCycle(JSON.parse(raw)):null);this.unreadable=false;this.error.set('');}catch{this.active.set(null);this.unreadable=true;this.error.set('Não foi possível ler o ciclo ativo. O conteúdo original foi preservado.');}}
 refreshDate(){this.today.set(localDateKey());}
 activate(source:Program,startDate:string):ActiveCycle {dateOrdinal(startDate);this.assertWritable();if(this.planning.editorDirty()&&this.planning.editorDraft()?.id===source.id)throw Error('Salve ou cancele a edição desse planejamento antes de ativar.');let draft=structuredClone(source);draft.startDate=startDate;if(draft.guided)draft=buildGuidedProgram(draft);validateProgram(draft);const saved=this.planning.save(draft),previous=this.active();const cycle:ActiveCycle={kind:'activeCycle',schemaVersion:1,id:previous?.programId===saved.id&&previous.startDate===startDate?previous.id:uid(),programId:saved.id,programRevision:saved.revision,startDate,program:structuredClone(saved)};this.write(validateActiveCycle(cycle));this.refreshDate();return cycle;}
 deactivate(){this.assertWritable();this.write(null);}
 private assertWritable(){if(this.unreadable)throw Error(this.error());if(localStorage.getItem(this.key)!==this.raw)throw Error('Outra aba mudou o ciclo ativo. Recarregue antes de alterar a ativação.');}
 private write(cycle:ActiveCycle|null){const encoded=cycle?JSON.stringify(cycle):null;if(encoded&&new TextEncoder().encode(encoded).length>5000000)throw Error('Ciclo maior que 5 MB.');if(this.raw)localStorage.setItem(this.key+'.previous',this.raw);if(encoded===null)localStorage.removeItem(this.key);else localStorage.setItem(this.key,encoded);this.raw=encoded;this.active.set(cycle);this.error.set('');}
 exportRaw(){return this.raw??'null';}
}
