import { bootstrapApplication } from '@angular/platform-browser';
import { Component, signal, computed, effect } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { AnalysisComponent } from './analysis.component';
import { analysisReport, assessSeries, exerciseAssessment } from './analytics';
import { initialState, restore, createSession, validSet, summarize, finishSession, isExtraSeries, removeExtraSeries, exerciseCompleted, setExerciseCompletion } from './domain';
import type { State, Activity, Series, Exercise } from './domain';

@Component({selector:'app-root',standalone:true,imports:[FormsModule,AnalysisComponent],templateUrl:'./app.html'})
class App {
  readonly state = signal<State>(initialState());
  readonly tab = signal('today');
  readonly view = signal<'home'|'workout'|'review'>('home');
  readonly toast = signal('');
  readonly storageError = signal(false);
  readonly corruptStorage = signal(false);
  readonly busy = signal(false);
  readonly aiMessage = signal('');
  readonly dirty = signal(0);
  readonly selection = signal(Math.max(0,(new Date().getDay()+6)%7));
  readonly activity = computed(()=>this.state().week[this.selection()]);
  readonly summary = computed(()=>{this.dirty();return this.state().active?summarize(this.state().active!):{confirmed:0,total:0,volume:0,pending:0};});
  readonly today = new Intl.DateTimeFormat('pt-BR',{weekday:'long',day:'numeric',month:'long'}).format(new Date());
  readonly weekCount = computed(()=>this.state().week.filter(a=>a.type!=='rest').length);
  minutes = 45;
  editing = false;
  backup: Activity[] | null = null;
  removedSeries: {sessionId:string;exerciseId:string;index:number;set:Series} | null = null;
  private toastTimer?: ReturnType<typeof setTimeout>;
  private originalStoredData: string | null = null;
  constructor(){
    try {this.originalStoredData=localStorage.getItem('ritmo.v1');this.state.set(restore(this.originalStoredData));} catch {this.corruptStorage.set(true);this.notify('Não foi possível ler os dados salvos. O conteúdo original foi preservado.');}
    effect(()=>{const state=this.state();this.dirty();if(!this.corruptStorage())try{localStorage.setItem('ritmo.v1',JSON.stringify(state));this.storageError.set(false);}catch{this.storageError.set(true);}});
  }
  touch(){this.state.update(s=>({...s}));this.dirty.update(n=>n+1);}
  notify(message:string){this.toast.set(message);clearTimeout(this.toastTimer);this.toastTimer=setTimeout(()=>this.toast.set(''),5500);}
  navigate(tab:string){this.tab.set(tab);this.view.set('home');}
  selectDay(index:number){this.selection.set(index);this.minutes=this.activity().minutes||30;}
  start(){
    if(this.state().active){this.view.set('workout');return;}
    if(this.activity().type==='rest'){this.notify('Dia reservado para descanso e seus compromissos. Você pode editar a semana.');return;}
    const session=createSession(this.activity(),this.minutes);
    for(const exercise of session.exercises){
      const previous=[...this.state().sessions].reverse().flatMap(s=>s.exercises).find(e=>e.name===exercise.name);
      const set=previous?.sets.find(s=>s.done);
      if(set) exercise.previous=`Último registro: ${set.kg} kg × ${set.reps} repetições`;
    }
    this.state.update(s=>({...s,active:session}));this.view.set('workout');
  }
  confirm(set:Series){if(set.done){set.done=false;this.touch();return;}if(!validSet(set)){this.notify('Preencha carga (zero é permitido) e repetições válidas. RIR é opcional, de 0 a 10.');return;}set.done=true;this.touch();}
  changed(set:Series){set.done=false;this.touch();}
  finish(){const active=this.state().active;if(!active)return;if(active.exercises.some(e=>e.sets.some(s=>s.done&&!validSet(s)))){this.notify('Revise os valores das séries confirmadas.');return;}this.state.update(s=>({...s,sessions:[...s.sessions,finishSession(active)],active:null}));this.view.set('home');this.tab.set('history');this.notify('Sessão salva. Campos pendentes não foram considerados realizados.');}
  editSession(id:string){if(this.state().active){this.notify('Finalize a sessão em andamento antes de revisar outra.');return;}const session=this.state().sessions.find(s=>s.id===id);if(!session)return;this.state.update(s=>({...s,active:structuredClone(session),sessions:s.sessions.filter(x=>x.id!==id)}));this.view.set('review');}
  saveWeek(){this.editing=false;this.touch();this.notify('Semana atualizada neste dispositivo.');}
  moveDay(index:number){if(!this.state().profile.autonomy){this.notify('Ative a reorganização no perfil para mover atividades.');return;}this.backup=structuredClone(this.state().week);const next=(index+1)%7;this.state.update(s=>{const week=structuredClone(s.week);const a=week[index],b=week[next];week[index]={...b,day:a.day};week[next]={...a,day:b.day};return {...s,week};});this.notify('Atividades trocadas com o dia seguinte. Você pode desfazer.');}
  undo(){if(this.backup){const week=this.backup;this.state.update(s=>({...s,week}));this.backup=null;this.notify('Semana anterior restaurada.');}}
  exportData(){const content=this.corruptStorage()&&this.originalStoredData!==null?this.originalStoredData:JSON.stringify(this.state(),null,2);const blob=new Blob([content],{type:'application/json'});const link=document.createElement('a');link.href=URL.createObjectURL(blob);link.download='ritmo-meus-dados.json';link.click();setTimeout(()=>URL.revokeObjectURL(link.href),500);}
  async requestAI(){this.busy.set(true);this.aiMessage.set('');try{const response=await fetch('/api/planning',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({profile:this.state().profile,week:this.state().week})});const body=await response.json();this.aiMessage.set(body.message||'Não foi possível gerar o planejamento.');}catch{this.aiMessage.set('A API PHP ainda não está conectada. Você pode explorar o treino de exemplo e registrar sessões localmente.');}finally{this.busy.set(false);}}
  formatDate(date:string){return new Date(date).toLocaleDateString('pt-BR',{day:'2-digit',month:'short'});}
  stats = summarize;
  addSeries(exercise:Exercise){if(exercise.sets.length>=20){this.notify('Limite de 20 séries por exercício.');return;}exercise.sets.push({kg:null,reps:null,rir:null,done:false});this.touch();}
  isExtra = isExtraSeries;
  assessSeries = assessSeries;
  exerciseAssessment = exerciseAssessment;
  exerciseCompleted = exerciseCompleted;
  completeExercise(exercise:Exercise){const reopen=exerciseCompleted(exercise);const result=setExerciseCompletion(exercise,!reopen);if(!result.success){this.notify(`Preencha ou corrija ${result.missing} ${result.missing===1?'série':'séries'} antes de concluir o exercício.`);return;}this.touch();this.notify(reopen?'Exercício reaberto. As anotações foram mantidas.':'Exercício registrado. Confira as cores e os comentários de cada série.');}
  removeSeries(exercise:Exercise,index:number){const session=this.state().active;if(!session)return;const set=removeExtraSeries(exercise,index);if(!set)return;this.removedSeries={sessionId:session.id,exerciseId:exercise.id,index,set};this.touch();this.notify('Série extra removida. Você pode desfazer.');}
  undoSeries(){const removed=this.removedSeries;const session=this.state().active;if(!removed||session?.id!==removed.sessionId)return;const exercise=session.exercises.find(e=>e.id===removed.exerciseId);if(!exercise||exercise.sets.length>=20){this.notify('Não há espaço para restaurar a série.');return;}exercise.sets.splice(Math.min(removed.index,exercise.sets.length),0,removed.set);this.removedSeries=null;this.touch();this.notify('Série restaurada com suas anotações.');}
  exportAnalysis(){const blob=new Blob([JSON.stringify(analysisReport(this.state().sessions),null,2)],{type:'application/json'});const link=document.createElement('a');link.href=URL.createObjectURL(blob);link.download='ritmo-analises.json';link.click();setTimeout(()=>URL.revokeObjectURL(link.href),500);}
}
bootstrapApplication(App).catch(console.error);
