import {test} from 'node:test';
import assert from 'node:assert/strict';
import {step,group,goal,workout,uid,expand,startStructured,parseTraining,addSessionSeries,cloneNodes} from '../src/training.ts';
import {executionGroups} from '../src/training-layout.ts';
const exercise=()=>({...step('Supino'),series:[{id:uid(),role:'warmup',goals:[goal('reps','range',12,15)]},{id:uid(),role:'top',goals:[goal('load'),goal('reps','range',6,8)]},...Array.from({length:2},()=>({id:uid(),role:'backoff',goals:[goal('reps','range',10,12)]}))]});
test('séries têm metas próprias e voltas repetem todas as séries de todas as etapas',()=>{
 const plan=workout();plan.nodes=[group('Parte A',2,[exercise(),{...step('Remada'),series:[{id:uid(),role:'work',goals:[]},{id:uid(),role:'work',goals:[]}]}])];
 parseTraining(plan,'workout');const expanded=expand(plan);assert.equal(expanded.length,12);assert.deepEqual(expanded.slice(0,4).map(row=>row.step.role),['warmup','top','backoff','backoff']);assert.equal(executionGroups(plan).length,4);
 const run=startStructured(plan);run.entries[0].values={reps:13};run.entries[0].done=true;parseTraining(run,'session');run.entries[1].values={reps:7};run.entries[1].done=true;assert.throws(()=>parseTraining(run,'session'),/obrigatórios/);
});
test('séries extras têm registro próprio sem alterar ficha ou snapshot planejado',()=>{
 const plan=workout();plan.nodes=[group('Parte',1,[exercise()])];const run=startStructured(plan),before=JSON.stringify(run.plan);addSessionSeries(run,run.entries[3].key);
 assert.equal(run.entries.length,5);assert.equal(JSON.stringify(run.plan),before);parseTraining(run,'session');assert.equal(executionGroups(run.plan,run)[0].items.length,5);
 const extra=run.entries.at(-1)!;extra.extra!.afterKey='inexistente';assert.throws(()=>parseTraining(run,'session'),/extra incompatível/);
});
test('valida limites de séries, metas duplicadas, ids e chaves adulteradas',()=>{
 const plan=workout();const node=exercise();plan.nodes=[node];node.series[1].id=node.series[0].id;assert.throws(()=>parseTraining(plan,'workout'),/duplicado/);node.series[1].id=uid();
 node.series[0].goals.push(goal('reps'));assert.throws(()=>parseTraining(plan,'workout'),/repita/);node.series[0].goals.pop();
 const clone=cloneNodes([node])[0];assert.notEqual(clone.id,node.id);if(clone.kind==='step')assert.notEqual(clone.series![0].id,node.series[0].id);
 const run=startStructured(plan);run.entries.pop();assert.throws(()=>parseTraining(run,'session'),/corresponde/);
});
