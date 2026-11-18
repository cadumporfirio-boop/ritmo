import {test} from 'node:test';
import assert from 'node:assert/strict';
import {newProgram,validateProgram,slotFromWorkout,copyWindow,copySlot,resolveSlot,adjustGoals,planningSummary,dateForDay,steps} from '../src/planning.ts';
import {preset,goal,uid,startStructured,parseTraining} from '../src/training.ts';
import trainingSchema from '../../contracts/training.schema.json' with {type:'json'};
import planningSchema from '../../contracts/planning.schema.json' with {type:'json'};
const program=()=>{const plan=newProgram();plan.context.objective='Objetivo informado pelo usuário';return plan;};
test('sequências independentes por sessão não impõem fases, números de semanas ou faixas por estímulo',()=>{
 const plan=program();plan.model='Ondulatório diário + semanal';const upper=['Força','Hipertrofia','Volume','Força','Volume','Hipertrofia'],all=['Hipertrofia','Volume','Força','Volume','Hipertrofia','Força'];
 for(let week=0;week<6;week++)for(const [offset,labels,name] of [[0,upper,'Upper'],[4,all,'All day']] as const){const slot=slotFromWorkout(preset('topback'),week*7+offset+1);slot.stimulus=labels[week];slot.label=name;plan.slots.push(slot);}
 const checked=validateProgram(plan);assert.equal(checked.periods.length,0);assert.equal(checked.slots.length,12);assert.deepEqual(checked.slots.filter(slot=>slot.label==='Upper').map(slot=>slot.stimulus),upper);assert.deepEqual(steps(checked.slots[0].workout.nodes)[0].series![0].goals,steps(checked.slots[1].workout.nodes)[0].series![0].goals);
 const short=program();short.durationDays=9;short.slots=[slotFromWorkout(preset('rounds'),9)];short.periods=[{id:uid(),kind:'micro',name:'Microciclo de 9 dias',startDay:1,durationDays:9,parentId:null,emphasis:''}];assert.doesNotThrow(()=>validateProgram(short));
});
test('cópia de intervalo e metas por série não alteram origem ou outras sessões',()=>{
 const plan=program(),base=preset('topback');const source=JSON.stringify(base);plan.slots=[slotFromWorkout(base,1)];const before=JSON.stringify(plan);const copy=copyWindow(plan,1,7,8);assert.equal(JSON.stringify(plan),before);assert.notEqual(copy.slots[0].id,copy.slots[1].id);
 const step=steps(copy.slots[1].workout.nodes)[0];copy.slots[1]=adjustGoals(copy.slots[1],step.id,step.series![0].id,[goal('reps','range',4,6),{...goal('rest','range',120,180),required:false},{...goal('percent1rm','range',70,80),required:false}]);
 assert.equal(steps(copy.slots[0].workout.nodes)[0].series![0].goals[1].min,6);assert.equal(step.series![0].goals[1].min,6);assert.equal(JSON.stringify(base),source);validateProgram(copy);
 assert.throws(()=>copyWindow(plan,1,7,40),/fora/);assert.throws(()=>copyWindow(plan,1,0,8),/fora/);
});
test('períodos opcionais têm hierarquia temporal sem confundir micro meso fase ou bloco de treino',()=>{
 const plan=program(),macro={id:uid(),kind:'macro' as const,name:'Temporada',startDay:1,durationDays:42,parentId:null,emphasis:''},meso={id:uid(),kind:'meso' as const,name:'Prioridade',startDay:2,durationDays:15,parentId:macro.id,emphasis:'Braços'};plan.periods=[macro,meso];validateProgram(plan);
 meso.parentId=meso.id;assert.throws(()=>validateProgram(plan),/Hierarquia/);meso.parentId=macro.id;macro.durationDays=20;meso.durationDays=21;assert.throws(()=>validateProgram(plan),/filho/);meso.durationDays=15;meso.parentId='inexistente';assert.throws(()=>validateProgram(plan),/Hierarquia/);
});
test('resolução preserva versão e contexto da sessão iniciada mesmo ao editar o ciclo',()=>{
 const plan=program();plan.revision=3;plan.slots=[slotFromWorkout(preset('strength'),1)];plan.slots[0].stimulus='Low volume';const resolved=resolveSlot(plan,plan.slots[0].id),session={...startStructured(resolved.workout),planning:resolved.origin};const before=JSON.stringify(session);
 plan.slots[0].workout.title='Nova abordagem';plan.slots[0].stimulus='Deload';plan.revision=4;assert.equal(JSON.stringify(session),before);assert.equal(session.planning.programRevision,3);assert.equal(session.planning.stimulus,'Low volume');parseTraining(session,'session');
});
test('volume usa músculos declarados e separa aquecimento sem inferir estímulo ou avaliar adequação',()=>{
 const plan=program(),slot=slotFromWorkout(preset('topback'),1),step=steps(slot.workout.nodes)[0];step.series![0].role='warmup';slot.exercises=[{stepId:step.id,stimulus:'Livre',primary:['Peito'],secondary:['Tríceps'],progressionIds:[],notes:''}];plan.slots=[slot,copySlot(slot,8)];
 const summary=planningSummary(plan,1,7);assert.equal(summary.sessions,1);assert.equal(summary.muscles[0].series,2);assert.equal(summary.muscles[0].warmup,1);assert.equal(summary.muscles[0].sessions,1);assert.equal(summary.muscles.length,1);assert.equal(planningSummary(plan,1,14).muscles[0].series,4);
});
test('contrato rejeita metas inválidas, referências órfãs, datas falsas e versões de formato desconhecidas',()=>{
 const plan=program();plan.slots=[slotFromWorkout(preset('strength'),43)];assert.throws(()=>validateProgram(plan),/fora/);plan.slots[0].day=1;plan.startDate='2026-02-30';assert.throws(()=>validateProgram(plan),/Data/);plan.startDate='2026-11-18';assert.match(dateForDay(plan,1),/18\/11/);
 plan.slots[0].exercises=[{stepId:'inexistente',stimulus:'',primary:[],secondary:[],progressionIds:[],notes:''}];assert.throws(()=>validateProgram(plan),/inexistente/);plan.slots[0].exercises[0].stepId=steps(plan.slots[0].workout.nodes)[0].id;plan.slots[0].exercises[0].progressionIds=['missing'];assert.throws(()=>validateProgram(plan),/progressão/);
 assert.throws(()=>validateProgram({...program(),schemaVersion:2}),/Formato/);assert.deepEqual(planningSchema.definitions,trainingSchema.definitions);
});
