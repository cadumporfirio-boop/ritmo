import {test} from 'node:test';
import assert from 'node:assert/strict';
import {createSession,initialState} from '../src/domain.ts';
import {analyzeSession} from '../src/analytics.ts';
function fixture(date:string,reps=10){const s=createSession(initialState().week[0],25);s.date=date;s.completed=true;s.exercises=s.exercises.slice(0,1);s.exercises[0].sets.forEach(set=>Object.assign(set,{kg:20,reps,done:true}));return s;}
test('compara mesma carga com sessão anterior, mesmo com histórico fora de ordem',()=>{
 const older=fixture('2026-11-01',8),previous=fixture('2026-11-05',10),current=fixture('2026-11-10',11),future=fixture('2026-11-15',15);
 const report=analyzeSession(current,[future,current,older,previous]);
 assert.equal(report.exercises[0].previousSessionId,previous.id);
 assert.equal(report.exercises[0].indicators.find(i=>i.label.startsWith('Repetições ·'))?.message,'Você fez 3 repetições a mais.');
});
test('pendências não são tratadas como piora de desempenho',()=>{
 const previous=fixture('2026-11-05'),current=fixture('2026-11-10');current.exercises[0].sets[0].done=false;
 const row=analyzeSession(current,[previous]).exercises[0];
 assert.equal(row.indicators.find(i=>i.label==='Evolução')?.tone,'neutral');
 assert.equal(row.indicators.find(i=>i.label==='Evolução')?.value,'Dados incompletos');
});
test('mais séries é descrição neutra, não conclusão de melhora',()=>{
 const previous=fixture('2026-11-05'),current=fixture('2026-11-10');current.exercises[0].sets.push({...current.exercises[0].sets[0]});
 const metric=analyzeSession(current,[previous]).exercises[0].indicators.find(i=>i.label==='Séries realizadas');
 assert.equal(metric?.message,'Você fez 1 série a mais.');assert.equal(metric?.tone,'stable');
});
test('carga diferente não gera conclusão enganosa sobre repetições',()=>{
 const previous=fixture('2026-11-05'),current=fixture('2026-11-10',8);current.exercises[0].sets[0].kg=25;
 assert.equal(analyzeSession(current,[previous]).exercises[0].indicators.at(-1)?.value,'Contexto diferente');
});
test('registros legados não ganham metas inventadas e não comparam tipos distintos',()=>{
 const previous=fixture('2026-11-05'),current=fixture('2026-11-10');delete previous.exercises[0].metrics;
 assert.equal(analyzeSession(current,[previous]).exercises[0].previousSessionId,null);
 previous.exercises[0].metrics={...current.exercises[0].metrics!,setType:'Top set'};
 assert.equal(analyzeSession(current,[previous]).exercises[0].previousSessionId,null);
});
test('meta usa apenas séries confirmadas e barra fica entre 0 e 100',()=>{
 const current=fixture('2026-11-10');current.exercises[0].sets[0].reps=7;current.exercises[0].sets[1].done=false;
 const metric=analyzeSession(current,[]).exercises[0].indicators[0];
 assert.equal(metric.value,'1/2');assert.equal(metric.percent,50);assert.equal(metric.tone,'attention');
});
