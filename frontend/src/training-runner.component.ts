import {Component,input,output} from '@angular/core';
import {executionGroups} from './training-layout';
import {FormsModule} from '@angular/forms';
import {METRICS,ROLES,expand,entryValid,evaluateEntry,goalLabel} from './training';
import type {TrainingSession,Entry,Metric} from './training';

@Component({selector:'training-runner',standalone:true,imports:[FormsModule],template:`
 <section class="page-heading"><div><p class="eyebrow">{{readonly()?'HISTÓRICO · FICHA PRESERVADA':'EXECUÇÃO DO TREINO'}}</p><h1>{{session().plan.title}}<span>.</span></h1><p>Versão {{session().plan.revision}} · {{confirmed()}}/{{session().entries.length}} etapas registradas · {{skipped()}} não realizadas</p></div><button class="secondary" (click)="back.emit()">Voltar ↗</button></section>
 @if(session().plan.notes){<p class="notice">{{session().plan.notes}}</p>}
 @for(block of blocks();track block.key){@let first=block.items[0].item.step;
 <section class="panel execution-block"><div class="execution-heading"><div><h2>{{first.name}}</h2><p class="builder-help">{{roleLabel(first.role)}} · {{block.items.length}} {{session().plan.sport==='martial'?'round(s)':'série(s)'}}</p></div></div>
 @if(first.equipment){<p class="builder-help">{{first.equipment}}</p>}@if(first.notes){<p class="entry-instructions">{{first.notes}}</p>}
 @for(row of block.items;track row.item.key;let series=$index){@let item=row.item;@let i=row.index;@let entry=session().entries[i];@let feedback=assessment(item.step,entry);
 <section class="structured-entry series-entry" [attr.data-tone]="feedback.tone">
  <p class="eyebrow">{{session().plan.sport==='martial'?'ROUND':'SÉRIE'}} {{series+1}}</p>

  <div class="entry-fields">@for(target of item.step.goals;track target.metric){<label>{{metrics[target.metric].label}} · {{metrics[target.metric].unit}} {{target.required?'*':''}}<input type="number" [min]="metrics[target.metric].min" [max]="metrics[target.metric].max" [step]="metrics[target.metric].integer?1:0.1" [ngModel]="entry.values[target.metric]" (ngModelChange)="setValue(entry,target.metric,$event)" [disabled]="readonly()" [attr.aria-label]="'Etapa '+(i+1)+' '+metrics[target.metric].label"><small>Meta: {{label(target)}}</small></label>}</div>
  <div class="entry-feedback" [attr.data-tone]="feedback.tone" role="status"><strong>{{feedback.label}}</strong><p>{{feedback.message}}</p></div>
  @if(!readonly()){<div class="builder-actions"><button class="primary" [attr.aria-label]="'Confirmar etapa '+(i+1)" [attr.aria-pressed]="entry.done" (click)="confirm(i)">{{entry.done?'✓ Registrada · reabrir':'Confirmar ✓'}}</button><button class="secondary" (click)="toggleSkip(entry)">{{entry.skipped?'Desfazer não realizada':'Não realizada'}}</button></div>}
  <details class="entry-note"><summary>Observação</summary><label><textarea rows="1" maxlength="2000" [ngModel]="entry.note" (ngModelChange)="entry.note=$event;changed.emit()" [disabled]="readonly()"></textarea></label></details>
 </section>}
 </section>}
 <section class="panel"><label>Observação da sessão<textarea rows="2" maxlength="4000" [ngModel]="session().note" (ngModelChange)="session().note=$event;changed.emit()" [disabled]="readonly()"></textarea></label></section>
 @if(!readonly()){<div class="finish-bar"><span>{{session().entries.length-confirmed()-skipped()}} etapas pendentes<small>Pendências não são preenchidas automaticamente.</small></span><button class="primary" (click)="finish.emit()">Encerrar e salvar sessão ✓</button></div>}
`})
export class TrainingRunner {
 session=input.required<TrainingSession>();readonly=input(false);changed=output<void>();back=output<void>();finish=output<void>();message=output<string>();
 metrics=METRICS;assessment=evaluateEntry;label=goalLabel;
 blocks(){return executionGroups(this.session().plan);}
 expanded(){return expand(this.session().plan);}
 confirmed(){return this.session().entries.filter(entry=>entry.done).length;}
 skipped(){return this.session().entries.filter(entry=>entry.skipped).length;}
 roleLabel(role:string){return ROLES.find(item=>item.id===role)?.label??role;}
 setValue(entry:Entry,metric:Metric,value:number|null){if(this.readonly())return;if(value===null)delete entry.values[metric];else entry.values[metric]=value;entry.done=false;entry.skipped=false;this.changed.emit();}
 confirm(index:number){const entry=this.session().entries[index];if(entry.done){entry.done=false;this.changed.emit();return;}const target=this.expanded()[index].step;if(!entryValid(target,entry)){this.message.emit('Preencha os campos obrigatórios com valores válidos antes de registrar.');return;}entry.done=true;entry.skipped=false;this.changed.emit();}
 toggleSkip(entry:Entry){entry.skipped=!entry.skipped;entry.done=false;this.changed.emit();}
}
