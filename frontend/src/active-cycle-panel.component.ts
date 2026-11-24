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
 @if(message()){<p class="training-message" role="status">{{message()}}</p>}
 @if(mode()==='setup'||configure()){
 <section class="panel cycle-setup"><h2>Ativar planejamento</h2><p class="builder-help">Escolha o planejamento salvo e a data real de início. Hoje e Minha semana vão seguir esse ciclo.</p><div class="builder-two"><label>Planejamento<select aria-label="Planejamento para ativar" [ngModel]="selectedId" (ngModelChange)="selectProgram($event)"><option value="">Escolher</option>@for(plan of planning.latest();track plan.id){<option [value]="plan.id">{{plan.title}} · v{{plan.revision}}</option>}</select></label><label>Data de início<input aria-label="Início do ciclo ativo" type="date" [(ngModel)]="startDate"></label></div><p class="builder-help">As semanas e sessões são posicionadas pela data escolhida. A rotina de referência e os registros anteriores continuam guardados.</p><div class="builder-actions"><button class="primary" (click)="activate()">Ativar ciclo ✓</button>@if(cycles.active()){<button class="secondary" (click)="deactivate()">Desativar ciclo</button>}@if(mode()!=='setup'){<button class="text-button" (click)="configure.set(false)">Fechar</button>}</div>@if(!planning.latest().length){<p class="builder-help">Crie ou importe um planejamento e salve antes de ativar.</p>}</section>
 }@else if(cycles.active();as cycle){@let position=positionOf();
 <section class="panel cycle-current" [class.cycle-week]="mode()==='week'"><div class="section-top"><div><p class="eyebrow">CICLO ATIVO · V{{cycle.programRevision}}</p><h2>{{cycle.program.title}}</h2></div><button class="text-button" (click)="setup()">Gerenciar ciclo</button></div>
<p class="cycle-position">@if(position.status==='upcoming'){Começa em {{format(cycle.startDate)}}}@else if(position.status==='completed'){Ciclo encerrado em {{format(position.endDate)}}}@else{Semana {{position.week}} de {{position.totalWeeks}} · dia {{position.day}} de {{cycle.program.durationDays}}}</p>
 @if(hasNewVersion()){<p class="notice">Há uma nova versão salva. Use Gerenciar ciclo para aplicá-la aos próximos treinos.</p>}
 @if(mode()==='week'){<div class="planning-window"><button class="secondary" aria-label="Semana anterior do ciclo" (click)="offset.update(previous)">←</button><strong>{{format(dates()[0])}} – {{format(dates()[6])}}</strong><button class="secondary" aria-label="Próxima semana do ciclo" (click)="offset.update(next)">→</button>@if(offset()!==0){<button class="text-button" (click)="offset.set(0)">Semana atual</button>}</div>}
 @if(mode()==='today' && hasOtherOngoing()){<div class="notice">Sessão em andamento: {{training.data().active!.plan.title}} <button class="secondary" (click)="resume.emit()">Continuar sessão em andamento →</button></div>}
 <div [class.cycle-days]="mode()==='week'">@for(date of dates();track date){@let dateSlots=slots(date);<article class="cycle-day" [class.cycle-today]="date===cycles.today()"><h3>{{dayLabel(date)}} @if(date===cycles.today()){<span>Hoje</span>}</h3>@for(slot of dateSlots;track slot.id){@let recorded=record(slot.id);<div class="cycle-slot"><strong>{{slot.label}}</strong><p>{{slot.stimulus || 'Metas do planejamento'}} @if(slot.time){· {{slot.time}}}</p><small>Semana {{slotWeek(slot.day)}} · dia {{slot.day}} do ciclo</small>@if(recorded){<small>{{recorded.completed?'Sessão registrada':'Em andamento'}} · {{recorded.entries.filter(done).length}}/{{recorded.entries.length}} séries / etapas confirmadas · v{{recorded.planning?.programRevision}}</small>}<button class="primary" (click)="open.emit(slot)">{{recorded?.completed?'Ver sessão registrada →':recorded?'Continuar sessão →':'Abrir treino do ciclo →'}}</button></div>}@empty{<p class="builder-help">{{outside(date)?'Fora do período deste ciclo.':'Sem sessão prevista no ciclo.'}}</p>}@if(reference(date);as activity){<p class="cycle-reference">Rotina de referência: {{activity.name}} @if(activity.time){· {{activity.time}}}</p>}</article>}</div>
 <p class="builder-help">O calendário avança pelas datas. Não cria registros nem marca treinos como concluídos. Sessões já registradas conservam as metas usadas.</p></section>
 }
`})
export class ActiveCyclePanel {
 readonly cycles=inject(ActiveCycleStore);readonly planning=inject(PlanningStore);readonly training=inject(TrainingStore);preferredProgramId=input('');mode=input<'today'|'week'|'setup'>('today');routine=input<Activity[]>([]);open=output<PlannedSlot>();resume=output<void>();activated=output<void>();readonly configure=signal(false);readonly offset=signal(0);readonly message=signal('');selectedId='';startDate='';readonly previous=(value:number)=>value-1;readonly next=(value:number)=>value+1;readonly done=(entry:{done:boolean})=>entry.done;
 constructor(){const active=this.cycles.active(),program=active?.program??this.planning.latest()[0];this.selectedId=program?.id??'';this.startDate=program?.startDate|| (program?.guided?calendarWeek(this.cycles.today())[0]:this.cycles.today());}
 ngOnInit(){if(this.preferredProgramId())this.selectProgram(this.preferredProgramId());}
 setup(){const active=this.cycles.active();this.selectedId=active?.programId??this.planning.latest()[0]?.id??'';this.startDate=active?.startDate??this.cycles.today();this.configure.set(true);}
 selectProgram(id:string){this.selectedId=id;const program=this.planning.latest().find(plan=>plan.id===id);this.startDate=program?.startDate||(program?.guided?calendarWeek(this.cycles.today())[0]:this.cycles.today());}
 activate(){try{const program=this.planning.latest().find(plan=>plan.id===this.selectedId);if(!program)throw Error('Escolha um planejamento salvo.');this.cycles.activate(program,this.startDate);this.configure.set(false);this.message.set('Ciclo ativado. Hoje e Minha semana já seguem as datas do planejamento.');this.activated.emit();}catch(error){this.fail(error);}}
 deactivate(){try{this.cycles.deactivate();this.configure.set(false);this.message.set('Ciclo desativado. A rotina de referência e os registros foram preservados.');this.activated.emit();}catch(error){this.fail(error);}}
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
