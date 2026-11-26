import {Component,input,output,signal,inject} from '@angular/core';
import {FormsModule} from '@angular/forms';
import {ActiveCycleStore} from './active-cycle.store';
import {PlanningStore} from './planning.store';
import {TrainingStore} from './training.store';
import {calendarWeek,cyclePosition,slotsOnDate,cycleSession,addCalendarDays,dateOrdinal} from './active-cycle';
import type {PlannedSlot} from './planning';
import type {Activity} from './domain';
@Component({selector:'active-cycle-panel',standalone:true,imports:[FormsModule],template:`
 @if(cycles.error()){<p class="warning" role="alert">{{cycles.error()}} <button class="secondary" (click)="exportCycle()">Exportar cópia do ciclo</button></p>}
 @if(message()){<div class="training-message" role="status">{{message()}}<button aria-label="Fechar mensagem do ciclo" (click)="message.set('')">×</button></div>}
 @if(mode()==='setup'||configure()){
 <section class="panel cycle-setup"><h2>Ativar planejamento</h2><p class="builder-help">Escolha um planejamento e a data de início.</p><div class="builder-two"><label>Planejamento<select aria-label="Planejamento para ativar" [ngModel]="selectedId" (ngModelChange)="selectProgram($event)"><option value="">Escolher</option>@for(plan of planning.latest();track plan.id){<option [value]="plan.id">{{plan.title}} · v{{plan.revision}}</option>}</select></label><label>Data de início<input aria-label="Início do ciclo ativo" type="date" [(ngModel)]="startDate"></label></div><p class="builder-help">Os registros anteriores ficam preservados.</p><div class="builder-actions"><button class="primary" (click)="activate()">Ativar ciclo ✓</button>@if(cycles.active()){<button class="secondary" (click)="deactivate()">Desativar ciclo</button>}@if(mode()!=='setup'){<button class="text-button" (click)="configure.set(false)">Fechar</button>}</div>@if(!planning.latest().length){<p class="builder-help">Crie ou importe um planejamento e salve antes de ativar.</p>}</section>
 }@else if(cycles.active();as cycle){@let position=positionOf();
 <section class="panel cycle-current" [class.cycle-week]="mode()==='week'"><div class="section-top"><div><p class="eyebrow">CICLO ATIVO · V{{cycle.programRevision}}</p><h2>{{cycle.program.title}}</h2></div><button class="text-button" (click)="setup()">Gerenciar ciclo</button></div>
<p class="cycle-position">@if(position.status==='upcoming'){Começa em {{format(cycle.startDate)}}}@else if(position.status==='completed'){Ciclo encerrado em {{format(position.endDate)}}}@else{Semana {{position.week}} de {{position.totalWeeks}} · dia {{position.day}} de {{cycle.program.durationDays}}}</p>
 @if(hasNewVersion()){<p class="notice">Nova versão disponível em Gerenciar ciclo.</p>}
 @if(mode()==='week'){<div class="planning-window"><button class="secondary" aria-label="Semana anterior do ciclo" (click)="offset.update(previous)">←</button><strong>{{format(dates()[0])}} – {{format(dates()[6])}}</strong><button class="secondary" aria-label="Próxima semana do ciclo" (click)="offset.update(next)">→</button>@if(offset()!==0){<button class="text-button" (click)="offset.set(0)">Semana atual</button>}</div>}
 @if(mode()==='today' && hasOtherOngoing()){<div class="notice">Sessão em andamento: {{training.data().active!.plan.title}} <button class="secondary" (click)="resume.emit()">Continuar sessão em andamento →</button></div>}

 @if(mode()==='week'){
 <div class="agenda-hint"><span>↕</span> Arraste pela alça para reorganizar <span class="agenda-hint-touch">· ou toque nela e escolha o dia</span></div>
 @if(movingId()){<div class="agenda-moving" role="status">Mover {{movingLabel()}} <button class="text-button" (click)="cancelMove()">Cancelar</button></div>}
 <div class="cycle-days agenda-list">@for(date of dates();track date){
 <article class="cycle-day agenda-day" [class.cycle-today]="date===cycles.today()" [class.agenda-over]="overDate()===date" [class.agenda-outside]="outside(date)" [attr.data-agenda-date]="date" (dragover)="dragOver($event,date)" (dragleave)="leave($event,date)" (drop)="drop($event,date)">
 <h3 class="agenda-date"><span class="agenda-weekday">{{weekday(date)}}</span><b>{{date.slice(8)}}</b>@if(date===cycles.today()){<span class="agenda-today-label">Hoje</span>}</h3>
 <div class="agenda-content">@for(slot of slots(date);track slot.id){@let recorded=record(slot.id);
 <div class="cycle-slot agenda-workout" [class.agenda-dragging]="movingId()===slot.id" [attr.data-agenda-slot]="slot.id">
 @if(!recorded){<button class="agenda-grip" [attr.aria-label]="'Mover '+slot.label" title="Arrastar ou escolher dia" draggable="true" (dragstart)="dragStart($event,slot)" (dragend)="cancelMove()" (pointerdown)="pointerStart($event,slot)" (pointermove)="pointerMove($event)" (pointerup)="pointerEnd($event)" (pointercancel)="cancelMove()" (click)="pick(slot)">⠿</button>}@else{<span class="agenda-grip agenda-locked" aria-hidden="true">{{recorded.completed?'✓':'◷'}}</span>}
 <div class="agenda-workout-info"><strong>{{slot.label}}</strong><div class="agenda-meta">@if(slot.stimulus){<span class="agenda-stimulus">{{slot.stimulus}}</span>}@if(slot.time){<span>◷ {{slot.time}}</span>}@if(recorded){<span>{{recorded.completed?'Registrado':'Em andamento'}}</span>}</div></div>
 <button class="agenda-open" [attr.aria-label]="(recorded?.completed?'Ver sessão registrada de ':recorded?'Continuar sessão de ':'Abrir treino do ciclo de ')+slot.label" (click)="open.emit(slot)">{{recorded?.completed?'Ver':recorded?'Continuar':'Abrir'}} <span>↗</span></button>
 @if(!recorded){<button class="text-button cycle-change-day agenda-more" [attr.aria-label]="'Trocar dia de '+slot.label" title="Escolher outra data" (click)="editSlot.set(slot.id);moveDate=date">⋯</button>}
 @if(editSlot()===slot.id&&!recorded){<div class="cycle-move"><label>Nova data<input type="date" [attr.aria-label]="'Nova data de '+slot.label" [min]="cycle.startDate" [max]="position.endDate" [(ngModel)]="moveDate"></label><button class="secondary compact" (click)="move(slot)">Salvar dia</button><button class="text-button" (click)="editSlot.set('')">Cancelar</button></div>}
 </div>
 }@empty{<div class="agenda-empty"><span class="agenda-empty-dot"></span>{{outside(date)?'Fora do ciclo':reference(date)?.name || 'Dia livre'}}</div>}
 @if(slots(date).length&&reference(date);as activity){<p class="agenda-reference">{{activity.name}} @if(activity.time){· {{activity.time}}}</p>}
 </div>
 @if(movingId()&&!outside(date)){<button class="agenda-place" [attr.aria-label]="'Mover treino para '+weekday(date)" (click)="place(date)">Soltar aqui</button>}
 </article>}
 </div>
 <p class="agenda-footnote">Dia ocupado: os treinos trocam de lugar.</p>
 }@else{
 <div>@for(date of dates();track date){<article class="cycle-day" [class.cycle-today]="date===cycles.today()"><h3>{{dayLabel(date)}} @if(date===cycles.today()){<span>Hoje</span>}</h3>@for(slot of slots(date);track slot.id){@let recorded=record(slot.id);<div class="cycle-slot"><strong>{{slot.label}}</strong><p>{{slot.stimulus || 'Metas do planejamento'}} @if(slot.time){· {{slot.time}}}</p>@if(recorded){<small>{{recorded.completed?'Sessão registrada':'Em andamento'}} · {{recorded.entries.filter(done).length}}/{{recorded.entries.length}} séries / etapas confirmadas</small>}<button class="primary" (click)="open.emit(slot)">{{recorded?.completed?'Ver sessão registrada →':recorded?'Continuar sessão →':'Abrir treino do ciclo →'}}</button></div>}@empty{<p class="builder-help">{{outside(date)?'Fora do período deste ciclo.':'Sem sessão prevista no ciclo.'}}</p>}@if(reference(date);as activity){<p class="cycle-reference">{{activity.name}} @if(activity.time){· {{activity.time}}}</p>}</article>}</div>
 }
 </section>
 }
`})
export class ActiveCyclePanel {
 readonly movingId=signal('');readonly overDate=signal('');private pointer:{id:number;x:number;y:number;moved:boolean}|null=null;private suppressClick=false;
 movingLabel(){return this.cycles.active()?.program.slots.find(slot=>slot.id===this.movingId())?.label??'';}
 pick(slot:PlannedSlot){if(this.suppressClick){this.suppressClick=false;return;}this.movingId.set(this.movingId()===slot.id?'':slot.id);}
 cancelMove(){this.pointer=null;this.movingId.set('');this.overDate.set('');}
 dragStart(event:DragEvent,slot:PlannedSlot){this.movingId.set(slot.id);event.dataTransfer?.setData('text/plain',slot.id);if(event.dataTransfer)event.dataTransfer.effectAllowed='move';}
 dragOver(event:DragEvent,date:string){if(this.movingId()&&!this.outside(date)){event.preventDefault();this.overDate.set(date);if(event.dataTransfer)event.dataTransfer.dropEffect='move';}}
 leave(event:DragEvent,date:string){if(!(event.currentTarget as HTMLElement).contains(event.relatedTarget as Node)&&this.overDate()===date)this.overDate.set('');}
 drop(event:DragEvent,date:string){event.preventDefault();if(this.movingId())this.place(date);}
 place(date:string){try{this.cycles.moveSlot(this.movingId(),date,true);this.message.set('Agenda atualizada. Metas preservadas.');}catch(error){this.fail(error);}this.cancelMove();}
 pointerStart(event:PointerEvent,slot:PlannedSlot){if(event.pointerType==='mouse')return;this.pointer={id:event.pointerId,x:event.clientX,y:event.clientY,moved:false};this.movingId.set(slot.id);(event.currentTarget as HTMLElement).setPointerCapture?.(event.pointerId);}
 pointerMove(event:PointerEvent){if(!this.pointer||event.pointerId!==this.pointer.id)return;if(Math.hypot(event.clientX-this.pointer.x,event.clientY-this.pointer.y)>8)this.pointer.moved=true;if(this.pointer.moved){event.preventDefault();const date=document.elementFromPoint(event.clientX,event.clientY)?.closest<HTMLElement>('[data-agenda-date]')?.dataset['agendaDate'];this.overDate.set(date&&!this.outside(date)?date:'');}}
 pointerEnd(event:PointerEvent){if(!this.pointer||event.pointerId!==this.pointer.id)return;const moved=this.pointer.moved;this.pointer=null;this.suppressClick=true;if(moved){const date=this.overDate();if(date)this.place(date);else this.cancelMove();}}
 weekday(date:string){return new Intl.DateTimeFormat('pt-BR',{timeZone:'UTC',weekday:'short'}).format(new Date(date+'T12:00:00Z')).replace('.','');}
 readonly editSlot=signal('');moveDate='';
 readonly cycles=inject(ActiveCycleStore);readonly planning=inject(PlanningStore);readonly training=inject(TrainingStore);preferredProgramId=input('');mode=input<'today'|'week'|'setup'>('today');routine=input<Activity[]>([]);open=output<PlannedSlot>();resume=output<void>();activated=output<void>();readonly configure=signal(false);readonly offset=signal(0);readonly message=signal('');selectedId='';startDate='';readonly previous=(value:number)=>value-1;readonly next=(value:number)=>value+1;readonly done=(entry:{done:boolean})=>entry.done;
 constructor(){const active=this.cycles.active(),program=active?.program??this.planning.latest()[0];this.selectedId=program?.id??'';this.startDate=program?.startDate|| (program?.guided?calendarWeek(this.cycles.today())[0]:this.cycles.today());}
 ngOnInit(){if(this.preferredProgramId())this.selectProgram(this.preferredProgramId());}
 setup(){const active=this.cycles.active();this.selectedId=active?.programId??this.planning.latest()[0]?.id??'';this.startDate=active?.startDate??this.cycles.today();this.configure.set(true);}
 selectProgram(id:string){this.selectedId=id;const program=this.planning.latest().find(plan=>plan.id===id);this.startDate=program?.startDate||(program?.guided?calendarWeek(this.cycles.today())[0]:this.cycles.today());}
 activate(){try{const program=this.planning.latest().find(plan=>plan.id===this.selectedId);if(!program)throw Error('Escolha um planejamento salvo.');this.cycles.activate(program,this.startDate);this.configure.set(false);this.message.set('Ciclo ativado. Hoje e Minha semana já seguem as datas do planejamento.');this.activated.emit();}catch(error){this.fail(error);}}
 deactivate(){try{this.cycles.deactivate();this.configure.set(false);this.message.set('Ciclo desativado. A rotina de referência e os registros foram preservados.');this.activated.emit();}catch(error){this.fail(error);}}
 move(slot:PlannedSlot){try{this.cycles.moveSlot(slot.id,this.moveDate);this.editSlot.set('');this.message.set('Dia do treino atualizado. As metas foram preservadas.');}catch(error){this.fail(error);}}
 hasNewVersion(){const cycle=this.cycles.active()!;return this.planning.latest().some(plan=>plan.id===cycle.programId&&plan.revision!==cycle.programRevision);}
 hasOtherOngoing(){const active=this.training.data().active,cycle=this.cycles.active();return !!active&&!!cycle&&!(active.planning?.activationId===cycle.id&&this.slots(this.cycles.today()).some(slot=>slot.id===active.planning?.slotId));}
 positionOf(){return cyclePosition(this.cycles.active()!,this.cycles.today());}
 dates(){return this.mode()==='week'?calendarWeek(this.cycles.today(),this.offset()):[this.cycles.today()];}
 slots(date:string){return slotsOnDate(this.cycles.active()!,date);}
 record(id:string){return cycleSession(this.cycles.active()!,id,this.training.data().sessions,this.training.data().active);}
 outside(date:string){return cyclePosition(this.cycles.active()!,date).status!=='active';}
 slotWeek(day:number){return Math.floor((day-1)/7)+1;}
 format(date:string){return new Intl.DateTimeFormat('pt-BR',{timeZone:'UTC',day:'2-digit',month:'2-digit'}).format(new Date(date+'T12:00:00Z'));}
 dayLabel(date:string){return new Intl.DateTimeFormat('pt-BR',{timeZone:'UTC',weekday:'long',day:'2-digit',month:'2-digit'}).format(new Date(date+'T12:00:00Z'));}
 reference(date:string){const index=(new Date(date+'T12:00:00Z').getUTCDay()+6)%7;const activity=this.routine()[index];return activity&&activity.type!=='strength'?activity:null;}
 exportCycle(){const link=document.createElement('a');link.href=URL.createObjectURL(new Blob([this.cycles.exportRaw()],{type:'application/json'}));link.download='ritmo-ciclo-ativo.json';link.click();setTimeout(()=>URL.revokeObjectURL(link.href),500);}
 fail(error:unknown){this.message.set(error instanceof Error?error.message:'Não foi possível alterar o ciclo ativo.');}
}
