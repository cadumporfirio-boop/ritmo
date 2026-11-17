import {test} from 'node:test';
import assert from 'node:assert/strict';
import {blankLibrary,preset,parseTraining,group,step,goal,expand,startStructured,saveRevision,evaluateEntry,entryValid,fromLegacy} from '../src/training.ts';
import type {Workout,TrainingSession,TrainingLibrary,Step,Group} from '../src/training.ts';
import {createSession,initialState} from '../src/domain.ts';

test('modelos de modalidades diferentes usam o mesmo contrato e a ordem correta',()=>{
 for(const [model,count] of [['strength',3],['topback',3],['circuit',9],['interval',12],['rounds',6]] as const){
  const plan=parseTraining<Workout>(preset(model),'workout');assert.equal(expand(plan).length,count);
 }
 const circuit=expand(preset('circuit'));
 assert.deepEqual(circuit.slice(0,6).map(item=>item.step.name),['Flexão','Bicicleta','Descanso entre voltas','Flexão','Bicicleta','Descanso entre voltas']);
 const top=expand(preset('topback'));assert.equal(top[0].step.role,'top');assert.equal(top[1].step.role,'backoff');
 assert.notEqual(top[1].key,top[2].key);
});
test('limita crescimento exponencial, profundidade e repetições inválidas',()=>{
 const huge=preset('strength');huge.nodes=[group('A',30,[group('B',30,[step()])])];
 assert.throws(()=>parseTraining<Workout>(huge,'workout'),/300/);
 const deep=preset('strength');let nested=step() as Workout['nodes'][number];for(let i=0;i<6;i++)nested=group('Bloco',1,[nested]);deep.nodes=[nested];
 assert.throws(()=>parseTraining<Workout>(deep,'workout'),/níveis/);
 const negative=preset('strength');(negative.nodes[0] as Group).repeat=0;assert.throws(()=>parseTraining(negative,'workout'));
});
test('rejeita metas incoerentes, duplicadas e campos desconhecidos',()=>{
 const plan=preset('strength'),target=((plan.nodes[0] as Group).children[0] as Step).series![0];
 target.goals=[goal('reps','range',12,8)];assert.throws(()=>parseTraining(plan,'workout'),/mínimo/);
 target.goals=[goal('rir','range',0,11)];assert.throws(()=>parseTraining(plan,'workout'),/limites/);
 target.goals=[goal('duration'),goal('duration')];assert.throws(()=>parseTraining(plan,'workout'),/repita/);
 target.goals=[goal('reps','exact',8,9)];assert.throws(()=>parseTraining(plan,'workout'),/iguais/);
 target.goals=[];assert.throws(()=>parseTraining({...plan,unknown:true},'workout'));
});
test('novas versões não alteram ficha nem valores das sessões iniciadas',()=>{
 const library=blankLibrary(),draft=preset('topback');const original=saveRevision(library,draft);
 const active=startStructured(original);const before=JSON.stringify(active);
 draft.title='Nova versão';(draft.nodes[0] as Group).children[0].name='Outro exercício';
 const updated=saveRevision(library,draft);
 assert.equal(updated.revision,2);assert.equal(active.plan.revision,1);assert.equal(JSON.stringify(active),before);
 assert.equal(library.workouts.length,2);
 saveRevision(library,updated);assert.equal(library.workouts.length,2);
});
test('metas usam suas próprias unidades e não exigem peso em etapas por tempo',()=>{
 const plan=preset('rounds'),session=startStructured(plan),target=expand(plan)[0].step,entry=session.entries[0];
 assert.equal(entryValid(target,entry),false);entry.values.duration=180;entry.done=true;
 assert.equal(entryValid(target,entry),true);assert.equal(evaluateEntry(target,entry).tone,'positive');
 entry.values.duration=120;assert.equal(evaluateEntry(target,entry).tone,'attention');
 entry.done=false;assert.equal(evaluateEntry(target,entry).tone,'neutral');
 entry.skipped=true;assert.equal(evaluateEntry(target,entry).label,'Não realizada');
 const free:Step={...step(),goals:[]};assert.equal(evaluateEntry(free,{...entry,skipped:false,done:true,values:{}}).tone,'neutral');
});
test('validação de sessão rejeita conclusão sem dados, valores não previstos e caminhos adulterados',()=>{
 const session=startStructured(preset('strength'));
 session.entries[0].done=true;assert.throws(()=>parseTraining<TrainingSession>(session,'session'),/obrigatórios/);
 session.entries[0].values={load:20,reps:10};assert.doesNotThrow(()=>parseTraining(session,'session'));
 session.entries[0].values.power=200;assert.throws(()=>parseTraining(session,'session'),/métricas|obrigatórios/);
 delete session.entries[0].values.power;session.entries[0].key='outra';assert.throws(()=>parseTraining(session,'session'),/Identificação/);
});
test('cópia de ficha antiga e biblioteca nova não modificam o histórico legado',()=>{
 const old=createSession(initialState().week[0],25);old.exercises[0].sets[0]={kg:30,reps:10,rir:1,done:true};
 const before=JSON.stringify(old);const copy=fromLegacy(old);parseTraining(copy,'workout');assert.equal(JSON.stringify(old),before);
 const run=startStructured(copy);assert.deepEqual(run.entries[0].values,{});
 const library:TrainingLibrary={...blankLibrary(),workouts:[copy],active:run};
 assert.deepEqual(parseTraining(JSON.parse(JSON.stringify(library)),'library'),library);
 library.sessions.push({...structuredClone(run),completed:true});assert.throws(()=>parseTraining(library,'library'),/duplicada/);
});
test('identificadores repetidos e metas opcionais ausentes não geram progresso falso',()=>{
 const plan=preset('strength');plan.nodes.push(structuredClone(plan.nodes[0]));assert.throws(()=>parseTraining(plan,'workout'),/único/);
 const target=step();target.goals=[goal('reps','range',8,12),{...goal('rir','range',1,2),required:false}];
 const entry={key:'0',stepId:target.id,values:{reps:10},done:true,skipped:false,note:''};
 assert.equal(evaluateEntry(target,entry).tone,'neutral');
});
test('tentativa com zero repetições pode ser registrada como fora da meta',()=>{
 const plan=preset('strength'),session=startStructured(plan),target=expand(plan)[0].step;
 session.entries[0].values={load:20,reps:0};session.entries[0].done=true;
 assert.equal(entryValid(target,session.entries[0]),true);
 assert.equal(evaluateEntry(target,session.entries[0]).tone,'attention');
 assert.doesNotThrow(()=>parseTraining(session,'session'));
});
