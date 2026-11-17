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
  await click(document,'▤ Meus treinos');
  await click(document,'Top set + back-offs ↗');
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
  await click(document,'▤ Meus treinos');await click(document,'Séries tradicionais ↗');await click(document,'Salvar treino ✓');
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
  await click(document,'▤ Meus treinos');await click(document,'Séries tradicionais ↗');await click(document,'Salvar treino ✓');
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
 await click(document,'▤ Meus treinos');await selectSport(dom,document,'Modalidade para montar','martial');
 assert.ok(!document.body.textContent.includes('Top set + back-offs ↗'));button(document,'Rounds técnicos ↗');
 await click(document,'Criar treino +');
 const roles=()=>[...document.querySelectorAll('select[aria-label="Tipo de etapa"]')];
 assert.equal(roles().length,1);assert.ok(!roles()[0].querySelector('option[value="top"]'));
 assert.equal(document.querySelector('select[aria-label="Métrica da etapa"]').value,'duration');
 await click(document,'+ Bloco interno');assert.equal(roles().length,2);assert.ok(roles().every(s=>!s.querySelector('option[value="top"]')));
 await selectSport(dom,document,'Modalidade do treino','other');assert.ok(roles().every(s=>s.querySelector('option[value="top"]')));
 await click(document,'Cancelar edição');await selectSport(dom,document,'Modalidade para montar','strength');await click(document,'Top set + back-offs ↗');await click(document,'Salvar treino ✓');
 const before=structuredClone(library(dom).workouts[0].nodes);
 await click(document,'Editar');await selectSport(dom,document,'Modalidade do treino','martial');
 assert.ok(document.body.textContent.includes('já configurado'));await click(document,'Salvar treino ✓');
 assert.deepEqual(library(dom).workouts[1].nodes,before);assert.equal(library(dom).workouts[1].sport,'martial');assert.deepEqual(errors,[]);
 }finally{dom.window.close();}
});
