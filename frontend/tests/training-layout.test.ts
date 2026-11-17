import {test} from 'node:test';
import assert from 'node:assert/strict';
import {preset,expand} from '../src/training.ts';
import {executionGroups} from '../src/training-layout.ts';
test('agrupa somente repetições consecutivas sem alterar a sequência ou o plano',()=>{
 const plan=preset('strength'),before=JSON.stringify(plan),groups=executionGroups(plan);
 assert.equal(groups.length,1);assert.equal(groups[0].items.length,3);assert.equal(JSON.stringify(plan),before);
 for(const model of ['circuit','interval','rounds','topback']){const p=preset(model),blocks=executionGroups(p);assert.deepEqual(blocks.flatMap(b=>b.items.map(r=>r.item.key)),expand(p).map(r=>r.key));}
 assert.equal(executionGroups(preset('circuit')).length,9);assert.equal(executionGroups(preset('topback')).length,2);
});
