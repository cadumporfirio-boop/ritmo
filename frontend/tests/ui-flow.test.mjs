import {test} from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {randomUUID} from 'node:crypto';
import {JSDOM,VirtualConsole} from 'jsdom';
import {initialState,createSession} from '../src/domain.ts';

const directory=new URL('../dist/treino-flow/browser/',import.meta.url);
const main=fs.readdirSync(directory).find(file=>/^main-.*\.js$/.test(file));
if(!main)throw Error('Compile o Angular antes dos testes de interface.');
const artifact=process.env.RITMO_UI_ARTIFACT;
const application=artifact?fs.readFileSync(artifact,'utf8').match(/<script type="module">([\s\S]*?)<\/script>/)[1]:fs.readFileSync(new URL(main,directory),'utf8');
const legacyKey=artifact?'ritmo.portfolio.beta.v2':'ritmo.v1';
const delay=()=>new Promise(resolve=>setTimeout(resolve,25));
async function waitFor(check){for(let i=0;i<120;i++){if(check())return;await delay();}throw Error('A interface não atingiu o estado esperado.');}
async function open(seed={}){
 const errors=[];const console=new VirtualConsole();console.on('jsdomError',error=>errors.push(String(error)));console.on('error',error=>errors.push(String(error)));
 const dom=new JSDOM('<!doctype html><html lang="pt-BR"><body><app-root></app-root></body></html>',{url:'https://ritmo-ui-test.invalid/',runScripts:'dangerously',pretendToBeVisual:true,virtualConsole:console,beforeParse(window){window.structuredClone=structuredClone;window.TextEncoder=TextEncoder;window.crypto.randomUUID=randomUUID;for(const [key,value] of Object.entries(seed))window.localStorage.setItem(key,value);}});
 const script=dom.window.document.createElement('script');script.textContent=application;dom.window.document.body.append(script);
 await waitFor(()=>dom.window.document.querySelector('nav button'));
 return {dom,document:dom.window.document,errors};
}
function button(document,label){const found=[...document.querySelectorAll('button')].find(item=>item.textContent.trim()===label);assert.ok(found,`Botão não encontrado: ${label}`);return found;}
async function click(document,label){button(document,label).click();await delay();}
function library(dom){return JSON.parse(dom.window.localStorage.getItem('ritmo.training.v2'));}

test('painel salva ficha, executa etapa, versiona edição e preserva snapshot da sessão',async()=>{
 const {dom,document,errors}=await open();
 try{
  await click(document,'▤ Treinos');
  await click(document,'Criar treino +');await click(document,'Top set + back-offs ↗');
  assert.ok(document.querySelector('training-node-editor training-node-editor'));
  await click(document,'Salvar treino ✓');
  assert.equal(library(dom).workouts[0].title,'Exemplo · top set e back-offs');
  await click(document,'Iniciar treino →');
  assert.equal(document.querySelectorAll('.structured-entry').length,3);
  const first=document.querySelector('.structured-entry');
  first.querySelector('button.primary').click();await delay();
  assert.match(document.querySelector('.training-message').textContent,/obrigatórios/);
  for(const [label,value] of [['Etapa 1 Carga','20'],['Etapa 1 Repetições','7']]){
   const input=document.querySelector(`input[aria-label="${label}"]`);input.value=value;input.dispatchEvent(new dom.window.Event('input',{bubbles:true}));
  }
  first.querySelector('button.primary').click();await delay();
  assert.equal(first.getAttribute('data-tone'),'positive');
  await click(document,'Voltar ↗');
  await click(document,'Editar');
  const title=document.querySelector('.builder-settings input');title.value='Plano revisado';title.dispatchEvent(new dom.window.Event('input',{bubbles:true}));
  await click(document,'Salvar treino ✓');
  const saved=library(dom);
  assert.equal(saved.workouts.length,2);assert.equal(saved.workouts[1].revision,2);
  assert.equal(saved.active.plan.title,'Exemplo · top set e back-offs');assert.equal(saved.active.plan.revision,1);
  await click(document,'Continuar sessão →');
  await click(document,'Encerrar e salvar sessão ✓');
  assert.equal(library(dom).sessions[0].entries[0].done,true);
  assert.equal(library(dom).sessions[0].entries[1].done,false);
  assert.equal(library(dom).active,null);
  assert.deepEqual(errors,[]);
 }finally{dom.window.close();}
});

