import {Component,input,output} from '@angular/core';
import {executionGroups} from './training-layout';
import {FormsModule} from '@angular/forms';
import {METRICS,ROLES,expand,entryValid,evaluateEntry,goalLabel,sessionExpansion,addSessionSeries} from './training';
import type {TrainingSession,Entry,Metric,ExpandedStep} from './training';

@Component({selector:'training-runner',standalone:true,imports:[FormsModule],template:`
 <section class="page-heading"><div><p class="eyebrow">{{readonly()?'HISTÓRICO · FICHA PRESERVADA':'EXECUÇÃO DO TREINO'}}</p><h1>{{session().plan.title}}<span>.</span></h1><p>Versão {{session().plan.revision}} · {{confirmed()}}/{{session().entries.length}} etapas registradas · {{skipped()}} não realizadas</p></div><button class="secondary" (click)="back.emit()">Voltar ↗</button></section>
 @if(session().planning;as origin){<p class="notice">{{origin.programTitle}} · v{{origin.programRevision}} · dia {{origin.day}} @if(origin.stimulus){· {{origin.stimulus}}}</p>}
 @if(session().plan.notes){<p class="notice">{{session().plan.notes}}</p>}
 @for(block of blocks();track block.key;let bi=$index){@let first=block.items[0].item.step;@let status=blockStatus(block.items);
 <section class="panel execution-block" [attr.data-exercise-tone]="status.tone"><div class="exercise-heading"><span class="exercise-number">{{bi+1<10?'0':''}}{{bi+1}}</span><div><h2>{{first.name}}</h2><p>{{block.items.length}} {{session().plan.sport==='martial'?'rounds':'séries'}} @if(first.equipment){· {{first.equipment}}}</p></div></div>
 @if(first.notes){<p class="entry-instructions">{{first.notes}}</p>}
 <p class="exercise-summary">{{status.registered}}/{{block.items.length}} séries registradas · {{status.matched}} na meta · {{status.outside}} fora da faixa</p>
 @if(!readonly()){<button class="complete-exercise" [attr.data-tone]="status.tone" [attr.aria-pressed]="status.complete" (click)="completeBlock(block.items)">{{status.complete?'✓ Exercício concluído · reabrir':'Concluir exercício ✓'}}</button>}
 <p class="series-legend">Verde: meta atingida · Âmbar: fora da faixa · Cinza: pendente ou sem meta.</p>
 <div class="series-grid-header" [style.grid-template-columns]="grid(block.items)"><span>Série</span>@for(metric of columns(block.items);track metric){<span>{{shortLabel(metric)}}@if(metrics[metric].unit){<small>{{metrics[metric].unit}}</small>}</span>}<span>Feito</span></div>
 @for(row of block.items;track row.item.key;let series=$index){@let item=row.item;@let i=row.index;@let entry=session().entries[i];@let feedback=assessment(item.step,entry);
 <section class="structured-entry series-entry" [attr.data-tone]="feedback.tone">
 <div class="series-grid-row" [style.grid-template-columns]="grid(block.items)"><span class="series-index">{{series+1}}</span>
 @for(metric of columns(block.items);track metric){@if(hasMetric(item.step,metric)){<input type="number" [min]="metrics[metric].min" [max]="metrics[metric].max" [step]="metrics[metric].integer?1:0.1" [ngModel]="entry.values[metric]" (ngModelChange)="setValue(entry,metric,$event)" [disabled]="readonly()" placeholder="—" [attr.aria-describedby]="'series-targets-'+session().id+'-'+i" [attr.aria-label]="'Etapa '+(i+1)+' '+metrics[metric].label">}@else{<span class="metric-unused">—</span>}}
 <button class="primary series-check" [disabled]="readonly()" [attr.aria-label]="'Confirmar etapa '+(i+1)" [attr.aria-pressed]="entry.done" (click)="confirm(i)">{{entry.done?'✓':'○'}}</button><div class="series-targets" [id]="'series-targets-'+session().id+'-'+i"><strong>{{roleLabel(item.step.role)}}{{entry.extra?' · extra':''}}</strong>@for(target of item.step.goals;track target.metric){<span>{{shortLabel(target.metric)}}: {{label(target)}}{{target.required?'':' · opcional'}}</span>}@empty{<span>Conclusão manual · sem metas numéricas</span>}</div></div>
 <div class="series-result" role="status"><strong>{{feedback.label}}</strong> {{feedback.message}}</div>
 <details class="series-details"><summary>Observação e opções</summary>
 @if(!readonly()){<button class="text-button" (click)="toggleSkip(entry)">{{entry.skipped?'Desfazer não realizada':'Não realizada'}}</button>@if(entry.extra){<button class="text-button" (click)="removeExtra(i)">Remover série extra</button>}}
 <label>Observação<textarea rows="1" maxlength="2000" [ngModel]="entry.note" (ngModelChange)="entry.note=$event;changed.emit()" [disabled]="readonly()"></textarea></label></details>
 </section>}
 @if(!readonly()){<button class="secondary add-session-series" (click)="addExtra(block.items)">Adicionar série extra +</button>}
 </section>}
 <section class="panel"><label>Observação da sessão<textarea rows="2" maxlength="4000" [ngModel]="session().note" (ngModelChange)="session().note=$event;changed.emit()" [disabled]="readonly()"></textarea></label></section>
 @if(!readonly()){<div class="finish-bar"><span>{{session().entries.length-confirmed()-skipped()}} etapas pendentes<small>Pendências não são preenchidas automaticamente.</small></span><button class="primary" (click)="finish.emit()">Encerrar e salvar sessão ✓</button></div>}
`})
export class TrainingRunner {
 session=input.required<TrainingSession>();readonly=input(false);changed=output<void>();back=output<void>();finish=output<void>();message=output<string>();
 metrics=METRICS;assessment=evaluateEntry;label=goalLabel;
 blocks(){return executionGroups(this.session().plan,this.session());}
 expanded(){return sessionExpansion(this.session());}
 confirmed(){return this.session().entries.filter(entry=>entry.done).length;}
 skipped(){return this.session().entries.filter(entry=>entry.skipped).length;}
 columns(rows:{item:ExpandedStep;index:number}[]):Metric[]{const all=[...new Set(rows.flatMap(row=>row.item.step.goals.map(goal=>goal.metric)))];return all.sort((a,b)=>{const order:Metric[]=['load','reps','rir'];return (order.includes(a)?order.indexOf(a):10)-(order.includes(b)?order.indexOf(b):10);});}
 grid(rows:{item:ExpandedStep;index:number}[]){return '24px repeat('+this.columns(rows).length+', minmax(54px, 1fr)) 36px';}
 shortLabel(metric:Metric){return ({load:'Carga',reps:'Reps',rir:'RIR'} as Partial<Record<Metric,string>>)[metric]??METRICS[metric].label;}
 hasMetric(step:ExpandedStep['step'],metric:Metric){return step.goals.some(goal=>goal.metric===metric);}
 blockStatus(rows:{item:ExpandedStep;index:number}[]){const entries=rows.map(row=>this.session().entries[row.index]),registered=entries.filter(entry=>entry.done).length;const tones=rows.map(row=>evaluateEntry(row.item.step,this.session().entries[row.index]).tone);return {registered,matched:tones.filter(t=>t==='positive').length,outside:tones.filter(t=>t==='attention').length,complete:registered===rows.length,tone:tones.includes('attention')?'attention':registered===rows.length&&tones.every(t=>t==='positive')?'positive':'neutral'};}
 completeBlock(rows:{item:ExpandedStep;index:number}[]){if(this.readonly())return;const reopen=this.blockStatus(rows).complete;if(!reopen&&rows.some(row=>!entryValid(row.item.step,this.session().entries[row.index]))){this.message.emit('Preencha os campos obrigatórios de todas as séries antes de concluir.');return;}for(const row of rows){const entry=this.session().entries[row.index];entry.done=!reopen;if(!reopen)entry.skipped=false;}this.changed.emit();}
 addExtra(rows:{item:ExpandedStep;index:number}[]){if(this.readonly())return;const anchor=rows.filter(row=>!this.session().entries[row.index].extra).at(-1)!;try{addSessionSeries(this.session(),anchor.item.key);this.changed.emit();}catch(error){this.message.emit(error instanceof Error?error.message:'Não foi possível adicionar a série.');}}
 removeExtra(index:number){if(this.readonly()||!this.session().entries[index]?.extra)return;this.session().entries.splice(index,1);this.changed.emit();}
 roleLabel(role:string){return ROLES.find(item=>item.id===role)?.label??role;}
 setValue(entry:Entry,metric:Metric,value:number|null){if(this.readonly())return;if(value===null)delete entry.values[metric];else entry.values[metric]=value;entry.done=false;entry.skipped=false;this.changed.emit();}
 confirm(index:number){const entry=this.session().entries[index];if(entry.done){entry.done=false;this.changed.emit();return;}const target=this.expanded()[index].step;if(!entryValid(target,entry)){this.message.emit('Preencha os campos obrigatórios com valores válidos antes de registrar.');return;}entry.done=true;entry.skipped=false;this.changed.emit();}
 toggleSkip(entry:Entry){entry.skipped=!entry.skipped;entry.done=false;this.changed.emit();}
}
