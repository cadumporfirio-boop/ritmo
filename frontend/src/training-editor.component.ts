import {Component,input,output,forwardRef} from '@angular/core';
import {FormsModule} from '@angular/forms';
import {METRICS,ROLES,MODES,step,group,goal,cloneNodes} from './training';
import type {TrainingNode,Step,Goal,Mode,Metric} from './training';

@Component({selector:'training-node-editor',standalone:true,imports:[FormsModule,forwardRef(()=>TrainingNodeEditor)],template:`
 @for(node of nodes();track node.id;let i=$index){
  <article class="builder-node" [class.builder-group]="node.kind==='group'">
   <div class="builder-node-head"><span>{{node.kind==='group'?'BLOCO':'ETAPA'}} {{i+1}}</span><div class="builder-actions"><button type="button" (click)="move(i,-1)" [disabled]="i===0" aria-label="Mover item para cima">↑</button><button type="button" (click)="move(i,1)" [disabled]="i===nodes().length-1" aria-label="Mover item para baixo">↓</button><button type="button" (click)="duplicate(i)">Duplicar</button><button type="button" class="builder-remove" (click)="remove(i)">Remover</button></div></div>
   <label>Nome<input [(ngModel)]="node.name" maxlength="150" (ngModelChange)="changed.emit()" [attr.aria-label]="'Nome do item '+(i+1)"></label>
   @if(node.kind==='group'){
    <label>Voltas deste bloco<input type="number" min="1" max="30" step="1" [(ngModel)]="node.repeat" (ngModelChange)="changed.emit()"></label>
    <p class="builder-help">A sequência abaixo será executada nesta ordem, em cada volta.</p>
    <training-node-editor [nodes]="node.children" [depth]="depth()+1" (changed)="changed.emit()" />
    <div class="builder-actions"><button type="button" class="secondary" (click)="node.children.push(newStep());changed.emit()">+ Etapa</button>@if(depth()<3){<button type="button" class="secondary" (click)="node.children.push(newGroup());changed.emit()">+ Bloco interno</button>}</div>
   }@else{
    <div class="builder-two"><label>Tipo de etapa<select [(ngModel)]="node.role" (ngModelChange)="changed.emit()">@for(role of roles;track role.id){<option [value]="role.id">{{role.label}}</option>}</select></label><label>Equipamento / referência de carga<input [(ngModel)]="node.equipment" maxlength="150" placeholder="Ex.: kg por halter, piscina de 25 m" (ngModelChange)="changed.emit()"></label></div>
    <label>Instruções<textarea rows="2" [(ngModel)]="node.notes" maxlength="2000" (ngModelChange)="changed.emit()" placeholder="Cadência, técnica, execução, observações…"></textarea></label>
    <h4>O que registrar e avaliar</h4>
    @for(target of node.goals;track $index;let gi=$index){
     <div class="builder-goal"><div class="builder-two"><label>Métrica<select [ngModel]="target.metric" (ngModelChange)="metricChanged(target,$event)">@for(metric of metricList;track metric.id){<option [value]="metric.id">{{metric.label}} · {{metric.unit}}</option>}</select></label><label>Regra<select [ngModel]="target.mode" (ngModelChange)="modeChanged(target,$event)">@for(mode of modes;track mode.id){<option [value]="mode.id">{{mode.label}}</option>}</select></label></div>
     <div class="builder-two">@if(target.mode!=='record' && target.mode!=='max'){<label>{{target.mode==='exact'?'Valor':'Mínimo'}} ({{metrics[target.metric].unit}})<input type="number" [min]="metrics[target.metric].min" [max]="metrics[target.metric].max" [step]="metrics[target.metric].integer?1:0.1" [(ngModel)]="target.min" (ngModelChange)="exactChanged(target)"></label>}@if(target.mode==='range'||target.mode==='max'){<label>Máximo ({{metrics[target.metric].unit}})<input type="number" [min]="metrics[target.metric].min" [max]="metrics[target.metric].max" [step]="metrics[target.metric].integer?1:0.1" [(ngModel)]="target.max" (ngModelChange)="changed.emit()"></label>}</div>
     <div class="builder-goal-bottom"><label class="checkbox-label"><input type="checkbox" [(ngModel)]="target.required" (ngModelChange)="changed.emit()">Obrigatório para concluir</label><button type="button" class="text-button" (click)="node.goals.splice(gi,1);changed.emit()">Retirar métrica ×</button></div></div>
    }
    <button type="button" class="secondary" (click)="addMetric(node)" [disabled]="node.goals.length>=metricList.length">+ Métrica</button>
    @if(!node.goals.length){<p class="builder-help">Etapa livre: conclusão manual, sem classificação numérica.</p>}
   }
  </article>
 }
`})
export class TrainingNodeEditor {
 nodes=input.required<TrainingNode[]>();depth=input(0);changed=output<void>();
 metrics=METRICS;roles=ROLES;modes=MODES;
 metricList=Object.entries(METRICS).map(([id,definition])=>({id,...definition}));
 newStep=step;newGroup=group;
 move(index:number,direction:number){const other=index+direction;if(other<0||other>=this.nodes().length)return;[this.nodes()[index],this.nodes()[other]]=[this.nodes()[other],this.nodes()[index]];this.changed.emit();}
 remove(index:number){this.nodes().splice(index,1);this.changed.emit();}
 duplicate(index:number){this.nodes().splice(index+1,0,cloneNodes([this.nodes()[index]])[0]);this.changed.emit();}
 addMetric(node:Step){const metric=(Object.keys(METRICS) as Metric[]).find(key=>!node.goals.some(target=>target.metric===key));if(metric)node.goals.push(goal(metric));this.changed.emit();}
 modeChanged(target:Goal,mode:Mode){target.mode=mode;delete target.min;delete target.max;const value=Math.max(1,METRICS[target.metric].min);if(mode==='range'||mode==='exact'){target.min=value;target.max=value;}else if(mode==='min')target.min=value;else if(mode==='max')target.max=value;this.changed.emit();}
 metricChanged(target:Goal,metric:Metric){target.metric=metric;this.modeChanged(target,target.mode);}
 exactChanged(target:Goal){if(target.mode==='exact')target.max=target.min;this.changed.emit();}
}