test('JSON inválido não substitui biblioteca e uma cópia só é restaurada após confirmação',async()=>{
 const {dom,document,errors}=await open();
 try{
  await click(document,'▤ Treinos');await click(document,'Criar treino +');await click(document,'Séries tradicionais ↗');await click(document,'Salvar treino ✓');
  const original=dom.window.localStorage.getItem('ritmo.training.v2');
  const input=document.querySelector('.import-panel textarea');input.value='{invalid';input.dispatchEvent(new dom.window.Event('input',{bubbles:true}));
  await click(document,'Revisar JSON');assert.equal(dom.window.localStorage.getItem('ritmo.training.v2'),original);
  const backup=JSON.parse(original);backup.workouts[0].title='Cópia restaurada';
  input.value=JSON.stringify(backup);input.dispatchEvent(new dom.window.Event('input',{bubbles:true}));
  await click(document,'Revisar JSON');assert.equal(library(dom).workouts[0].title,'Exemplo · séries tradicionais');
  await click(document,'Restaurar esta cópia');assert.equal(library(dom).workouts[0].title,'Cópia restaurada');
  assert.equal(dom.window.localStorage.getItem('ritmo.training.v2.previous'),original);
  assert.deepEqual(errors,[]);
 }finally{dom.window.close();}
});

test('nova ficha pode ser associada à semana sem alterar resultados antigos',async()=>{
 const legacy=initialState();const historical=createSession(legacy.week[0],25);historical.completed=true;historical.exercises[0].sets[0]={kg:30,reps:10,rir:2,done:true};legacy.sessions.push(historical);
 const {dom,document,errors}=await open({[legacyKey]:JSON.stringify(legacy)});
 try{
  await click(document,'▤ Treinos');await click(document,'Criar treino +');await click(document,'Séries tradicionais ↗');await click(document,'Salvar treino ✓');
  const assign=[...document.querySelectorAll('button')].find(item=>item.textContent.startsWith('Associar a '));assert.ok(assign);assign.click();await delay();
  const saved=JSON.parse(dom.window.localStorage.getItem(legacyKey));
  assert.deepEqual(saved.sessions,legacy.sessions);assert.equal(saved.week.filter(day=>day.workoutId).length,1);
  await click(document,'◉ Hoje ↗');await click(document,'Abrir meu treino →');
  assert.equal(document.querySelectorAll('.structured-entry').length,3);
  assert.equal(JSON.parse(dom.window.localStorage.getItem(legacyKey)).active,null);
  assert.deepEqual(errors,[]);
 }finally{dom.window.close();}
});

async function selectSport(dom,document,label,value){const select=document.querySelector(`select[aria-label="${label}"]`);assert.ok(select);select.value=value;select.dispatchEvent(new dom.window.Event('change',{bubbles:true}));await delay();}
test('modalidade filtra modelos e etapas, inclusive blocos internos, e Outra libera opções',async()=>{
 const {dom,document,errors}=await open();try{
 await click(document,'▤ Treinos');await click(document,'Criar treino +');await selectSport(dom,document,'Modalidade para montar','martial');
 assert.ok(!document.querySelector('app-root').textContent.includes('Top set + back-offs ↗'));button(document,'Rounds técnicos ↗');
 await click(document,'Começar do zero →');
 const roles=()=>[...document.querySelectorAll('select[aria-label="Tipo de etapa"]')];
 assert.equal(roles().length,1);assert.ok(!roles()[0].querySelector('option[value="top"]'));
 assert.equal(document.querySelector('select[aria-label="Métrica da etapa"]').value,'duration');
 await click(document,'+ Bloco interno');assert.equal(roles().length,2);assert.ok(roles().every(s=>!s.querySelector('option[value="top"]')));
 await selectSport(dom,document,'Modalidade do treino','other');assert.ok(roles().every(s=>s.querySelector('option[value="top"]')));
 await click(document,'Cancelar edição');await click(document,'Criar treino +');await selectSport(dom,document,'Modalidade para montar','strength');await click(document,'Top set + back-offs ↗');await click(document,'Salvar treino ✓');
 const before=structuredClone(library(dom).workouts[0].nodes);
 await click(document,'Editar');await selectSport(dom,document,'Modalidade do treino','martial');
 assert.ok(document.querySelector('app-root').textContent.includes('já configurado'));await click(document,'Salvar treino ✓');
 assert.deepEqual(library(dom).workouts[1].nodes,before);assert.equal(library(dom).workouts[1].sport,'martial');assert.deepEqual(errors,[]);
 }finally{dom.window.close();}
});

