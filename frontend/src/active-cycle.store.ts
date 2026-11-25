import {Injectable,signal,inject,DestroyRef} from '@angular/core';
import {TrainingStore} from './training.store';
import {cycleSession,addCalendarDays,slotDate,slotsOnDate} from './active-cycle';
import {PlanningStore} from './planning.store';
import {buildGuidedProgram} from './guided';
import {validateProgram} from './planning';
import type {Program} from './planning';
import {uid} from './training';
import {localDateKey,dateOrdinal,validateActiveCycle} from './active-cycle';
import type {ActiveCycle} from './active-cycle';
@Injectable({providedIn:'root'})
export class ActiveCycleStore {
 private readonly training=inject(TrainingStore);private readonly planning=inject(PlanningStore);private readonly key='ritmo.active-cycle.v1';private raw:string|null=null;private unreadable=false;
 readonly active=signal<ActiveCycle|null>(null);readonly error=signal('');readonly today=signal(localDateKey());
 constructor(){try{this.raw=localStorage.getItem(this.key);if(this.raw)this.active.set(validateActiveCycle(JSON.parse(this.raw)));}catch{this.unreadable=true;this.error.set('Não foi possível ler o ciclo ativo. O conteúdo original foi preservado.');}
 const refresh=()=>{try{const stored=localStorage.getItem(this.key);if(stored!==this.raw)this.reload(stored);}catch{this.error.set('Armazenamento do ciclo indisponível. As alterações podem não ser preservadas.');}this.refreshDate();};const changed=(event:StorageEvent)=>{if(event.key===this.key)this.reload(event.newValue);};window.addEventListener('storage',changed);const timer=setInterval(refresh,30000);window.addEventListener('focus',refresh);document.addEventListener('visibilitychange',refresh);
 inject(DestroyRef).onDestroy(()=>{clearInterval(timer);window.removeEventListener('storage',changed);window.removeEventListener('focus',refresh);document.removeEventListener('visibilitychange',refresh);});}
 private reload(raw:string|null){this.raw=raw;try{this.active.set(raw?validateActiveCycle(JSON.parse(raw)):null);this.unreadable=false;this.error.set('');}catch{this.active.set(null);this.unreadable=true;this.error.set('Não foi possível ler o ciclo ativo. O conteúdo original foi preservado.');}}
 refreshDate(){this.today.set(localDateKey());}
 activate(source:Program,startDate:string):ActiveCycle {dateOrdinal(startDate);this.assertWritable();if(this.planning.editorDirty()&&this.planning.editorDraft()?.id===source.id)throw Error('Salve ou cancele a edição desse planejamento antes de ativar.');let draft=structuredClone(source);draft.startDate=startDate;if(draft.guided)draft=buildGuidedProgram(draft);validateProgram(draft);const saved=this.planning.save(draft),previous=this.active();const cycle:ActiveCycle={kind:'activeCycle',schemaVersion:1,id:previous?.programId===saved.id&&previous.startDate===startDate?previous.id:uid(),programId:saved.id,programRevision:saved.revision,startDate,program:structuredClone(saved)};if(previous?.id===cycle.id&&previous.rescheduled)cycle.rescheduled=Object.fromEntries(Object.entries(previous.rescheduled).filter(([id,date])=>saved.slots.some(slot=>slot.id===id)&&date>=startDate&&date<=addCalendarDays(startDate,saved.durationDays-1)));this.write(validateActiveCycle(cycle));this.refreshDate();return cycle;}
 moveSlot(id:string,date:string,swap=false){this.assertWritable();const current=this.active();if(!current||!current.program.slots.some(slot=>slot.id===id))throw Error('Treino não encontrado no ciclo.');if(cycleSession(current,id,this.training.data().sessions,this.training.data().active))throw Error('Este treino já foi iniciado ou registrado. Seu dia foi preservado.');const source=current.program.slots.find(slot=>slot.id===id)!;const from=slotDate(current,source);if(from===date)return;const targets=swap?slotsOnDate(current,date).filter(slot=>slot.id!==id):[];if(targets.some(slot=>cycleSession(current,slot.id,this.training.data().sessions,this.training.data().active)))throw Error('O dia de destino tem treino iniciado ou registrado. Escolha outro dia.');const next=structuredClone(current);next.rescheduled={...next.rescheduled,[id]:date};for(const target of targets)next.rescheduled[target.id]=from;this.write(validateActiveCycle(next));}
 deactivate(){this.assertWritable();this.write(null);}
 private assertWritable(){if(this.unreadable)throw Error(this.error());if(localStorage.getItem(this.key)!==this.raw)throw Error('Outra aba mudou o ciclo ativo. Recarregue antes de alterar a ativação.');}
 private write(cycle:ActiveCycle|null){const encoded=cycle?JSON.stringify(cycle):null;if(encoded&&new TextEncoder().encode(encoded).length>5000000)throw Error('Ciclo maior que 5 MB.');if(this.raw)localStorage.setItem(this.key+'.previous',this.raw);if(encoded===null)localStorage.removeItem(this.key);else localStorage.setItem(this.key,encoded);this.raw=encoded;this.active.set(cycle);this.error.set('');}
 exportRaw(){return this.raw??'null';}
}
