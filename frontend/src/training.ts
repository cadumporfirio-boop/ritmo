import Ajv from 'ajv';
import schema from '../../contracts/training.schema.json' with {type:'json'};
import type {Session as LegacySession} from './domain.ts';

export type Metric = 'reps'|'load'|'rir'|'rpe'|'duration'|'distance'|'heartRate'|'power'|'cadence'|'pace';
export type Mode = 'record'|'range'|'min'|'max'|'exact';
export interface Goal {metric:Metric;mode:Mode;required:boolean;min?:number;max?:number}
export interface TrainingSeries {id:string;role:string;goals:Goal[]}
export interface Step {kind:'step';id:string;name:string;role:string;equipment:string;notes:string;goals:Goal[];series?:TrainingSeries[]}
export interface Group {kind:'group';id:string;name:string;repeat:number;children:TrainingNode[]}
export type TrainingNode=Step|Group;
export interface Workout {kind:'workout';schemaVersion:2;id:string;revision:number;title:string;sport:string;notes:string;nodes:TrainingNode[]}
export interface Entry {key:string;stepId:string;values:Partial<Record<Metric,number>>;done:boolean;skipped:boolean;note:string;extra?:{afterKey:string;role:string;goals:Goal[]}}
export interface TrainingSession {kind:'session';schemaVersion:2;id:string;date:string;plan:Workout;entries:Entry[];completed:boolean;note:string}
export interface TrainingLibrary {kind:'library';schemaVersion:2;workouts:Workout[];sessions:TrainingSession[];active:TrainingSession|null}
export interface ExpandedStep {key:string;step:Step;trail:string;occurrence?:string}
export const MAX_EXPANDED_STEPS=300;
export const METRICS:Record<Metric,{label:string;unit:string;min:number;max:number;integer?:boolean}>={
 reps:{label:'Repetições',unit:'reps',min:0,max:1000,integer:true},load:{label:'Carga',unit:'kg',min:0,max:2000},
 rir:{label:'Repetições em reserva',unit:'RIR',min:0,max:10,integer:true},rpe:{label:'Esforço percebido',unit:'RPE 0–10',min:0,max:10},
 duration:{label:'Tempo',unit:'segundos',min:0.01,max:86400},distance:{label:'Distância',unit:'metros',min:0.01,max:1000000},
 heartRate:{label:'Frequência cardíaca',unit:'bpm',min:1,max:300,integer:true},power:{label:'Potência',unit:'W',min:0,max:10000},
 cadence:{label:'Cadência',unit:'rpm',min:0,max:500},pace:{label:'Ritmo',unit:'segundos/km',min:0.01,max:36000}
};
export const SPORTS=[{id:'strength',label:'Musculação'},{id:'running',label:'Corrida'},{id:'cycling',label:'Bicicleta'},{id:'swimming',label:'Natação'},{id:'martial',label:'Artes marciais'},{id:'mixed',label:'Misto / circuito'},{id:'other',label:'Outra modalidade'}];
export const ROLES=[{id:'warmup',label:'Aquecimento'},{id:'work',label:'Trabalho'},{id:'top',label:'Top set'},{id:'backoff',label:'Back-off'},{id:'drop',label:'Drop set'},{id:'recovery',label:'Recuperação / descanso'},{id:'technique',label:'Técnica'},{id:'cooldown',label:'Desaquecimento'},{id:'custom',label:'Outra etapa'}];
export const MODES=[{id:'record',label:'Apenas registrar'},{id:'range',label:'Dentro da faixa'},{id:'min',label:'Pelo menos'},{id:'max',label:'No máximo'},{id:'exact',label:'Valor exato'}];
const validateSchema=new Ajv({allErrors:true,strict:false}).compile(schema);
export const uid=()=>crypto.randomUUID();
export function blankLibrary():TrainingLibrary{return {kind:'library',schemaVersion:2,workouts:[],sessions:[],active:null};}
export function goal(metric:Metric,mode:Mode='record',min?:number,max?:number):Goal{return {metric,mode,required:true,...(min!==undefined?{min}:{}),...(max!==undefined?{max}:{})};}
export function step(name='Nova atividade'):Step{return {kind:'step',id:uid(),name,role:'work',equipment:'',notes:'',goals:[goal('reps','range',8,12)]};}
export function group(name='Novo bloco',repeat=1,children:TrainingNode[]=[step()]):Group{return {kind:'group',id:uid(),name,repeat,children};}
export function workout():Workout{return {kind:'workout',schemaVersion:2,id:uid(),revision:1,title:'Meu treino',sport:'strength',notes:'',nodes:[group('Exercício · séries',3)]};}
export function cloneNodes(nodes:TrainingNode[]):TrainingNode[]{return nodes.map(node=>node.kind==='step'?{...structuredClone(node),id:uid(),...(node.series?{series:node.series.map(series=>({...structuredClone(series),id:uid()}))}:{})}:{...structuredClone(node),id:uid(),children:cloneNodes(node.children)});}
export function expand(workout:Workout):ExpandedStep[]{
 const result:ExpandedStep[]=[];
 const walk=(nodes:TrainingNode[],prefix:string,trail:string,depth:number)=>{
  if(depth>4)throw Error('Use no máximo 4 níveis de blocos.');
  for(let i=0;i<nodes.length;i++){
   const node=nodes[i],key=prefix+i;
   if(node.kind==='step'){if(node.series){for(const [si,series] of node.series.entries())result.push({key:key+'s'+si,step:{...node,role:series.role,goals:series.goals},trail,occurrence:key});}else result.push({key,step:node,trail});}
   else {if(!Number.isInteger(node.repeat)||node.repeat<1||node.repeat>30)throw Error('Repetições do bloco: de 1 a 30.');for(let round=0;round<node.repeat;round++)walk(node.children,`${key}r${round}/`,`${trail?trail+' › ':''}${node.name}${node.repeat>1?' · volta '+(round+1)+'/'+node.repeat:''}`,depth+1);}
   if(result.length>MAX_EXPANDED_STEPS)throw Error('O treino excede 300 etapas executadas. Divida-o em sessões.');
  }
 };
 walk(workout.nodes,'','',0);return result;
}
export function metricValid(metric:Metric,value:unknown):value is number {const definition=METRICS[metric];return typeof value==='number'&&Number.isFinite(value)&&value>=definition.min&&value<=definition.max&&(!definition.integer||Number.isInteger(value));}
function checkWorkout(plan:Workout):void {
 const ids=new Set<string>();
 const walk=(nodes:TrainingNode[])=>{for(const node of nodes){if(ids.has(node.id))throw Error('Cada etapa ou bloco precisa de um identificador único.');ids.add(node.id);if(!node.name.trim())throw Error('Dê nome às atividades e aos blocos.');if(node.kind==='group')walk(node.children);else {if(node.series){for(const series of node.series){if(ids.has(series.id))throw Error('Identificador de série duplicado.');ids.add(series.id);}}for(const definition of [node,...(node.series??[])]){const metrics=new Set<Metric>();for(const target of definition.goals){if(metrics.has(target.metric))throw Error('Não repita uma métrica na mesma etapa.');metrics.add(target.metric);for(const value of [target.min,target.max])if(value!==undefined&&!metricValid(target.metric,value))throw Error(`Meta de ${METRICS[target.metric].label} fora dos limites.`);if(target.mode==='record'&&(target.min!==undefined||target.max!==undefined))throw Error('Uma métrica apenas registrada não tem limite de meta.');if(target.mode==='range'&&target.min!>target.max!)throw Error('O mínimo da meta não pode superar o máximo.');if(target.mode==='exact'&&target.min!==target.max)throw Error('A meta exata precisa ter limites iguais.');}}}}};
 if(!plan.title.trim())throw Error('Dê um nome ao treino.');walk(plan.nodes);expand(plan);
}
export function entryValid(target:Step,entry:Entry):boolean {
 const allowed=new Set(target.goals.map(g=>g.metric));
 if(Object.keys(entry.values).some(key=>!allowed.has(key as Metric)))return false;
 return target.goals.every(g=>entry.values[g.metric]===undefined?!g.required:metricValid(g.metric,entry.values[g.metric]));
}
function checkSession(session:TrainingSession):void {
 checkWorkout(session.plan);
 if(!Number.isFinite(Date.parse(session.date)))throw Error('Data de sessão inválida.');
 const planned=expand(session.plan),original=session.entries.filter(entry=>!entry.extra);if(original.length!==planned.length)throw Error('O registro não corresponde às etapas da ficha.');if(original.some((entry,i)=>entry.key!==planned[i].key))throw Error('Identificação de etapa incompatível.');
 const expanded=sessionExpansion(session);
 if(expanded.length!==session.entries.length)throw Error('O registro não corresponde às etapas da ficha.');
 for(let i=0;i<expanded.length;i++){const item=expanded[i],entry=session.entries[i];if(entry.key!==item.key||entry.stepId!==item.step.id)throw Error('Identificação de etapa incompatível.');if(entry.done&&entry.skipped)throw Error('Uma etapa não pode estar concluída e não realizada ao mesmo tempo.');if(entry.done&&!entryValid(item.step,entry))throw Error('Etapa concluída sem registros obrigatórios válidos.');if(Object.keys(entry.values).some(key=>!item.step.goals.some(g=>g.metric===key)))throw Error('Há métricas que não pertencem à etapa.');}
}
export function parseTraining<T extends Workout|TrainingSession|TrainingLibrary>(raw:unknown,kind:T['kind']):T {
 const serialized=JSON.stringify(raw);
 if(!serialized)throw Error('Arquivo sem dados de treino.');
 if(new TextEncoder().encode(serialized).length>5000000)throw Error('O arquivo excede o limite de 5 MB.');
 if(!validateSchema(raw))throw Error('Formato de treino inválido. Confira campos, unidades e limites.');
 const data=raw as T;if(data.kind!==kind)throw Error('Este arquivo é de outro tipo.');
 if(data.kind==='workout')checkWorkout(data);
 else if(data.kind==='session')checkSession(data);
 else {if(data.active?.completed || data.sessions.some(session=>!session.completed))throw Error('O estado da sessão não corresponde à posição no histórico.');const versions=new Set<string>(),sessions=new Set<string>();for(const plan of data.workouts){checkWorkout(plan);const key=plan.id+':'+plan.revision;if(versions.has(key))throw Error('Versão de ficha duplicada.');versions.add(key);}for(const session of [...data.sessions,...(data.active?[data.active]:[])]){checkSession(session);if(sessions.has(session.id))throw Error('Sessão duplicada.');sessions.add(session.id);}}
 return structuredClone(data);
}
export function sessionExpansion(session:TrainingSession):ExpandedStep[]{
 const base=expand(session.plan),byKey=new Map(base.map(item=>[item.key,item]));
 const keys=new Set<string>();let extras=0;
 return session.entries.map(entry=>{if(keys.has(entry.key))throw Error('Registro duplicado.');keys.add(entry.key);if(entry.extra){const anchor=byKey.get(entry.extra.afterKey);if(!anchor||anchor.step.id!==entry.stepId||byKey.has(entry.key)||++extras>100)throw Error('Série extra incompatível.');const definition={...anchor.step,role:entry.extra.role,goals:entry.extra.goals};checkWorkout({...session.plan,nodes:[{...definition,series:undefined}]});return {...anchor,key:entry.key,step:definition};}const item=byKey.get(entry.key);if(!item)throw Error('Registro sem etapa.');return item;});
}
export function addSessionSeries(session:TrainingSession,afterKey:string):void {
 if(session.completed||session.entries.length>=300||session.entries.filter(entry=>entry.extra).length>=100)throw Error('Não é possível adicionar mais séries.');
 const anchor=expand(session.plan).find(item=>item.key===afterKey);if(!anchor)throw Error('Etapa não encontrada.');
 session.entries.push({key:'extra_'+uid(),stepId:anchor.step.id,values:{},done:false,skipped:false,note:'',extra:{afterKey,role:anchor.step.role,goals:structuredClone(anchor.step.goals)}});
}
export function startStructured(plan:Workout):TrainingSession {
 const snapshot=parseTraining<Workout>(plan,'workout');
 return {kind:'session',schemaVersion:2,id:uid(),date:new Date().toISOString(),plan:snapshot,entries:expand(snapshot).map(item=>({key:item.key,stepId:item.step.id,values:{},done:false,skipped:false,note:''})),completed:false,note:''};
}
export function latestWorkouts(library:TrainingLibrary):Workout[]{const map=new Map<string,Workout>();for(const plan of library.workouts)if(!map.has(plan.id)||map.get(plan.id)!.revision<plan.revision)map.set(plan.id,plan);return [...map.values()];}
export function saveRevision(library:TrainingLibrary,draft:Workout):Workout {
 const latest=latestWorkouts(library).find(p=>p.id===draft.id);
 if(latest&&JSON.stringify({...draft,revision:latest.revision})===JSON.stringify(latest))return latest;
 const saved=parseTraining<Workout>({...draft,revision:(latest?.revision??0)+1},'workout');
 if(library.workouts.length>=500)throw Error('Limite de versões atingido. Exporte uma cópia antes de continuar.');
 library.workouts.push(saved);return saved;
}
export function preset(type:string):Workout {
 const plan=workout();
 const activity=(name:string,goals:Goal[],role='work'):Step=>({...step(name),role,goals});
 const optionalRir={...goal('rir'),required:false};
 if(type==='topback'){
  plan.title='Exemplo · top set e back-offs';
  const exercise=activity('Supino',[goal('load'),goal('reps','range',6,8),optionalRir]);exercise.series=[{id:uid(),role:'top',goals:structuredClone(exercise.goals)},...Array.from({length:2},()=>({id:uid(),role:'backoff',goals:[goal('load'),goal('reps','range',10,12),structuredClone(optionalRir)]}))];plan.nodes=[group('Superiores',1,[exercise])];
 }else if(type==='interval'){
  plan.title='Exemplo · corrida intervalada';plan.sport='running';
  plan.nodes=[activity('Aquecimento',[goal('duration','min',300)],'warmup'),group('Intervalos',5,[activity('Trecho de corrida',[goal('distance','min',400),{...goal('duration'),required:false}]),activity('Recuperação',[goal('duration','min',60)],'recovery')]),activity('Desaquecimento',[goal('duration','min',180)],'cooldown')];
 }else if(type==='circuit'){
  plan.title='Exemplo · circuito';plan.sport='mixed';
  plan.nodes=[group('Circuito',3,[activity('Flexão',[goal('reps','range',8,12)]),activity('Bicicleta',[goal('duration','min',60)]),activity('Descanso entre voltas',[goal('duration','min',30)],'recovery')])];
 }else if(type==='rounds'){
  plan.title='Exemplo · rounds técnicos';plan.sport='martial';
  plan.nodes=[group('Rounds',3,[activity('Round técnico',[goal('duration','min',180),{...goal('rpe'),required:false}],'technique'),activity('Intervalo',[goal('duration','min',60)],'recovery')])];
 }else{plan.title='Exemplo · séries tradicionais';const exercise=activity('Supino com halteres',[goal('load'),goal('reps','range',8,12),optionalRir]);exercise.series=Array.from({length:3},()=>({id:uid(),role:'work',goals:structuredClone(exercise.goals)}));plan.nodes=[group('Superiores',1,[exercise])];}
 plan.notes='Modelo de estrutura para edição. Valores ilustrativos; ajuste ao seu planejamento.';
 return plan;
}
export function evaluateEntry(target:Step,entry:Entry):{tone:'positive'|'attention'|'neutral';label:string;message:string} {
 if(entry.skipped)return {tone:'neutral',label:'Não realizada',message:'Não foi contada como concluída.'};
 if(!entry.done)return {tone:'neutral',label:'Pendente',message:'Registre e confirme esta etapa.'};
 if(!entryValid(target,entry))return {tone:'neutral',label:'Registro incompleto',message:'Confira os campos obrigatórios.'};
 const assessed=target.goals.filter(g=>g.mode!=='record');
 const missing=assessed.filter(g=>entry.values[g.metric]===undefined);
 const outside=assessed.filter(g=>{const value=entry.values[g.metric];return value!==undefined&&((g.mode!=='max'&&value<g.min!)||(g.mode!=='min'&&value>g.max!));});
 if(outside.length)return {tone:'attention',label:'Fora da meta',message:outside.map(g=>`${METRICS[g.metric].label}: ${entry.values[g.metric]} ${METRICS[g.metric].unit}; meta ${goalLabel(g)}.`).join(' ')};
 if(missing.length||!assessed.length)return {tone:'neutral',label:'Etapa registrada',message:missing.length?'Faltam métricas opcionais para avaliar todas as metas.':'Sem meta numérica para classificar o resultado.'};
 return {tone:'positive',label:'Metas atingidas',message:'Os valores registrados estão dentro das metas desta etapa.'};
}
export function goalLabel(target:Goal):string {const unit=METRICS[target.metric].unit;return target.mode==='record'?`registrar (${unit})`:target.mode==='min'?`≥ ${target.min} ${unit}`:target.mode==='max'?`≤ ${target.max} ${unit}`:target.mode==='exact'?`${target.min} ${unit}`:`${target.min}–${target.max} ${unit}`;}
export function fromLegacy(session:LegacySession):Workout {
 const plan=workout();plan.title=session.name;plan.notes='Cópia da estrutura de uma sessão antiga. Os registros originais permanecem no histórico.';
 plan.nodes=[group('Treino',1,session.exercises.map(exercise=>({...step(exercise.name),equipment:exercise.metrics?.loadBasis??'',series:exercise.sets.map(()=>({id:uid(),role:'work',goals:[goal('load'),exercise.metrics?goal('reps','range',exercise.metrics.repMin,exercise.metrics.repMax):goal('reps'),{...goal('rir'),required:false}]}))})))];
 return plan;
}