test('Treinos fica limpa, séries são agrupadas e o editor pode separá-las',async()=>{
 const {dom,document,errors}=await open();try{
 await click(document,'▤ Treinos');assert.equal(document.querySelector('h1').textContent,'Treinos');assert.ok(!document.querySelector('app-root').textContent.includes('Escolha uma estrutura'));assert.ok(!document.querySelector('app-root').textContent.includes('Aproveitar uma ficha antiga'));
 await click(document,'Criar treino +');await click(document,'Séries tradicionais ↗');await click(document,'Salvar treino ✓');await click(document,'Iniciar treino →');
 assert.equal(document.querySelectorAll('.execution-block').length,1);assert.equal(document.querySelectorAll('.series-entry').length,3);
 await click(document,'Encerrar e salvar sessão ✓');assert.ok(!document.querySelector('app-root').textContent.includes('Seu histórico nesta biblioteca'));
 await click(document,'Editar');await click(document,'Separar séries em etapas');await click(document,'Salvar treino ✓');await click(document,'Iniciar treino →');assert.equal(document.querySelectorAll('.execution-block').length,3);
 await click(document,'Encerrar e salvar sessão ✓');await click(document,'↗ Histórico');assert.ok(document.querySelector('app-root').textContent.includes('Seu histórico nesta biblioteca'));await click(document,'Consultar');assert.ok(document.querySelector('training-runner'));assert.deepEqual(errors,[]);
 }finally{dom.window.close();}
});
test('análise antiga só é criada quando solicitada e fichas antigas ficam no Histórico',async()=>{
 const legacy=initialState();const session=createSession(legacy.week[0],25);session.completed=true;legacy.sessions.push(session);
 const {dom,document,errors}=await open({[legacyKey]:JSON.stringify(legacy)});try{
 await click(document,'▤ Treinos');assert.ok(!document.querySelector('app-root').textContent.includes('Aproveitar uma ficha antiga'));
 await click(document,'↗ Histórico');assert.ok(document.querySelector('app-root').textContent.includes('Aproveitar uma ficha antiga'));assert.equal(document.querySelectorAll('app-session-analysis').length,0);
 await click(document,'Ver análise · '+session.name);assert.equal(document.querySelectorAll('app-session-analysis').length,1);
 await click(document,'Fechar análise · '+session.name);assert.equal(document.querySelectorAll('app-session-analysis').length,0);assert.deepEqual(errors,[]);
 }finally{dom.window.close();}
});

