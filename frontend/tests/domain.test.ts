import { test } from 'node:test';
import assert from 'node:assert/strict';
import { initialState, createSession, validSet, summarize, finishSession, restore, removeExtraSeries, isExtraSeries } from '../src/domain.ts';
test('metas ou valores preenchidos sem confirmação não contam como desempenho',()=>{
 const session=createSession(initialState().week[0],45);
 session.exercises[0].sets[0]={kg:20,reps:10,rir:2,done:false};
 assert.equal(summarize(session).volume,0);
 assert.equal(summarize(session).confirmed,0);
 session.exercises[0].sets[0].done=true;
 assert.equal(summarize(session).volume,200);
});
test('finalizar preserva campos pendentes e não altera o original',()=>{
 const session=createSession(initialState().week[0],25);
 const saved=finishSession(session);
 assert.equal(saved.completed,true);assert.equal(session.completed,false);
 assert.equal(summarize(saved).confirmed,0);assert.equal(summarize(saved).pending,9);
});
test('carga zero é válida; números negativos e repetições fracionárias não são',()=>{
 assert.equal(validSet({kg:0,reps:10,rir:null,done:false}),true);
 for(const set of [{kg:-1,reps:10,rir:2,done:true},{kg:20,reps:1.5,rir:2,done:true},{kg:20,reps:10,rir:11,done:true}])assert.equal(validSet(set),false);
});
test('dados incompatíveis não são silenciosamente substituídos',()=>{
 assert.throws(()=>restore('{'));assert.throws(()=>restore('{"version":2}'));
 assert.deepEqual(restore(JSON.stringify(initialState())),initialState());
});
test('remove série extra confirmada e recalcula o desempenho sem alterar as originais',()=>{
 const session=createSession(initialState().week[0],25);
 const exercise=session.exercises[0];
 exercise.sets.push({kg:20,reps:10,rir:2,done:true});
 assert.equal(summarize(session).volume,200);
 const removed=removeExtraSeries(exercise,3);
 assert.deepEqual(removed,{kg:20,reps:10,rir:2,done:true});
 assert.equal(exercise.sets.length,3);assert.equal(summarize(session).volume,0);
 exercise.sets.splice(3,0,removed!);
 assert.equal(summarize(session).volume,200);
});
test('séries originais e índices inválidos não podem ser removidos',()=>{
 const exercise=createSession(initialState().week[0],25).exercises[0];
 for(const index of [-1,0,1,2,3,1.5,NaN])assert.equal(removeExtraSeries(exercise,index),null);
 assert.equal(exercise.sets.length,3);
 exercise.sets.push({kg:null,reps:null,rir:null,done:false});
 assert.equal(isExtraSeries(exercise,3),true);assert.equal(isExtraSeries(exercise,0),false);
 assert.notEqual(removeExtraSeries(exercise,3),null);
});
