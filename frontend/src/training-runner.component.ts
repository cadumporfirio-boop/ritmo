import {Component,input,output} from '@angular/core';
import {FormsModule} from '@angular/forms';
import {METRICS,ROLES,expand,entryValid,evaluateEntry,goalLabel} from './training';
import type {TrainingSession,Entry,Metric} from './training';

@Component({selector:'training-runner',standalone:true,imports:[FormsModule],template:`
 <section class="page-heading"><div><p class="eyebrow">{{readonly()?'HISTÓRICO · FICHA PRESERVADA':'EXECUÇÃO DO TREINO'}}</p><h1>{{session().plan.title}}<span>.</span></h1><p>Versão {{session().plan.revision}} · {{confirmed()}}/{{session().entries.length}} etapas registradas · {{skipped()}} não realizadas</p></div><button class="secondary" (click)="back.emit()">Voltar ↗</button></section>
 <div class="notice">Cada etapa tem suas próprias métricas e unidades. Descansos também são etapas. Não há cronômetro ou captura automática: registre o realizado. @if(session().plan.notes){<br>{{session().plan.notes}}}</div>
 @for(item of expanded();track item.key;let i=$index){@let entry=session().entries[i];@let feedback=assessment(item.step,entry);
 <section class="panel structured-entry" [attr.data-tone]="feedback.tone">
  <p class="eyebrow">ETAPA {{i+1}} · {{roleLabel(item.step.role)}}</p><h2>{{item.step.name}}</h2><p class="entry-trail">{{item.trail || 'Etapa única'}}</p>
  @if(item.step.equipment){<p class="builder-help">Referência: {{item.step.equipment}}</p>}@if(item.step.notes){<p class="entry-instructions">{{item.step.notes}}</p>}
  <div class="entry-fields">@for(target of item.step.goals;track target.metric){<label>{{metrics[target.metric].label}} · {{metrics[target.metric].unit}} {{target.required?'*':''}}<input type="number" [min]="metrics[target.metric].min" [max]="metrics[target.metric].max" [step]="metrics[target.metric].integer?1:0.1" [ngModel]="entry.values[target.metric]" (ngModelChange)="setValue(entry,target.metric,$event)" [disabled]="readonly()" [attr.aria-label]="'Etapa '+(i+1)+' '+metrics[target.metric].label"><small>Meta: {{label(target)}}</small></label>}</div>
  <div class="entry-feedback" [attr.data-tone]="feedback.tone" role="status"><strong>{{feedback.label}}</strong><p>{{feedback.message}}</p></div>
  @if(!readonly()){<div class="builder-actions"><button class="primary" [attr.aria-label]="'Confirmar etapa '+(i+1)" [attr.aria-pressed]="entry.done" (click)="confirm(i)">{{entry.done?'✓ Registrada · reabrir':'Registrar etapa ✓'}}</button><button class="secondary" (click)="toggleSkip(entry)">{{entry.skipped?'Desfazer não realizada':'Não realizei esta etapa'}}</button></div>}
  <label class="entry-note">Observação da etapa<textarea rows="1" maxlength="2000" [ngModel]="entry.note" (ngModelChange)="entry.note=$event;changed.emit()" [disabled]="readonly()"></textarea></label>
 </section>}
 <section class="panel"><label>Observação da sessão<textarea rows="2" maxlength="4000" [ngModel]="session().note" (ngModelChange)="session().note=$event;changed.emit()" [disabled]="readonly()"></textarea></label></section>
 @if(!readonly()){<div class="finish-bar"><span>{{session().entries.length-confirmed()-skipped()}} etapas pendentes<small>Pendências não são preenchidas automaticamente.</small></span><button class="primary" (click)="finish.emit()">Encerrar e salvar sessão ✓</button></div>}
`})
export class TrainingRunner {
 session=input.required<TrainingSession>();readonly=input(false);changed=output<void>();back=output<void>();finish=output<void>();message=output<string>();
 metrics=METRICS;assessment=evaluateEntry;label=goalLabel;
 expanded(){return expand(this.session().plan);}
 confirmed(){return this.session().entries.filter(entry=>entry.done).length;}
 skipped(){return this.session().entries.filter(entry=>entry.skipped).length;}
 roleLabel(role:string){return ROLES.find(item=>item.id===role)?.label??role;}
 setValue(entry:Entry,metric:Metric,value:number|null){if(this.readonly())return;if(value===null)delete entry.values[metric];else entry.values[metric]=value;entry.done=false;entry.skipped=false;this.changed.emit();}
 confirm(index:number){const entry=this.session().entries[index];if(entry.done){entry.done=false;this.changed.emit();return;}const target=this.expanded()[index].step;if(!entryValid(target,entry)){this.message.emit('Preencha os campos obrigatórios com valores válidos antes de registrar.');return;}entry.done=true;entry.skipped=false;this.changed.emit();}
 toggleSkip(entry:Entry){entry.skipped=!entry.skipped;entry.done=false;this.changed.emit();}
}
