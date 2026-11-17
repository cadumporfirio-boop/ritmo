import {METRICS,ROLES,step,group,workout,preset,uid,goal} from './training.ts';
import type {Metric,Step,TrainingNode,Workout} from './training.ts';

interface SportProfile {
 roles:string[];metrics:Metric[];models:string[];stepName:string;blockName:string;
 hint:string;equipmentHint:string;labels?:Record<string,string>;
}
const common=['warmup','work','recovery','technique','cooldown','custom'];
const free:SportProfile={roles:ROLES.map(role=>role.id),metrics:Object.keys(METRICS) as Metric[],models:['strength','topback','circuit','interval','rounds'],stepName:'Nova atividade',blockName:'Bloco livre',hint:'Modo livre: todas as etapas e métricas do sistema estão disponíveis.',equipmentHint:'Equipamento, unidade de referência ou local de execução'};
const profiles:Record<string,SportProfile>={
 strength:{roles:ROLES.map(role=>role.id),metrics:['reps','load','rir','rpe','duration','distance','heartRate'],models:['strength','topback','circuit'],stepName:'Novo exercício',blockName:'Exercício · séries',hint:'Séries, carga, repetições, esforço e técnicas de musculação.',equipmentHint:'Ex.: kg por halter, barra com anilhas, peso corporal'},
 running:{roles:common,metrics:['duration','distance','pace','heartRate','rpe','cadence'],models:['interval'],stepName:'Trecho de corrida',blockName:'Bloco de corrida',hint:'Trechos, intervalos, tempo, distância, ritmo e esforço.',equipmentHint:'Ex.: pista, esteira, referência da cadência',labels:{work:'Trecho de corrida'}},
 cycling:{roles:common,metrics:['duration','distance','power','cadence','heartRate','rpe'],models:['interval'],stepName:'Trecho de bicicleta',blockName:'Bloco de ciclismo',hint:'Trechos, intervalos, tempo, distância, potência e cadência.',equipmentHint:'Ex.: bicicleta, rolo ou equipamento da academia',labels:{work:'Trecho de ciclismo'}},
 swimming:{roles:common,metrics:['duration','distance','pace','rpe','heartRate','reps'],models:['interval'],stepName:'Percurso de natação',blockName:'Bloco de natação',hint:'Percursos, séries, técnica, distância, tempo e esforço.',equipmentHint:'Ex.: piscina de 25 m, estilo, equipamento de apoio',labels:{work:'Série / percurso'}},
 martial:{roles:common,metrics:['duration','rpe','heartRate','reps'],models:['rounds'],stepName:'Novo round',blockName:'Rounds / sequência técnica',hint:'Rounds, técnica, recuperação, tempo e esforço. Técnicas de musculação não aparecem nas novas etapas.',equipmentHint:'Ex.: tatame, saco de pancada, luvas ou parceiro',labels:{work:'Round / prática',technique:'Técnica / sequência de golpes'}},
 mixed:free,other:free
};
export function profileFor(sport:string):SportProfile{return profiles[sport]??free;}
export function roleOptions(sport:string,current?:string){const profile=profileFor(sport);return ROLES.filter(role=>profile.roles.includes(role.id)||role.id===current).map(role=>({...role,label:(profile.labels?.[role.id]??role.label)+(profile.roles.includes(role.id)?'':' · já configurado'),retained:!profile.roles.includes(role.id)}));}
export function metricOptions(sport:string,current?:Metric){const profile=profileFor(sport);const ids=[...profile.metrics];if(current&&!ids.includes(current))ids.push(current);return ids.map(id=>({id,...METRICS[id],label:METRICS[id].label+(profile.metrics.includes(id)?'':' · já configurada'),retained:!profile.metrics.includes(id)}));}
export function hasRetainedOptions(node:Pick<Step,'role'|'goals'>,sport:string){const profile=profileFor(sport);return !profile.roles.includes(node.role)||node.goals.some(target=>!profile.metrics.includes(target.metric));}
export function createStepForSport(sport:string):Step {
 const profile=profileFor(sport),node=step(profile.stepName);
 if(sport!=='strength')node.goals=profile===free?[]:[{metric:profile.metrics[0],mode:'record',required:true}];
 if(sport==='strength'){node.goals=[goal('load'),goal('reps','range',8,12),{...goal('rir'),required:false}];node.series=Array.from({length:3},()=>({id:uid(),role:node.role,goals:structuredClone(node.goals)}));}
 return node;
}
export function createGroupForSport(sport:string){return group(profileFor(sport).blockName,1,[createStepForSport(sport)]);}
export function createWorkoutForSport(sport:string):Workout {const plan=workout();plan.sport=sport;const root=createGroupForSport(sport);plan.nodes=[root];return plan;}
export function presetForSport(type:string,sport:string):Workout {
 const plan=preset(type);plan.sport=sport;
 if(type==='interval'&&sport==='cycling'){plan.title='Exemplo · ciclismo intervalado';walkNames(plan.nodes,'Trecho de corrida','Trecho de bicicleta');}
 if(type==='interval'&&sport==='swimming'){plan.title='Exemplo · natação intervalada';walkNames(plan.nodes,'Trecho de corrida','Percurso de natação');}
 return plan;
}
function walkNames(nodes:TrainingNode[],previous:string,next:string):void {for(const node of nodes){if(node.kind==='group')walkNames(node.children,previous,next);else if(node.name===previous)node.name=next;}}
