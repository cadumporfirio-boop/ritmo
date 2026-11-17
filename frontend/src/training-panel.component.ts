import {Component,input,output,signal,computed,inject} from '@angular/core';
import {FormsModule} from '@angular/forms';
import {TrainingStore} from './training.store';
import {TrainingNodeEditor} from './training-editor.component';
import {TrainingRunner} from './training-runner.component';
import {SPORTS,METRICS,MODES,workout,preset,step,group,uid,cloneNodes,expand,latestWorkouts,parseTraining,fromLegacy,goalLabel} from './training';
import type {Workout,TrainingLibrary} from './training';
import type {Session} from './domain';
import {profileFor,createStepForSport,createGroupForSport,createWorkoutForSport,presetForSport} from './sport-options';
import trainingSchema from '../../contracts/training.schema.json' with {type:'json'};

@Component({selector:'app-training-panel',standalone:true,imports:[FormsModule,TrainingNodeEditor,TrainingRunner],template:`
 @if(store.error()){<div class="warning" role="alert">{{store.error()}} <button class="secondary" (click)="exportLibrary()">Exportar cópia</button></div>}
 @if(message()){<div class="training-message" role="status">{{message()}}<button aria-label="Fechar mensagem" (click)="message.set('')">×</button></div>}
 @if(store.screen()==='run' && store.data().active;as active){<training-runner [session]="active" (changed)="store.touch()" (back)="store.screen.set('library')" (finish)="finish()" (message)="message.set($event)" />}
 @else if(store.screen()==='detail' && store.selected();as selected){<training-runner [session]="selected" [readonly]="true" (back)="store.screen.set('library')" />}
 @else if(store.screen()==='edit' && draft();as current){
  <section class="page-heading"><div><p class="eyebrow">EDITOR DE TREINOS</p><h1>Do seu jeito<span>.</span></h1><p>Monte etapas, blocos, voltas e metas próprias. A edição só é aplicada ao salvar.</p></div><button class="secondary" (click)="cancelEdit()">Cancelar edição</button></section>
  <section class="panel builder-settings"><div class="builder-two"><label>Nome do treino<input [(ngModel)]="current.title" maxlength="150" (ngModelChange)="draftChanged()"></label><label>Modalidade<select aria-label="Modalidade do treino" [ngModel]="current.sport" (ngModelChange)="changeSport($event)">@for(sport of sports;track sport.id){<option [value]="sport.id">{{sport.label}}</option>}</select></label></div><p class="builder-help">{{profile(current.sport).hint}}</p><label>Orientações gerais<textarea rows="2" [(ngModel)]="current.notes" maxlength="4000" (ngModelChange)="draftChanged()"></textarea></label><p class="builder-help">Cada bloco repete a sequência dos seus itens. Para uma supersérie, coloque A e B no mesmo bloco e escolha as voltas. Para um exercício isolado, repita um bloco com uma etapa.</p></section>
  <training-node-editor [nodes]="current.nodes" [sport]="current.sport" (changed)="draftChanged()" />
  <div class="builder-actions builder-add"><button class="secondary" (click)="current.nodes.push(newStep());draftChanged()">+ Etapa avulsa</button><button class="secondary" (click)="current.nodes.push(newGroup());draftChanged()">+ Bloco de etapas</button></div>
  <section class="panel builder-preview"><div class="section-top"><h2>Ordem de execução</h2><span>{{preview().length}} etapas</span></div>@if(previewError()){<p class="warning">{{previewError()}}</p>}@for(item of preview();track item.key;let i=$index){<div><b>{{i+1}}</b><span>{{item.step.name}}<small>{{item.trail}}</small><small>@for(target of item.step.goals;track target.metric){{{metrics[target.metric].label}}: {{label(target)}} · }</small></span></div>}</section>
  <div class="finish-bar"><span>{{editId?'Salvar cria uma nova versão da ficha.':'Ficha nova.'}}<small>Sessões em andamento e históricas não são alteradas.</small></span><button class="primary" (click)="save()">Salvar treino ✓</button></div>
 }
 @else if(historyOnly()){
  @if(legacyCandidates().length){<section class="panel"><h2>Aproveitar uma ficha antiga</h2><p class="builder-help">Copia apenas a estrutura. As anotações e os resultados originais permanecem intactos.</p>@for(session of legacyCandidates();track session.id){<button class="secondary legacy-copy" (click)="copyLegacy(session)">Copiar estrutura de {{session.name}} ↗</button>}</section>}
  @if(store.data().sessions.length){<section class="page-heading"><div><p class="eyebrow">SESSÕES ESTRUTURADAS</p><h2>Seu histórico nesta biblioteca</h2></div></section>@for(session of store.data().sessions.slice().reverse();track session.id){<section class="panel history-row"><span class="history-date">{{date(session.date)}}</span><div><h3>{{session.plan.title}}</h3><p>Ficha v{{session.plan.revision}} · {{session.entries.length}} etapas previstas · {{session.entries.filter(isDone).length}} registradas</p></div><button class="secondary" (click)="store.selected.set(session);store.screen.set('detail')">Consultar</button></section>}}
 }
 @else if(creating()){
 <section class="page-heading"><h1>Criar treino</h1><button class="secondary" (click)="creating.set(false)">Voltar ↗</button></section>
  <section class="panel"><div class="section-top"><h2>Escolha uma estrutura</h2><span>Exemplos editáveis</span></div><label class="sport-selection">Qual modalidade você quer montar?<select aria-label="Modalidade para montar" [ngModel]="creationSport()" (ngModelChange)="creationSport.set($event)">@for(sport of sports;track sport.id){<option [value]="sport.id">{{sport.label}}</option>}</select></label><p class="builder-help">{{profile(creationSport()).hint}}</p><p class="builder-help">Estes modelos demonstram a montagem; não são prescrições personalizadas.</p><div class="preset-buttons">@for(model of availableModels();track model.id){<button class="secondary" (click)="usePreset(model.id)">{{model.label}} ↗</button>}</div></section>
 <button class="primary" (click)="newWorkout()">Começar do zero →</button>
 }
 @else {
  <section class="page-heading"><div><h1>Treinos</h1></div><button class="primary" (click)="creating.set(true)">Criar treino +</button></section>
  @if(store.data().active;as active){<section class="panel training-active"><div><strong>Sessão em andamento: {{active.plan.title}}</strong><p>Versão {{active.plan.revision}} preservada, mesmo se você editar a ficha.</p></div><button class="primary" (click)="store.screen.set('run')">Continuar sessão →</button></section>}

  <div class="workout-library">@for(plan of plans();track plan.id){<section class="panel workout-library-card"><p class="eyebrow">{{sportLabel(plan.sport)}} · VERSÃO {{plan.revision}}</p><h2>{{plan.title}}</h2><p>{{count(plan)}} etapas · {{plan.notes || 'Sem orientação adicional.'}}</p><div class="builder-actions"><button class="primary" (click)="start(plan)">Iniciar treino →</button><button class="secondary" (click)="edit(plan)">Editar</button><button class="secondary" (click)="duplicate(plan)">Duplicar</button><button class="secondary" (click)="assigned.emit(plan);message.set('Treino associado ao dia selecionado na tela Hoje.')">Associar a {{selectedDay()}}</button><button class="text-button" (click)="exportPlan(plan)">Exportar ficha JSON ↗</button></div></section>}@empty{<section class="panel empty-state"><h2>Uma biblioteca para qualquer modalidade.</h2><p>Toque em Criar treino para começar.</p></section>}</div>
  <details class="panel import-panel"><summary>Importar / exportar</summary><p class="builder-help">Uma ficha é aberta para revisão antes de salvar. Uma biblioteca só substitui estes treinos após sua confirmação; o histórico antigo do Ritmo não é alterado.</p><label>Arquivo JSON<input type="file" accept=".json,application/json" (change)="readFile($event)"></label><label>Ou cole uma ficha estruturada<textarea rows="3" [(ngModel)]="importText" placeholder="JSON no contrato do Ritmo"></textarea></label><div class="builder-actions"><button class="secondary" (click)="importJson(importText)">Revisar JSON</button><button class="secondary" (click)="exportLibrary()">Exportar biblioteca e sessões</button><button class="text-button" (click)="exportSchema()">Baixar contrato para futura IA ↗</button></div>
  @if(pendingRestore();as pending){<div class="warning"><p>Cópia válida: {{pending.workouts.length}} versões e {{pending.sessions.length}} sessões. O conteúdo atual desta biblioteca será substituído. Uma cópia anterior será preservada no navegador.</p><div class="builder-actions"><button class="secondary" (click)="exportLibrary()">Exportar antes</button><button class="primary" (click)="restoreBackup()">Restaurar esta cópia</button><button class="secondary" (click)="pendingRestore.set(null)">Cancelar</button></div></div>}
  </details>

 }
`})
export class TrainingPanel {
 readonly store=inject(TrainingStore);
 historyOnly=input(false);readonly creating=signal(false);legacyBusy=input(false);legacy=input<Session[]>([]);selectedDay=input('dia selecionado');assigned=output<Workout>();
 readonly plans=computed(()=>latestWorkouts(this.store.data()));
 readonly legacyCandidates=computed(()=>this.legacy().filter(item=>item.exercises.length>0).slice(-5).reverse());
 readonly draft=signal<Workout|null>(null);readonly message=signal('');readonly pendingRestore=signal<TrainingLibrary|null>(null);
 readonly previewError=signal('');
 readonly preview=computed(()=>{const plan=this.draft();if(!plan)return [];try{return expand(plan);}catch{return [];}});
 sports=SPORTS;metrics=METRICS;label=goalLabel;profile=profileFor;editId='';importText='';
 models=[{id:'strength',label:'Séries tradicionais'},{id:'topback',label:'Top set + back-offs'},{id:'circuit',label:'Circuito / supersérie'},{id:'interval',label:'Intervalado'},{id:'rounds',label:'Rounds técnicos'}];
 readonly creationSport=signal('strength');
 readonly availableModels=computed(()=>this.models.filter(model=>profileFor(this.creationSport()).models.includes(model.id)));
 private initialNodesFingerprint='';
 newStep(){return createStepForSport(this.draft()?.sport??this.creationSport());}
 newGroup(){return createGroupForSport(this.draft()?.sport??this.creationSport());}
 changeSport(sport:string){const plan=this.draft();if(!plan)return;const untouched=!this.editId&&this.initialNodesFingerprint===JSON.stringify(plan.nodes);if(untouched){plan.nodes=createWorkoutForSport(sport).nodes;this.initialNodesFingerprint=JSON.stringify(plan.nodes);}else{this.initialNodesFingerprint='';this.message.set('Configuração existente preservada. Novas etapas seguem a modalidade escolhida.');}plan.sport=sport;this.creationSport.set(sport);this.draftChanged();}
 isDone=(entry:{done:boolean})=>entry.done;
 newWorkout(){this.creating.set(false);this.editId='';const plan=createWorkoutForSport(this.creationSport());this.initialNodesFingerprint=JSON.stringify(plan.nodes);this.draft.set(plan);this.store.screen.set('edit');this.message.set('');}
 usePreset(id:string){this.creating.set(false);this.editId='';this.initialNodesFingerprint='';this.draft.set(presetForSport(id,this.creationSport()));this.store.screen.set('edit');this.message.set('');}
 edit(plan:Workout){this.initialNodesFingerprint='';this.editId=plan.id;this.draft.set(structuredClone(plan));this.store.screen.set('edit');}
 duplicate(plan:Workout){this.initialNodesFingerprint='';this.editId='';this.draft.set({...structuredClone(plan),id:uid(),revision:1,title:plan.title+' · cópia',nodes:cloneNodes(plan.nodes)});this.store.screen.set('edit');}
 draftChanged(){this.draft.update(plan=>plan?{...plan,nodes:structuredClone(plan.nodes)}:null);try{expand(this.draft()!);this.previewError.set('');}catch(error){this.previewError.set(this.error(error));}}
 cancelEdit(){this.draft.set(null);this.store.screen.set('library');}
 save(){try{const plan=this.store.save(this.draft()!);this.draft.set(null);this.store.screen.set('library');this.message.set(`Treino salvo · versão ${plan.revision}.`);}catch(error){this.message.set(this.error(error));}}
 start(plan:Workout){if(this.legacyBusy()){this.message.set('Há uma sessão antiga em andamento. Finalize-a antes de iniciar outra.');return;}try{this.store.start(plan.id);}catch(error){this.message.set(this.error(error));}}
 finish(){try{this.store.finish();this.message.set('Sessão salva. Etapas pendentes não foram marcadas como realizadas.');}catch(error){this.message.set(this.error(error));}}
 count(plan:Workout){return expand(plan).length;}
 sportLabel(id:string){return SPORTS.find(sport=>sport.id===id)?.label??id;}
 date(raw:string){return new Date(raw).toLocaleDateString('pt-BR');}
 copyLegacy(session:Session){this.initialNodesFingerprint='';this.editId='';this.draft.set(fromLegacy(session));this.store.screen.set('edit');}
 download(name:string,data:unknown){const blob=new Blob([typeof data==='string'?data:JSON.stringify(data,null,2)],{type:'application/json'});const link=document.createElement('a');link.href=URL.createObjectURL(blob);link.download=name;link.click();setTimeout(()=>URL.revokeObjectURL(link.href),500);}
 exportLibrary(){this.download('ritmo-biblioteca.json',this.store.exportRaw());}
 exportPlan(plan:Workout){this.download('ritmo-ficha.json',plan);}
 exportSchema(){this.download('ritmo-contrato-treino.json',trainingSchema);}
 async readFile(event:Event){const file=(event.target as HTMLInputElement).files?.[0];if(!file)return;if(file.size>5000000){this.message.set('Arquivo maior que 5 MB.');return;}this.importJson(await file.text());(event.target as HTMLInputElement).value='';}
 importJson(text:string){this.initialNodesFingerprint='';try{const raw=JSON.parse(text);if(raw.kind==='library'){this.pendingRestore.set(parseTraining<TrainingLibrary>(raw,'library'));this.message.set('Confira a cópia antes de restaurar.');}else{const plan=parseTraining<Workout>(raw,'workout');this.editId='';this.draft.set({...plan,id:uid(),revision:1,nodes:cloneNodes(plan.nodes)});this.store.screen.set('edit');this.message.set('Ficha válida. Revise as metas e salve para adicioná-la à biblioteca.');}}catch(error){this.message.set(this.error(error));}}
 restoreBackup(){try{this.store.restore(this.pendingRestore()!);this.pendingRestore.set(null);this.message.set('Biblioteca restaurada. O histórico antigo do app não foi alterado.');}catch(error){this.message.set(this.error(error));}}
 error(error:unknown){return error instanceof Error?error.message:'Não foi possível concluir a operação.';}
}

