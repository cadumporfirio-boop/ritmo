import {Component,input,output,forwardRef} from '@angular/core';
import {FormsModule} from '@angular/forms';
import {METRICS,ROLES,MODES,step,group,goal,cloneNodes,uid} from './training';
import type {TrainingNode,Step,Goal,Mode,Metric,Group} from './training';
import {profileFor,roleOptions,metricOptions,hasRetainedOptions,createStepForSport,createGroupForSport} from './sport-options';

@Component({selector:'training-node-editor',standalone:true,imports:[FormsModule,forwardRef(()=>TrainingNodeEditor)],template:`
 @for(node of nodes();track node.id;let i=$index){
  <article class="builder-node" [class.builder-group]="node.kind==='group'">
   <div class="builder-node-head"><span>{{node.kind==='group'?'BLOCO':'ETAPA'}} {{i+1}}</span><div class="builder-actions"><button type="button" (click)="move(i,-1)" [disabled]="i===0" aria-label="Mover item para cima">↑</button><button type="button" (click)="move(i,1)" [disabled]="i===nodes().length-1" aria-label="Mover item para baixo">↓</button><button type="button" (click)="duplicate(i)">Duplicar</button><button type="button" class="builder-remove" (click)="remove(i)">Remover</button></div></div>
   <label>Nome<input [(ngModel)]="node.name" maxlength="150" (ngModelChange)="changed.emit()" [attr.aria-label]="'Nome do item '+(i+1)"></label>
   @if(node.kind==='group'){
    <label>Voltas deste bloco<input type="number" min="1" max="30" step="1" [(ngModel)]="node.repeat" (ngModelChange)="changed.emit()"></label>
    @if(node.repeat>1 && node.children.length===1 && node.children[0].kind==='step'){<button type="button" class="text-button" (click)="splitSeries(node)">Separar em etapas</button><p class="builder-help">As séries aparecem juntas na execução. Separe para dar metas diferentes a cada uma.</p>}
    <p class="builder-help">A sequência abaixo será executada nesta ordem, em cada volta.</p>
    <training-node-editor [nodes]="node.children" [depth]="depth()+1" [sport]="sport()" (changed)="changed.emit()" />
    <div class="builder-actions"><button type="button" class="secondary" (click)="node.children.push(newStep());changed.emit()">+ Etapa</button>@if(depth()<3){<button type="button" class="secondary" (click)="node.children.push(newGroup());changed.emit()">+ Bloco interno</button>}</div>
   }@else{
    <div class="builder-two">@if(!node.series){<label>{{node.series?'Tipo padrão da etapa':'Tipo de etapa'}}<select aria-label="Tipo de etapa" [(ngModel)]="node.role" (ngModelChange)="changed.emit()">@for(role of roleChoices(node.role);track role.id){<option [value]="role.id">{{role.label}}</option>}</select></label>}<label>Equipamento / referência de medição<input [(ngModel)]="node.equipment" maxlength="150" [placeholder]="profile().equipmentHint" (ngModelChange)="changed.emit()"></label></div>
    @if(retained(node)){<p class="builder-help retained-options">Esta etapa já tinha opções de outra modalidade. Elas foram mantidas para preservar sua ficha; você pode ajustá-las ou usar Outra / Misto para exibir todas.</p>}
    <label>Instruções<textarea rows="2" [(ngModel)]="node.notes" maxlength="2000" (ngModelChange)="changed.emit()" placeholder="Cadência, técnica, execução, observações…"></textarea></label>
    @if(node.series && node.series.length>1){<button class="text-button" (click)="separateStep(i,node)">Separar séries em etapas</button>}<div class="builder-actions"><h4>Séries desta etapa</h4><button class="secondary" (click)="addSeries(node)">+ Série</button></div>
    @for(definition of definitions(node);track definition.id;let si=$index){<section class="series-definition">@if(node.series){<div class="builder-actions"><strong>Série {{si+1}}</strong><button class="text-button" (click)="duplicateSeries(node,si)">Duplicar série</button><button class="text-button" (click)="removeSeries(node,si)" [disabled]="node.series.length===1">Remover série</button></div><label>Tipo da série<select aria-label="Tipo da série" [(ngModel)]="definition.role" (ngModelChange)="changed.emit()">@for(role of roleChoices(definition.role);track role.id){<option [value]="role.id">{{role.label}}</option>}</select></label>}
    @if(retained(definition)){<p class="builder-help">Opções já configuradas foram preservadas nesta série.</p>}
    @for(target of definition.goals;track $index;let gi=$index){
     <div class="builder-goal"><div class="builder-two"><label>Métrica<select aria-label="Métrica da etapa" [ngModel]="target.metric" (ngModelChange)="metricChanged(target,$event)">@for(metric of metricChoices(target.metric);track metric.id){<option [value]="metric.id">{{metric.label}} · {{metric.unit}}</option>}</select></label><label>Regra<select [ngModel]="target.mode" (ngModelChange)="modeChanged(target,$event)">@for(mode of modes;track mode.id){<option [value]="mode.id">{{mode.label}}</option>}</select></label></div>
     <div class="builder-two">@if(target.mode!=='record' && target.mode!=='max'){<label>{{target.mode==='exact'?'Valor':'Mínimo'}} ({{metrics[target.metric].unit}})<input type="number" [min]="metrics[target.metric].min" [max]="metrics[target.metric].max" [step]="metrics[target.metric].integer?1:0.1" [(ngModel)]="target.min" (ngModelChange)="exactChanged(target)"></label>}@if(target.mode==='range'||target.mode==='max'){<label>Máximo ({{metrics[target.metric].unit}})<input type="number" [min]="metrics[target.metric].min" [max]="metrics[target.metric].max" [step]="metrics[target.metric].integer?1:0.1" [(ngModel)]="target.max" (ngModelChange)="changed.emit()"></label>}</div>
     <div class="builder-goal-bottom"><label class="checkbox-label"><input type="checkbox" [(ngModel)]="target.required" (ngModelChange)="changed.emit()">Obrigatório para concluir</label><button type="button" class="text-button" (click)="definition.goals.splice(gi,1);changed.emit()">Retirar métrica ×</button></div></div>
    }
    <button type="button" class="secondary" (click)="addMetric(definition)" [disabled]="!canAddMetric(definition)">+ Métrica</button>
    @if(!definition.goals.length){<p class="builder-help">Etapa livre: conclusão manual, sem classificação numérica.</p>}
    </section>}
   }
  </article>
 }
`})
export class TrainingNodeEditor {
 nodes=input.required<TrainingNode[]>();depth=input(0);sport=input('other');changed=output<void>();
 metrics=METRICS;roles=ROLES;modes=MODES;
 metricList=Object.entries(METRICS).map(([id,definition])=>({id,...definition}));
 profile(){return profileFor(this.sport());}
 roleChoices(current:string){return roleOptions(this.sport(),current);}
 metricChoices(current:Metric){return metricOptions(this.sport(),current);}
 retained(node:Pick<Step,'role'|'goals'>){return hasRetainedOptions(node,this.sport());}
 newStep(){return createStepForSport(this.sport());}
 newGroup(){return createGroupForSport(this.sport());}
 splitSeries(node:Group){node.children=Array.from({length:node.repeat},()=>cloneNodes(node.children)).flat();node.repeat=1;this.changed.emit();}
 move(index:number,direction:number){const other=index+direction;if(other<0||other>=this.nodes().length)return;[this.nodes()[index],this.nodes()[other]]=[this.nodes()[other],this.nodes()[index]];this.changed.emit();}
 remove(index:number){this.nodes().splice(index,1);this.changed.emit();}
 duplicate(index:number){this.nodes().splice(index+1,0,cloneNodes([this.nodes()[index]])[0]);this.changed.emit();}
 definitions(node:Step){return node.series??[node];}
 addSeries(node:Step){if(!node.series)node.series=[{id:uid(),role:node.role,goals:structuredClone(node.goals)}];if(node.series.length<30)node.series.push({...structuredClone(node.series.at(-1)!),id:uid()});this.changed.emit();}
 duplicateSeries(node:Step,index:number){if(node.series&&node.series.length<30)node.series.splice(index+1,0,{...structuredClone(node.series[index]),id:uid()});this.changed.emit();}
 removeSeries(node:Step,index:number){if(node.series&&node.series.length>1)node.series.splice(index,1);this.changed.emit();}
 separateStep(index:number,node:Step){const nodes=node.series!.map((series,si)=>{const {series:unused,...base}=node;return {...structuredClone(base),id:uid(),name:node.name+' · série '+(si+1),role:series.role,goals:structuredClone(series.goals)};});this.nodes().splice(index,1,...nodes);this.changed.emit();}
 canAddMetric(node:Pick<Step,'goals'>){return this.profile().metrics.some(metric=>!node.goals.some(target=>target.metric===metric));}
 addMetric(node:Pick<Step,'goals'>){const metric=this.profile().metrics.find(key=>!node.goals.some(target=>target.metric===key));if(metric)node.goals.push(goal(metric));this.changed.emit();}
 modeChanged(target:Goal,mode:Mode){target.mode=mode;delete target.min;delete target.max;const value=Math.max(1,METRICS[target.metric].min);if(mode==='range'||mode==='exact'){target.min=value;target.max=value;}else if(mode==='min')target.min=value;else if(mode==='max')target.max=value;this.changed.emit();}
 metricChanged(target:Goal,metric:Metric){target.metric=metric;this.modeChanged(target,target.mode);}
 exactChanged(target:Goal){if(target.mode==='exact')target.max=target.min;this.changed.emit();}
}