test('séries por tipo, conclusão do exercício, cores e extras preservam a ficha',async()=>{
 const {dom,document,errors}=await open();try{
 await click(document,'▤ Treinos');await click(document,'Criar treino +');await click(document,'Séries tradicionais ↗');
 assert.equal(document.querySelectorAll('select[aria-label="Tipo da série"]').length,3);
 const type=document.querySelector('select[aria-label="Tipo da série"]');type.value='warmup';type.dispatchEvent(new dom.window.Event('change',{bubbles:true}));await delay();
 await click(document,'+ Série');assert.equal(document.querySelectorAll('select[aria-label="Tipo da série"]').length,4);await click(document,'Remover série');
 await click(document,'Salvar treino ✓');await click(document,'Iniciar treino →');assert.equal(document.querySelectorAll('.series-grid-row').length,3);
 const fill=(label,value)=>{const input=document.querySelector(`input[aria-label="${label}"]`);input.value=value;input.dispatchEvent(new dom.window.Event('input',{bubbles:true}));};
 await click(document,'Concluir exercício ✓');assert.equal(library(dom).active.entries.some(e=>e.done),false);
 for(let i=1;i<=3;i++){fill('Etapa '+i+' Carga','20');fill('Etapa '+i+' Repetições',i===2?'6':'10');}await delay();
 await click(document,'Concluir exercício ✓');assert.equal(document.querySelectorAll('.series-entry[data-tone="positive"]').length,2);assert.equal(document.querySelectorAll('.series-entry[data-tone="attention"]').length,1);
 const snapshot=JSON.stringify(library(dom).active.plan);await click(document,'Adicionar série extra +');assert.equal(document.querySelectorAll('.series-grid-row').length,4);assert.equal(JSON.stringify(library(dom).active.plan),snapshot);
 await click(document,'Remover série extra');assert.equal(document.querySelectorAll('.series-grid-row').length,3);assert.equal(JSON.stringify(library(dom).active.plan),snapshot);assert.deepEqual(errors,[]);
 }finally{dom.window.close();}
});

test('blocos, etapas e séries recolhem com resumo atualizado e preservam edição',async()=>{
 const {dom,document,errors}=await open();try{
 await click(document,'▤ Treinos');await click(document,'Criar treino +');await click(document,'Séries tradicionais ↗');
 const block=document.querySelector('training-node-editor > details.builder-group');const step=block.querySelector('training-node-editor > details.builder-node');const series=step.querySelector('details.series-fold');
 assert.equal(block.open,false);assert.equal(step.open,false);block.querySelector(':scope > summary').click();await delay();step.querySelector(':scope > summary').click();await delay();assert.equal(series.open,false);assert.match(series.querySelector('summary').textContent,/Série 1.*Trabalho.*REPS 8–12/);
 series.querySelector('summary').click();await delay();assert.ok(series.open);
 const role=series.querySelector('select[aria-label="Tipo da série"]');role.value='top';role.dispatchEvent(new dom.window.Event('change',{bubbles:true}));await delay();
 const rir=series.querySelectorAll('.builder-goal')[2];const rule=rir.querySelectorAll('select')[1];rule.value='range';rule.dispatchEvent(new dom.window.Event('change',{bubbles:true}));await delay();
 for(const [index,value] of ['1','2'].entries()){const input=series.querySelectorAll('.builder-goal')[2].querySelectorAll('input[type="number"]')[index];input.value=value;input.dispatchEvent(new dom.window.Event('input',{bubbles:true}));await delay();}
 series.querySelector('summary').click();await delay();assert.equal(series.open,false);assert.match(series.querySelector('summary').textContent,/Top set.*RIR 1–2/);
 const name=step.querySelector('input[aria-label^="Nome"]');name.value='Supino revisado';name.dispatchEvent(new dom.window.Event('input',{bubbles:true}));await delay();
 step.querySelector(':scope > summary').click();await delay();assert.equal(step.open,false);assert.match(step.querySelector(':scope > summary').textContent,/Supino revisado.*3 séries/);
 block.querySelector(':scope > summary').click();await delay();assert.equal(block.open,false);assert.match(block.querySelector(':scope > summary').textContent,/1 volta.*3 registros/);
 block.querySelector(':scope > summary').click();await delay();assert.equal(step.open,false);step.querySelector(':scope > summary').click();await delay();assert.equal(series.open,false);
 await click(document,'+ Série');const all=step.querySelectorAll('details.series-fold');assert.equal(all.length,4);assert.ok(all[3].open);assert.equal(all[0].open,false);
 await click(document,'Salvar treino ✓');const node=library(dom).workouts[0].nodes[0].children[0];assert.equal(node.name,'Supino revisado');assert.equal(node.series[0].role,'top');assert.equal(node.series[0].goals.find(g=>g.metric==='rir').max,2);assert.equal(node.series.length,4);assert.deepEqual(errors,[]);
 }finally{dom.window.close();}
});

