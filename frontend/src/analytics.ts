import { summarize, validSet } from './domain.ts';
import type { Exercise, Session, Series } from './domain';

export type Tone = 'positive' | 'attention' | 'neutral' | 'stable';
export interface Indicator { label: string; value: string; message: string; tone: Tone; percent?: number }
export interface ExerciseAnalysis { name: string; previousSessionId: string | null; indicators: Indicator[] }
export interface Analysis { sessionId: string; methodVersion: 1; indicators: Indicator[]; exercises: ExerciseAnalysis[] }
export interface SeriesAssessment {tone:Tone;label:string;comment:string}
export function assessSeries(exercise:Exercise,set:Series):SeriesAssessment {
  if(!set.done)return {tone:'neutral',label:'Pendente',comment:'Confirme a série para avaliar a meta.'};
  if(!validSet(set))return {tone:'neutral',label:'Revisar registro',comment:'Confira carga, repetições e RIR.'};
  const goal=exercise.metrics;
  if(!goal || !Number.isInteger(goal.repMin) || !Number.isInteger(goal.repMax) || goal.repMin<1 || goal.repMax<goal.repMin)return {tone:'neutral',label:'Registrada · sem meta',comment:'Esta ficha não tem uma faixa de repetições válida.'};
  if(set.reps!<goal.repMin)return {tone:'attention',label:'Abaixo da meta',comment:`${set.reps} reps; faltaram ${goal.repMin-set.reps!} para o mínimo de ${goal.repMin}.`};
  if(set.reps!>goal.repMax)return {tone:'attention',label:'Acima da faixa',comment:`${set.reps} reps; o planejado era ${goal.repMin}–${goal.repMax}.`};
  return {tone:'positive',label:'Meta atingida',comment:`${set.reps} reps dentro da faixa de ${goal.repMin}–${goal.repMax}.`};
}
export function exerciseAssessment(exercise:Exercise) {
  const registered=exercise.sets.filter(set=>set.done && validSet(set));
  const matched=registered.filter(set=>assessSeries(exercise,set).tone==='positive').length;
  const outside=registered.filter(set=>assessSeries(exercise,set).tone==='attention').length;
  const unknown=registered.length-matched-outside;
  const complete=exercise.sets.length>0 && registered.length===exercise.sets.length;
  const tone:Tone=!complete?'neutral':outside?'attention':unknown?'neutral':'positive';
  return {registered:registered.length,total:exercise.sets.length,matched,outside,unknown,complete,tone};
}
const round = (n: number) => new Intl.NumberFormat('pt-BR',{maximumFractionDigits:1}).format(n);
const full = (e: Exercise) => e.sets.length>0 && e.sets.every(s=>s.done && validSet(s));
function compatible(a: Exercise,b: Exercise): boolean {
  return !!a.metrics && !!b.metrics && a.metrics.key===b.metrics.key && a.metrics.loadBasis===b.metrics.loadBasis && a.metrics.setType===b.metrics.setType;
}
export function analyzeSession(session: Session, history: Session[]): Analysis {
  const totals=summarize(session);
  const result: Analysis={sessionId:session.id,methodVersion:1,indicators:[],exercises:[]};
  if(!totals.total){result.indicators.push({label:'Atividade',value:'Sem séries',message:'Esta atividade não usa métricas de musculação.',tone:'neutral'});return result;}
  result.indicators.push({label:'Registro',value:`${totals.confirmed}/${totals.total}`,message:totals.pending?`${totals.pending} ${totals.pending===1?'série pendente':'séries pendentes'}.`:'Todas as séries foram registradas.',tone:totals.pending?'neutral':'positive',percent:100*totals.confirmed/totals.total});
  result.indicators.push({label:'Volume registrado',value:`${round(totals.volume)} kg·rep`,message:'Soma de carga × repetições confirmadas.',tone:'neutral'});
  const earlier=history.filter(s=>s.id!==session.id && s.completed && Date.parse(s.date)<Date.parse(session.date)).sort((a,b)=>Date.parse(b.date)-Date.parse(a.date));
  for(const exercise of session.exercises){
    const confirmed=exercise.sets.filter(s=>s.done && validSet(s));
    const row: ExerciseAnalysis={name:exercise.name,previousSessionId:null,indicators:[]};
    if(exercise.metrics && confirmed.length){
      const inRange=confirmed.filter(s=>s.reps!>=exercise.metrics!.repMin && s.reps!<=exercise.metrics!.repMax).length;
      row.indicators.push({label:'Meta de repetições',value:`${inRange}/${confirmed.length}`,message:inRange===confirmed.length?'Séries registradas dentro da meta.':`${confirmed.length-inRange} ${confirmed.length-inRange===1?'série fora':'séries fora'} da faixa planejada.`,tone:inRange===confirmed.length?'positive':'attention',percent:100*inRange/confirmed.length});
    }else{row.indicators.push({label:'Meta de repetições',value:'Sem análise',message:!confirmed.length?'Confirme séries para analisar.':'A ficha antiga não possui metas estruturadas.',tone:'neutral'});}
    const previous=earlier.map(s=>({session:s,exercise:s.exercises.find(e=>compatible(exercise,e))})).find(pair=>pair.exercise);
    if(!previous?.exercise){row.indicators.push({label:'Evolução',value:'Sem comparação',message:'Ainda não há uma sessão anterior compatível.',tone:'neutral'});}
    else {
      const old=previous.exercise;row.previousSessionId=previous.session.id;
      if(!full(exercise)||!full(old)){row.indicators.push({label:'Evolução',value:'Dados incompletos',message:'Complete as duas sessões para comparar.',tone:'neutral'});}
      else {
        const diff=exercise.sets.length-old.sets.length;
        row.indicators.push({label:'Séries realizadas',value:`${diff>0?'+':''}${diff}`,message:diff>0?`Você fez ${diff} ${diff===1?'série a mais':'séries a mais'}.`:diff<0?`Você fez ${-diff} ${diff===-1?'série a menos':'séries a menos'}.`:'Você manteve o número de séries.',tone:'stable'});
        if(diff===0 && exercise.sets.every((s,i)=>s.kg===old.sets[i].kg)){
          const reps=exercise.sets.reduce((n,s,i)=>n+s.reps!-old.sets[i].reps!,0);
          row.indicators.push({label:'Repetições · mesma carga',value:`${reps>0?'+':''}${reps}`,message:reps>0?`Você fez ${reps} ${reps===1?'repetição a mais':'repetições a mais'}.`:reps<0?`Você fez ${-reps} ${reps===-1?'repetição a menos':'repetições a menos'}.`:'Você manteve carga e repetições.',tone:reps>0?'positive':reps<0?'attention':'stable'});
        } else {row.indicators.push({label:'Repetições',value:'Contexto diferente',message:'Carga ou número de séries mudou.',tone:'neutral'});}
      }
    }
    result.exercises.push(row);
  }
  return result;
}
export function analysisReport(sessions: Session[]) {return {schemaVersion:1,generatedAt:new Date().toISOString(),method:'Regras fixas; sem interpretação por IA. Pendências não representam séries não realizadas.',sessions:sessions.map(session=>analyzeSession(session,sessions))};}
