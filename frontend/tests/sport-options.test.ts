import {test} from 'node:test';
import assert from 'node:assert/strict';
import {ROLES,METRICS,expand,parseTraining} from '../src/training.ts';
import {profileFor,roleOptions,metricOptions,createWorkoutForSport,presetForSport} from '../src/sport-options.ts';
test('artes marciais filtra musculação e modo livre oferece todas as opções',()=>{
 assert.ok(!roleOptions('martial').some(r=>['top','backoff','drop'].includes(r.id)));
 assert.ok(!metricOptions('martial').some(m=>['load','rir','power'].includes(m.id)));
 for(const sport of ['other','mixed']){assert.equal(roleOptions(sport).length,ROLES.length);assert.equal(metricOptions(sport).length,Object.keys(METRICS).length);assert.equal(profileFor(sport).models.length,5);}
});
test('opções existentes são mantidas sem liberar demais escolhas incompatíveis',()=>{
 assert.ok(roleOptions('martial','top').find(r=>r.id==='top')?.retained);
 assert.ok(!roleOptions('martial','top').some(r=>r.id==='backoff'));
 assert.ok(metricOptions('martial','load').find(m=>m.id==='load')?.retained);
 assert.ok(!metricOptions('martial','load').some(m=>m.id==='rir'));
});
test('novas fichas e modelos seguem a modalidade e passam no contrato',()=>{
 for(const sport of ['strength','running','cycling','swimming','martial','other','mixed']){
 const plan=createWorkoutForSport(sport);parseTraining(plan,'workout');
 if(sport==='martial')assert.equal(expand(plan)[0].step.goals[0].metric,'duration');
 if(sport==='other')assert.equal(expand(plan)[0].step.goals.length,0);
 for(const model of profileFor(sport).models)parseTraining(presetForSport(model,sport),'workout');
 }
 assert.ok(expand(presetForSport('interval','cycling')).some(e=>e.step.name==='Trecho de bicicleta'));
});