test('observações unificadas preservam campos antigos e recolher não interfere na edição',async()=>{
 const {dom,document,errors}=await open();try{
 await click(document,'▤ Treinos');await click(document,'Criar treino +');await click(document,'Séries tradicionais ↗');await click(document,'Salvar treino ✓');
 const data=library(dom);const node=data.workouts[0].nodes[0].children[0];node.equipment='Halter de cada lado';node.notes='Descer com controle';
 // Import through the same supported review flow, without changing stored user data.
 const input=document.querySelector('.import-panel textarea');input.value=JSON.stringify(data.workouts[0]);input.dispatchEvent(new dom.window.Event('input',{bubbles:true}));await click(document,'Revisar JSON');
 const step=document.querySelector('training-node-editor training-node-editor > details.builder-node');step.closest('details.builder-group').querySelector(':scope > summary').click();await delay();step.querySelector(':scope > summary').click();await delay();const notes=step.querySelector('textarea[aria-label="Observações da etapa"]');assert.equal(notes.value,'Halter de cada lado\nDescer com controle');
 assert.ok(!step.textContent.includes('Equipamento / referência de medição'));notes.click();await delay();assert.ok(step.open);
 notes.value+=' e pausar';notes.dispatchEvent(new dom.window.Event('input',{bubbles:true}));await delay();
 step.querySelector('.fold-close').click();await delay();assert.equal(step.open,false);assert.match(step.querySelector('summary').textContent,/Halter de cada lado.*Descer com controle e pausar/s);
 step.querySelector('summary').click();await delay();assert.ok(step.open);assert.equal(step.querySelector('textarea').value,'Halter de cada lado\nDescer com controle e pausar');
 const series=step.querySelector('details.series-fold');series.querySelector('summary').click();await delay();assert.ok(series.open);series.querySelector('.fold-close').click();await delay();assert.equal(series.open,false);assert.ok(step.open);
 await click(document,'Salvar treino ✓');const saved=library(dom).workouts.at(-1).nodes[0].children[0];assert.equal(saved.equipment,'');assert.equal(saved.notes,'Halter de cada lado\nDescer com controle e pausar');assert.deepEqual(errors,[]);
 }finally{dom.window.close();}
});

test('metas de cada série ficam visíveis junto dos campos e reabrir edição recolhe todos os cards',async()=>{
 const {dom,document,errors}=await open();try{
 await click(document,'▤ Treinos');await click(document,'Criar treino +');await click(document,'Top set + back-offs ↗');
 assert.ok([...document.querySelectorAll('.builder-fold,.series-fold')].every(card=>!card.open));
 const block=document.querySelector('.builder-group');block.querySelector(':scope > summary').click();await delay();
 await click(document,'Salvar treino ✓');await click(document,'Editar');assert.ok([...document.querySelectorAll('.builder-fold,.series-fold')].every(card=>!card.open));
 await click(document,'Cancelar edição');await click(document,'Iniciar treino →');
 const rows=document.querySelectorAll('.series-entry');assert.equal(rows.length,3);
 assert.match(rows[0].querySelector('.series-grid-row .series-targets').textContent,/Top set.*Reps: 6–8 reps/);
 assert.match(rows[1].querySelector('.series-grid-row .series-targets').textContent,/Back-off.*Reps: 10–12 reps/);
 for(const row of rows){const targets=row.querySelector('.series-targets');assert.equal(targets.closest('details'),null);assert.equal(row.querySelector('details').open,false);const input=row.querySelector('input');assert.equal(input.getAttribute('aria-describedby'),targets.id);}
 assert.deepEqual(errors,[]);
 }finally{dom.window.close();}
});
