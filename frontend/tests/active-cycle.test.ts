import {test} from 'node:test';
import assert from 'node:assert/strict';
import {dateOrdinal,localDateKey,addCalendarDays,calendarWeek,cyclePosition,slotsOnDate,cycleSession,validateActiveCycle} from '../src/active-cycle.ts';
import type {ActiveCycle} from '../src/active-cycle.ts';
import {newProgram,slotFromWorkout} from '../src/planning.ts';
import {preset,startStructured,parseTraining} from '../src/training.ts';
const fixture=()=>{const program=newProgram();program.context.objective='Objetivo';program.startDate='2026-11-23';program.durationDays=14;program.slots=[slotFromWorkout(preset('strength'),1),slotFromWorkout(preset('topback'),8)];return {kind:'activeCycle',schemaVersion:1,id:'activation-one',programId:program.id,programRevision:program.revision,startDate:program.startDate,program} as ActiveCycle;};
test('datas escolhem semana e sessão sem repetir o ciclo ou concluir registros',()=>{
 const cycle=fixture(),before=JSON.stringify(cycle);assert.equal(cyclePosition(cycle,'2026-11-22').status,'upcoming');assert.equal(cyclePosition(cycle,'2026-11-23').week,1);assert.equal(cyclePosition(cycle,'2026-11-29').week,1);assert.equal(cyclePosition(cycle,'2026-11-30').week,2);assert.equal(cyclePosition(cycle,'2026-12-06').status,'active');assert.equal(cyclePosition(cycle,'2026-12-07').status,'completed');assert.equal(slotsOnDate(cycle,'2026-11-23')[0].id,cycle.program.slots[0].id);assert.equal(slotsOnDate(cycle,'2026-11-30')[0].id,cycle.program.slots[1].id);assert.equal(slotsOnDate(cycle,'2026-12-07').length,0);assert.equal(JSON.stringify(cycle),before);
});
test('cálculo usa datas de calendário e respeita semanas civis, ano bissexto e mudanças de horário',()=>{
 assert.equal(addCalendarDays('2028-02-28',1),'2028-02-29');assert.equal(addCalendarDays('2028-02-29',1),'2028-03-01');assert.deepEqual(calendarWeek('2026-11-24'),['2026-11-23','2026-11-24','2026-11-25','2026-11-26','2026-11-27','2026-11-28','2026-11-29']);assert.equal(addCalendarDays('2026-03-08',1),'2026-03-09');assert.equal(dateOrdinal('2026-11-30')-dateOrdinal('2026-11-23'),7);assert.equal(localDateKey(new Date('2026-11-23T23:59:59')),'2026-11-23');assert.throws(()=>dateOrdinal('2026-02-30'),/válida/);
});
test('registros de outra ativação não são contados e sessão em andamento tem prioridade',()=>{
 const cycle=fixture(),slot=cycle.program.slots[0];const old=startStructured(slot.workout);old.completed=true;old.planning={programId:cycle.programId,programRevision:1,slotId:slot.id,day:1,programTitle:cycle.program.title,stimulus:'Base',activationId:'previous-activation'};assert.equal(cycleSession(cycle,slot.id,[old],null),undefined);const current=structuredClone(old);current.id='current-record';current.planning!.activationId=cycle.id;parseTraining(current,'session');assert.equal(cycleSession(cycle,slot.id,[old,current],null)?.id,'current-record');const active={...structuredClone(current),id:'ongoing',completed:false};assert.equal(cycleSession(cycle,slot.id,[current],active)?.id,'ongoing');
});
test('ativação exige cópia consistente da data e versão do planejamento',()=>{
 const cycle=fixture();validateActiveCycle(cycle);assert.throws(()=>validateActiveCycle({...cycle,programRevision:2}),/versão/);assert.throws(()=>validateActiveCycle({...cycle,startDate:'2026-11-24'}),/versão/);assert.throws(()=>validateActiveCycle({...cycle,extra:true}),/inválido/);
});
