import {test} from 'node:test';
import assert from 'node:assert/strict';
import {makeAiRequest,requestPrompt,parseAiReply,replySummary} from '../src/ai-exchange.ts';
import fixture from './fixtures/ai-plan.json' with {type:'json'};
import {preset,startStructured} from '../src/training.ts';
import {steps,validateProgram} from '../src/planning.ts';
test('pedido portável inclui contrato e só exporta histórico confirmado quando selecionado',()=>{
 const session=startStructured(preset('topback'));session.completed=true;session.entries[0].values={load:20,reps:8,rir:1};session.entries[0].done=true;session.entries[1].values={load:18,reps:10};session.entries[1].note='Observação privada';
 const request=makeAiRequest({instructions:'Monte seis semanas',history:[session]});assert.equal(request.history.length,0);const included=makeAiRequest({instructions:'Ajuste meu plano',history:[session],includeHistory:true});assert.equal(included.history[0].records.length,1);assert.equal(included.history[0].records[0].values.load,20);assert.ok(!requestPrompt(included).includes('Observação privada'));assert.ok(requestPrompt(included).includes(included.requestId));assert.ok(requestPrompt(included).includes('ritmo.ai.plan'));
});
test('resposta compacta gera seis semanas completas sem inventar registros nem exigir UUID da IA',()=>{
 const {program,response}=parseAiReply(JSON.stringify(fixture),'sample-request',{experience:'Intermediário'});validateProgram(program);assert.equal(program.context.experience,'Intermediário');assert.equal(program.slots.length,6);assert.deepEqual(program.slots.map(slot=>slot.day),[3,10,17,24,31,38]);assert.deepEqual(program.slots.map(slot=>slot.stimulus),['Força','Hipertrofia','Volume','Força','Volume','Hipertrofia']);assert.equal(steps(program.slots[0].workout.nodes)[0].series!.length,4);assert.deepEqual(replySummary(program),{weeks:6,routines:1,sessions:6,exercises:1});assert.equal(response.requestId,'sample-request');assert.ok(startStructured(program.slots[0].workout).entries.every(entry=>!entry.done&&Object.keys(entry.values).length===0));
});
test('JSON cercado por bloco de código é aceito; resposta incompleta ou de outro pedido é rejeitada',()=>{
 assert.doesNotThrow(()=>parseAiReply('```json\n'+JSON.stringify(fixture)+'\n```','sample-request'));assert.throws(()=>parseAiReply(JSON.stringify(fixture),'outro'),/outro pedido/);assert.throws(()=>parseAiReply('{invalid'),/JSON/);assert.throws(()=>parseAiReply(JSON.stringify({...fixture,resultados:[]})),/contrato/);
 const incomplete=structuredClone(fixture);incomplete.plan.routines[0].sequence.pop();assert.throws(()=>parseAiReply(JSON.stringify(incomplete)),/todas as semanas/);incomplete.plan.routines[0].sequence.push('missing');assert.throws(()=>parseAiReply(JSON.stringify(incomplete)),/abordagens existentes/);
});
test('metas inválidas, variantes ausentes e resultados fabricados não entram no planejamento',()=>{
 const invalid=structuredClone(fixture);invalid.plan.routines[0].exercises[0].variants[0].series[0].goals[2].max=11;assert.throws(()=>parseAiReply(JSON.stringify(invalid)),/limites/);const missing=structuredClone(fixture);missing.plan.routines[0].exercises[0].variants.pop();assert.throws(()=>parseAiReply(JSON.stringify(missing)),/variante/);const unknown=structuredClone(fixture);(unknown.plan.routines[0].exercises[0].variants[0].series[0] as unknown as {values:unknown}).values={load:290};assert.throws(()=>parseAiReply(JSON.stringify(unknown)),/contrato/);
});
test('modalidade da resposta é preservada e não vira musculação',()=>{
 const reply=structuredClone(fixture);reply.plan.routines[0].sport='martial';const program=parseAiReply(JSON.stringify(reply)).program;assert.equal(program.slots[0].workout.sport,'martial');
});

test('resposta avançada mantém circuitos e ciclos de nove dias sem converter para semanas guiadas',async()=>{
 const fixture=(await import('./fixtures/ai-advanced-plan.json',{with:{type:'json'}})).default;const before=JSON.stringify(fixture);const parsed=parseAiReply(JSON.stringify(fixture),'advanced-request').program;assert.equal(parsed.durationDays,9);assert.equal(parsed.guided,undefined);assert.equal(parsed.slots.length,2);assert.equal(parsed.slots[0].workout.sport,'running');assert.equal(parsed.slots[1].workout.sport,'martial');assert.equal(parsed.periods[0].kind,'micro');assert.notEqual(parsed.id,fixture.plan.id);assert.equal(JSON.stringify(fixture),before);validateProgram(parsed);
 const bad=structuredClone(fixture);bad.plan.periods[0].parentId=bad.plan.periods[0].id;assert.throws(()=>parseAiReply(JSON.stringify(bad)),/Hierarquia/);const request=makeAiRequest({instructions:'Monte um ciclo de nove dias',responseFormat:'advanced'});assert.ok(requestPrompt(request).includes('FORMATO AVANÇADO'));
});
