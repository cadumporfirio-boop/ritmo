import {Component,input,output} from '@angular/core';
import {FormsModule} from '@angular/forms';
import {TrainingNodeEditor} from './training-editor.component';
import {seriesGroups,sharedBound,setQuickBound,resizeQuickSeries,quickScheme} from './guided';
import {METRICS,ROLES} from './training';
import {profileFor} from './sport-options';
import type {Step,Metric,TrainingSeries} from './training';
@Component({selector:'quick-exercise',standalone:true,imports:[FormsModule,TrainingNodeEditor],template:`
 <section class="quick-exercise"><div class="quick-exercise-head"><label>Exercício<input aria-label="Nome do exercício guiado" [(ngModel)]="node().name" maxlength="150" (ngModelChange)="identityChanged.emit(node());changed.emit()"></label><label>Séries<input aria-label="Séries por exercício" type="number" min="1" max="30" [ngModel]="node().series?.length??1" (ngModelChange)="resize($event)"></label></div>
 <label class="quick-scheme">Como organizar as séries?<select aria-label="Organização das séries" [ngModel]="scheme()" (ngModelChange)="setScheme($event)"><option value="traditional">Séries tradicionais</option>@if(sport()==='strength'||sport()==='mixed'||sport()==='other'){<option value="topback">Top set + back-offs</option>}<option value="custom">Personalizadas · editar nos detalhes</option></select></label>
 @for(group of groups();track group.role){<div class="quick-goal-group"><strong>{{roleLabel(group.role)}} · {{group.definitions.length}} {{group.definitions.length===1?'série':'séries'}}</strong><div class="quick-ranges">@for(metric of metrics();track metric){<fieldset><legend>{{label(metric)}}</legend><div><label>Mín.<input type="number" [attr.aria-label]="group.role+' '+metric+' mínimo'" [min]="definitions[metric].min" [max]="definitions[metric].max" [step]="definitions[metric].integer?1:0.1" placeholder="Livre" [ngModel]="bound(group.definitions,metric,'min')" (ngModelChange)="setBound(group.definitions,metric,'min',$event)"></label><span>–</span><label>Máx.<input type="number" [attr.aria-label]="group.role+' '+metric+' máximo'" [min]="definitions[metric].min" [max]="definitions[metric].max" [step]="definitions[metric].integer?1:0.1" placeholder="Livre" [ngModel]="bound(group.definitions,metric,'max')" (ngModelChange)="setBound(group.definitions,metric,'max',$event)"></label></div></fieldset>}</div></div>}
 <details class="inline-help"><summary>Sobre as metas</summary><p>Campo vazio: registro livre. Descanso em segundos (60 s = 1 min). Metas diferentes são mantidas até você editar.</p></details>
 <details class="quick-extra"><summary>Observações</summary><label><textarea rows="2" aria-label="Observações do exercício guiado" [ngModel]="observations()" (ngModelChange)="setObservations($event)" maxlength="2000"></textarea></label></details><details class="quick-extra" [open]="detailsOpen"><summary>Detalhes das séries</summary><training-node-editor [nodes]="[node()]" [sport]="sport()" (changed)="changed.emit()" /></details>
 @if(error()){<p class="warning" role="alert">{{error()}}</p>}
 </section>
`})
export class QuickExercise {
 node=input.required<Step>();sport=input('strength');changed=output<void>();identityChanged=output<Step>();detailsOpen=false;readonly definitions=METRICS;readonly bound=sharedBound;readonly groups=()=>seriesGroups(this.node());private message='';error(){return this.message;}
 observations(){return [this.node().equipment,this.node().notes].filter(Boolean).join('\n');}
 setObservations(value:string){this.node().equipment='';this.node().notes=value;this.identityChanged.emit(this.node());this.changed.emit();}
 metrics():Metric[]{return (this.sport()==='strength'||this.node().goals.some(goal=>goal.metric==='reps'||goal.metric==='load')?['reps','rir','rest']:['duration','distance','rpe','rest']).filter(metric=>profileFor(this.sport()).metrics.includes(metric as Metric)) as Metric[];}
 label(metric:Metric){return ({reps:'Repetições',rir:'RIR',rest:'Descanso (s)',duration:'Tempo (s)',distance:'Distância (m)',rpe:'Esforço (RPE)'} as Partial<Record<Metric,string>>)[metric]??METRICS[metric].label;}
 roleLabel(role:string){return ROLES.find(item=>item.id===role)?.label??role;}
 scheme(){const roles=(this.node().series??[this.node()]).map(series=>series.role);return roles.every(role=>role==='work')?'traditional':roles[0]==='top'&&roles.slice(1).every(role=>role==='backoff')?'topback':'custom';}
 setBound(definitions:(TrainingSeries|Step)[],metric:Metric,bound:'min'|'max',value:number|null){setQuickBound(definitions,metric,bound,value);this.changed.emit();}
 resize(count:number){try{resizeQuickSeries(this.node(),count);this.message='';this.changed.emit();}catch(error){this.message=error instanceof Error?error.message:'Confira a quantidade de séries.';}}
 setScheme(scheme:'traditional'|'topback'|'custom'){if(scheme==='custom'){this.detailsOpen=true;return;}quickScheme(this.node(),scheme);this.changed.emit();}
}
