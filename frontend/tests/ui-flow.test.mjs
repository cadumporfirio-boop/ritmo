import {test} from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {randomUUID} from 'node:crypto';
import {JSDOM,VirtualConsole} from 'jsdom';
import {newProgram,slotFromWorkout,steps} from '../src/planning.ts';
import {preset} from '../src/training.ts';
import aiFixture from './fixtures/ai-plan.json' with {type:'json'};
import {initialState,createSession} from '../src/domain.ts';

const directory=new URL('../dist/treino-flow/browser/',import.meta.url);
const main=fs.readdirSync(directory).find(file=>/^main-.*\.js$/.test(file));
if(!main)throw Error('Compile o Angular antes dos testes de interface.');
const artifact=process.env.RITMO_UI_ARTIFACT;
const application=artifact?fs.readFileSync(artifact,'utf8').match(/<script type="module">([\s\S]*?)<\/script>/)[1]:fs.readFileSync(new URL(main,directory),'utf8');
const demoDirectory=new URL('../dist/ritmo-demo/browser/',import.meta.url);
const demoArtifact=process.env.RITMO_DEMO_ARTIFACT;
const demoApplication=demoArtifact?fs.readFileSync(demoArtifact,'utf8').match(/<script type="module">([\s\S]*?)<\/script>/)[1]:fs.readFileSync(new URL(fs.readdirSync(demoDirectory).find(file=>/^main-.*\.js$/.test(file)),demoDirectory),'utf8');
const legacyName=artifact?'ritmo.portfolio.beta.v2':'ritmo.v1';
const legacyKey='ritmo.demo.'+legacyName;
const delay=()=>new Promise(resolve=>setTimeout(resolve,25));
async function waitFor(check){for(let i=0;i<120;i++){if(check())return;await delay();}throw Error('A interface não atingiu o estado esperado.');}
async function open(seed={},clock,network,owner,secure=false,url='https://ritmo-ui-test.invalid/'){
 const errors=[];const console=new VirtualConsole();console.on('jsdomError',error=>errors.push(String(error)));console.on('error',error=>errors.push(String(error)));
 const dom=new JSDOM('<!doctype html><html lang="pt-BR"><body><app-root></app-root></body></html>',{url,runScripts:'dangerously',pretendToBeVisual:true,virtualConsole:console,beforeParse(window){if(network){window.fetch=network;window.Response=Response;window.Request=Request;window.Headers=Headers;}if(owner)window.sessionStorage.setItem('ritmo.workspace.v1',owner);if(clock){const NativeDate=window.Date;window.Date=class extends NativeDate{constructor(...args){super(...(args.length?args:[clock.now]));}static now(){return new NativeDate(clock.now).getTime();}};}window.structuredClone=structuredClone;window.TextEncoder=TextEncoder;window.crypto.randomUUID=randomUUID;for(const [key,value] of Object.entries(seed))window.localStorage.setItem(key,value);}});
 const script=dom.window.document.createElement('script');script.textContent=secure==="demo"?demoApplication:secure||network||owner?application:demoApplication;dom.window.document.body.append(script);
 await waitFor(()=>dom.window.document.querySelector('nav button,.auth-page'));
 return {dom,document:dom.window.document,errors};
}
function button(document,label){const found=[...document.querySelectorAll('button')].find(item=>item.textContent.trim()===label||(label==='Abrir treino do ciclo →'&&item.getAttribute('aria-label')?.startsWith('Abrir treino do ciclo de ')));assert.ok(found,`Botão não encontrado: ${label}`);return found;}
async function click(document,label){button(document,label).click();await delay();}
function library(dom){return JSON.parse(dom.window.localStorage.getItem('ritmo.demo.ritmo.training.v2'));}

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
  const original=dom.window.localStorage.getItem('ritmo.demo.ritmo.training.v2');
  const input=document.querySelector('.import-panel textarea');input.value='{invalid';input.dispatchEvent(new dom.window.Event('input',{bubbles:true}));
  await click(document,'Revisar JSON');assert.equal(dom.window.localStorage.getItem('ritmo.demo.ritmo.training.v2'),original);
  const backup=JSON.parse(original);backup.workouts[0].title='Cópia restaurada';
  input.value=JSON.stringify(backup);input.dispatchEvent(new dom.window.Event('input',{bubbles:true}));
  await click(document,'Revisar JSON');assert.equal(library(dom).workouts[0].title,'Exemplo · séries tradicionais');
  await click(document,'Restaurar esta cópia');assert.equal(library(dom).workouts[0].title,'Cópia restaurada');
  assert.equal(dom.window.localStorage.getItem('ritmo.demo.ritmo.training.v2.previous'),original);
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
 await click(document,'Encerrar e salvar sessão ✓');assert.ok(!document.querySelector('app-root').textContent.includes('Treinos registrados'));
 await click(document,'Editar');await click(document,'Separar séries em etapas');await click(document,'Salvar treino ✓');await click(document,'Iniciar treino →');assert.equal(document.querySelectorAll('.execution-block').length,3);
 await click(document,'Encerrar e salvar sessão ✓');await click(document,'↗ Histórico');assert.ok(document.querySelector('app-root').textContent.includes('Treinos registrados'));await click(document,'Consultar');assert.ok(document.querySelector('training-runner'));assert.deepEqual(errors,[]);
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

async function fillPlanning(dom,document,label,value){const input=document.querySelector(`[aria-label="${label}"]`);assert.ok(input,`Campo não encontrado: ${label}`);input.value=String(value);input.dispatchEvent(new dom.window.Event(input.tagName==='SELECT'?'change':'input',{bubbles:true}));await delay();}
async function enterPlanning(document){await click(document,'▦ Minha semana');await click(document,'Planejamento de ciclos');}
test('planejador copia semanas independentes e preserva origem da sessão ao salvar nova versão',async()=>{
 const {dom,document,errors}=await open();try{
 await click(document,'▤ Treinos');await click(document,'Criar treino +');await click(document,'Top set + back-offs ↗');await click(document,'Salvar treino ✓');const base=JSON.stringify(library(dom).workouts);
 await enterPlanning(document);await click(document,'Criar planejamento avançado');await fillPlanning(dom,document,'Nome do planejamento','Ciclo flexível');await fillPlanning(dom,document,'Objetivo do planejamento','Prioridade informada pelo usuário');await fillPlanning(dom,document,'Dias por visualização',9);
 await click(document,'Adicionar ao planejamento +');await fillPlanning(dom,document,'Nome da sessão planejada','Upper');await fillPlanning(dom,document,'Estímulo da sessão','Força');await click(document,'⚙ Meu perfil');await enterPlanning(document);assert.equal(document.querySelector('[aria-label="Nome da sessão planejada"]').value,'Upper');await click(document,'Aplicar sessão ✓');
 await click(document,'Copiar intervalo');assert.equal(document.querySelectorAll('.planning-slot').length,2);document.querySelectorAll('.planning-slot-open')[1].click();await delay();await fillPlanning(dom,document,'Nome da sessão planejada','All Day');await fillPlanning(dom,document,'Estímulo da sessão','Hipertrofia');await click(document,'Aplicar sessão ✓');await click(document,'Salvar planejamento ✓');
 const saved=JSON.parse(dom.window.localStorage.getItem('ritmo.demo.ritmo.planning.v1'))[0];assert.equal(saved.slots[0].stimulus,'Força');assert.equal(saved.slots[1].stimulus,'Hipertrofia');assert.equal(saved.slots[1].day,8);assert.equal(saved.periods.length,0);assert.equal(JSON.stringify(library(dom).workouts),base);
 await click(document,'Iniciar →');assert.ok(document.querySelector('training-runner'));assert.equal(library(dom).active.planning.programRevision,1);assert.equal(library(dom).active.plan.title,'Upper');const active=JSON.stringify(library(dom).active);
 await enterPlanning(document);await click(document,'Abrir planejamento →');await fillPlanning(dom,document,'Nome do planejamento','Ciclo revisado');await click(document,'Salvar planejamento ✓');assert.equal(JSON.parse(dom.window.localStorage.getItem('ritmo.demo.ritmo.planning.v1')).length,2);assert.equal(JSON.stringify(library(dom).active),active);
 await click(document,'Iniciar →');assert.match(document.querySelector('app-planning-panel .training-message').textContent,/em andamento/);assert.equal(JSON.stringify(library(dom).active),active);assert.deepEqual(errors,[]);
 }finally{dom.window.close();}
});
test('planejamento inválido, cópia revisada e conflito entre abas preservam dados',async()=>{
 const {dom,document,errors}=await open();try{
 await enterPlanning(document);await click(document,'Criar planejamento avançado');await click(document,'Salvar planejamento ✓');assert.equal(dom.window.localStorage.getItem('ritmo.demo.ritmo.planning.v1'),null);
 await fillPlanning(dom,document,'Objetivo do planejamento','Objetivo');await click(document,'Salvar planejamento ✓');await click(document,'Fechar planejamento');const raw=dom.window.localStorage.getItem('ritmo.demo.ritmo.planning.v1');
 await fillPlanning(dom,document,'Importar planejamento JSON','{invalid');await click(document,'Revisar planejamento importado');assert.equal(dom.window.localStorage.getItem('ritmo.demo.ritmo.planning.v1'),raw);
 const archive=JSON.parse(raw);archive[0].id='archive-program';archive[0].title='Cópia independente';await fillPlanning(dom,document,'Importar planejamento JSON',JSON.stringify(archive));await click(document,'Revisar planejamento importado');assert.equal(dom.window.localStorage.getItem('ritmo.demo.ritmo.planning.v1'),raw);await click(document,'Adicionar versões da cópia');assert.equal(JSON.parse(dom.window.localStorage.getItem('ritmo.demo.ritmo.planning.v1')).length,2);assert.equal(dom.window.localStorage.getItem('ritmo.demo.ritmo.planning.v1.previous'),raw);
 await click(document,'Abrir planejamento →');await fillPlanning(dom,document,'Nome do planejamento','Edição local');const external=dom.window.localStorage.getItem('ritmo.demo.ritmo.planning.v1')+' ';dom.window.localStorage.setItem('ritmo.demo.ritmo.planning.v1',external);await click(document,'Salvar planejamento ✓');assert.equal(dom.window.localStorage.getItem('ritmo.demo.ritmo.planning.v1'),external);assert.match(document.querySelector('app-planning-panel .training-message').textContent,/Outra aba/);assert.deepEqual(errors,[]);
 }finally{dom.window.close();}
});

test('montagem guiada configura metas por abordagem, escolhe 123132 e mostra registros reais',async()=>{
 const {dom,document,errors}=await open();try{
 await click(document,'▤ Treinos');await click(document,'Criar treino +');await click(document,'Top set + back-offs ↗');await click(document,'Salvar treino ✓');const base=JSON.stringify(library(dom).workouts);
 await enterPlanning(document);await click(document,'Criar planejamento +');assert.ok(document.querySelector('guided-planning'));await fillPlanning(dom,document,'Nome do planejamento guiado','Meu ciclo simples');await fillPlanning(dom,document,'Objetivo guiado','Objetivo informado');await fillPlanning(dom,document,'Ficha da montagem guiada',library(dom).workouts[0].id);
 const day=document.querySelector('[aria-label="Dia para novo treino"]');day.value=day.options[2].value;day.dispatchEvent(new dom.window.Event('change',{bubbles:true}));await delay();await click(document,'Adicionar treino à semana +');await fillPlanning(dom,document,'Nome do treino semanal','LOWER — QUARTA');await click(document,'Continuar para metas →');
 await fillPlanning(dom,document,'Séries por exercício',4);await fillPlanning(dom,document,'top reps mínimo',5);await fillPlanning(dom,document,'top reps máximo',8);await fillPlanning(dom,document,'backoff reps mínimo',6);await fillPlanning(dom,document,'backoff reps máximo',8);
 for(const role of ['top','backoff']){await fillPlanning(dom,document,role+' rir mínimo',0);await fillPlanning(dom,document,role+' rir máximo',1);await fillPlanning(dom,document,role+' rest mínimo',120);await fillPlanning(dom,document,role+' rest máximo',180);}
 await click(document,'Hipertrofia');assert.equal(document.querySelector('[aria-label="Séries por exercício"]').value,'3');await click(document,'Volume');await fillPlanning(dom,document,'Organização das séries','traditional');await fillPlanning(dom,document,'work reps mínimo',12);await fillPlanning(dom,document,'work reps máximo',15);await click(document,'Continuar para semanas →');await click(document,'Ver meu planejamento →');assert.match(document.querySelector('guided-planning [role="alert"]').textContent,/todas as semanas/);
 const labels=['Força','Hipertrofia','Volume','Força','Volume','Hipertrofia'];for(const [index,label] of labels.entries()){const select=document.querySelector(`[aria-label="LOWER — QUARTA semana ${index+1}"]`);select.value=[...select.options].find(option=>option.textContent===label).value;select.dispatchEvent(new dom.window.Event('change',{bubbles:true}));await delay();}
 await click(document,'Ver meu planejamento →');assert.equal(document.querySelectorAll('.guided-record-week').length,6);await click(document,'Salvar planejamento guiado ✓');const plan=JSON.parse(dom.window.localStorage.getItem('ritmo.demo.ritmo.planning.v1'))[0];assert.deepEqual(plan.slots.map(slot=>slot.stimulus),labels);assert.equal(plan.slots[0].day,3);assert.equal(JSON.stringify(library(dom).workouts),base);
 document.querySelector('[aria-label="Abrir LOWER — QUARTA semana 1"]').click();await delay();assert.equal(document.querySelectorAll('.series-entry').length,4);for(const [label,value] of [['Carga',290],['Repetições',8],['Repetições em reserva',0],['Descanso',150]])await fillPlanning(dom,document,'Etapa 1 '+label,value);document.querySelector('.series-check').click();await delay();assert.equal(document.querySelector('.series-entry').getAttribute('data-tone'),'positive');await click(document,'Encerrar e salvar sessão ✓');
 await enterPlanning(document);await click(document,'Abrir planejamento →');assert.ok(document.querySelector('.guided-record-series [data-tone="positive"]').textContent.includes('290×8'));document.querySelector('[aria-label="Abrir LOWER — QUARTA semana 1"]').click();await delay();assert.ok(document.querySelector('training-runner'));assert.equal(library(dom).active,null);assert.equal(library(dom).sessions.length,1);assert.deepEqual(errors,[]);
 }finally{dom.window.close();}
});

test('montagem guiada começa sem ficha, compartilha nome e observações e retoma edição incompleta',async()=>{
 const {dom,document,errors}=await open();try{
 await enterPlanning(document);await click(document,'Criar planejamento +');await fillPlanning(dom,document,'Nome do planejamento guiado','Plano do zero');await fillPlanning(dom,document,'Objetivo guiado','Meu objetivo');await fillPlanning(dom,document,'Quantidade de semanas',1);await click(document,'Adicionar treino à semana +');await fillPlanning(dom,document,'Nome do treino semanal','Treino A');await click(document,'Continuar para metas →');await fillPlanning(dom,document,'Nome do exercício guiado','Cadeira flexora');await fillPlanning(dom,document,'Observações do exercício guiado','Aquecimento de joelho e posterior');await fillPlanning(dom,document,'work reps mínimo',6);await fillPlanning(dom,document,'work reps máximo',10);await click(document,'Hipertrofia');assert.equal(document.querySelector('[aria-label="Nome do exercício guiado"]').value,'Cadeira flexora');assert.equal(document.querySelector('[aria-label="Observações do exercício guiado"]').value,'Aquecimento de joelho e posterior');assert.equal(document.querySelector('[aria-label="work reps mínimo"]').value,'');
 await click(document,'Continuar para semanas →');const choose=document.querySelector('[aria-label="Treino A semana 1"]');choose.value=choose.options[1].value;choose.dispatchEvent(new dom.window.Event('change',{bubbles:true}));await delay();await click(document,'Ver meu planejamento →');await click(document,'Salvar planejamento guiado ✓');await click(document,'Editar montagem');await fillPlanning(dom,document,'Quantidade de semanas',2);await click(document,'⚙ Meu perfil');await enterPlanning(document);assert.ok(document.querySelector('[aria-label="Quantidade de semanas"]'));assert.equal(document.querySelector('[aria-label="Quantidade de semanas"]').value,'2');assert.deepEqual(errors,[]);
 }finally{dom.window.close();}
});

test('troca manual com IA gera pedido, valida resposta e abre rascunho sem alterar dados até salvar',async()=>{
 const {dom,document,errors}=await open();try{
 await click(document,'▤ Treinos');await click(document,'Criar treino +');await click(document,'Séries tradicionais ↗');await click(document,'Salvar treino ✓');const original=dom.window.localStorage.getItem('ritmo.demo.ritmo.training.v2');
 await enterPlanning(document);await click(document,'Montar com IA ↗');await fillPlanning(dom,document,'Pedido para IA','Quero meu planejamento completo de seis semanas.');await click(document,'Gerar pedido para copiar');const prompt=document.querySelector('[aria-label="Comunicação para copiar"]').value;assert.ok(prompt.includes('CONTRATO JSON SCHEMA'));assert.ok(!prompt.includes('Observação privada'));const requestId=prompt.match(/"requestId":"([^"]+)"/)[1];
 let copied='';Object.defineProperty(dom.window.navigator,'clipboard',{value:{writeText:async text=>{copied=text;}}});await click(document,'Copiar pedido completo');assert.equal(copied,prompt);
 await fillPlanning(dom,document,'Resposta da IA','{invalid');await click(document,'Validar e revisar resposta');assert.equal(document.querySelector('.ai-reply-preview'),null);assert.equal(dom.window.localStorage.getItem('ritmo.demo.ritmo.planning.v1'),null);
 const response=structuredClone(aiFixture);response.requestId=requestId;await fillPlanning(dom,document,'Resposta da IA',JSON.stringify(response));await click(document,'Validar e revisar resposta');assert.ok(document.querySelector('.ai-reply-preview').textContent.includes('6 semanas'));assert.equal(dom.window.localStorage.getItem('ritmo.demo.ritmo.planning.v1'),null);await click(document,'Abrir planejamento para revisar →');assert.ok(document.querySelector('guided-planning'));assert.equal(dom.window.localStorage.getItem('ritmo.demo.ritmo.planning.v1'),null);assert.equal(dom.window.localStorage.getItem('ritmo.demo.ritmo.training.v2'),original);
 await click(document,'Salvar planejamento guiado ✓');const saved=JSON.parse(dom.window.localStorage.getItem('ritmo.demo.ritmo.planning.v1'));assert.equal(saved.length,1);assert.equal(saved[0].slots.length,6);assert.equal(saved[0].slots[0].workout.nodes[0].series.length,4);assert.equal(dom.window.localStorage.getItem('ritmo.demo.ritmo.training.v2'),original);assert.deepEqual(errors,[]);
 }finally{dom.window.close();}
});

test('resposta avançada da IA abre o editor livre com nove dias e mantém importação sem salvar',async()=>{
 const fixture=(await import('./fixtures/ai-advanced-plan.json',{with:{type:'json'}})).default;const {dom,document,errors}=await open();try{
 const entry=[...document.querySelectorAll('button')].find(button=>button.textContent.includes('Montar meu planejamento com IA'));assert.ok(entry);entry.click();await delay();assert.ok(document.querySelector('ai-exchange-panel'));await fillPlanning(dom,document,'Resposta da IA',JSON.stringify(fixture));await click(document,'Validar e revisar resposta');assert.ok(document.querySelector('.ai-reply-preview').textContent.includes('9 dias'));assert.equal(dom.window.localStorage.getItem('ritmo.demo.ritmo.planning.v1'),null);await click(document,'Abrir planejamento para revisar →');assert.equal(document.querySelector('guided-planning'),null);assert.equal(document.querySelector('[aria-label="Duração em dias"]').value,'9');assert.equal(dom.window.localStorage.getItem('ritmo.demo.ritmo.planning.v1'),null);await click(document,'Salvar planejamento ✓');assert.equal(JSON.parse(dom.window.localStorage.getItem('ritmo.demo.ritmo.planning.v1'))[0].slots.length,2);assert.deepEqual(errors,[]);
 }finally{dom.window.close();}
});

function calendarProgram(){const plan=newProgram();plan.title='Ciclo automático';plan.context.objective='Objetivo';plan.startDate='2026-11-23';plan.durationDays=14;plan.slots=[slotFromWorkout(preset('strength'),1),slotFromWorkout(preset('strength'),8)];for(const [index,slot] of plan.slots.entries()){slot.label='Treino semana '+(index+1);slot.stimulus=index?'Hipertrofia':'Força';for(const step of steps(slot.workout.nodes))for(const series of step.series??[]){const reps=series.goals.find(goal=>goal.metric==='reps');if(reps){reps.min=index?10:5;reps.max=index?12:8;}}}return plan;}
test('ativação conecta Hoje e Minha semana, avança a semana e preserva registros e rotina',async()=>{
 const plan=calendarProgram(),clock={now:'2026-11-23T12:00:00'};const {dom,document,errors}=await open({'ritmo.demo.ritmo.planning.v1':JSON.stringify([plan])},clock);try{
 const originalWeek=JSON.stringify(JSON.parse(dom.window.localStorage.getItem(legacyKey)).week);await enterPlanning(document);await click(document,'Ativar ciclo ↗');await click(document,'Ativar ciclo ✓');assert.equal(document.querySelector('.cycle-position').textContent.trim(),'Semana 1 de 2 · dia 1 de 14');assert.equal(library(dom),null);
 await click(document,'Abrir treino do ciclo →');assert.match(document.querySelector('.series-targets').textContent,/5–8 reps/);const cycleId=JSON.parse(dom.window.localStorage.getItem('ritmo.demo.ritmo.active-cycle.v1')).id;assert.equal(library(dom).active.planning.activationId,cycleId);
 await fillPlanning(dom,document,'Etapa 1 Carga',20);await fillPlanning(dom,document,'Etapa 1 Repetições',6);document.querySelector('.series-check').click();await delay();await click(document,'Encerrar e salvar sessão ✓');const history=JSON.stringify(library(dom).sessions);
 await click(document,'◉ Hoje ↗');assert.ok(document.querySelector('.cycle-slot').textContent.includes('Sessão registrada'));clock.now='2026-11-30T12:00:00';dom.window.dispatchEvent(new dom.window.Event('focus'));await delay();assert.match(document.querySelector('.cycle-position').textContent,/Semana 2 de 2/);assert.ok(document.querySelector('.cycle-slot').textContent.includes('Hipertrofia'));
 await click(document,'▦ Minha semana');assert.equal(document.querySelectorAll('.cycle-days>.cycle-day').length,7);assert.ok(document.querySelector('.cycle-slot').textContent.includes('Treino semana 2'));await click(document,'Abrir treino do ciclo →');assert.match(document.querySelector('.series-targets').textContent,/10–12 reps/);assert.equal(JSON.stringify(library(dom).sessions),history);
 await click(document,'◉ Hoje ↗');clock.now='2026-12-07T12:00:00';dom.window.dispatchEvent(new dom.window.Event('focus'));await delay();assert.match(document.querySelector('.cycle-position').textContent,/Ciclo encerrado/);assert.ok(button(document,'Continuar sessão em andamento →'));const active=JSON.stringify(library(dom).active);
 await click(document,'Gerenciar ciclo');await click(document,'Desativar ciclo');assert.equal(dom.window.localStorage.getItem('ritmo.demo.ritmo.active-cycle.v1'),null);assert.equal(JSON.stringify(library(dom).active),active);assert.equal(JSON.stringify(library(dom).sessions),history);assert.equal(JSON.stringify(JSON.parse(dom.window.localStorage.getItem(legacyKey)).week),originalWeek);assert.deepEqual(errors,[]);
 }finally{dom.window.close();}
});
test('alterar a data inicia outra ativação sem concluir sessões anteriores',async()=>{
 const plan=calendarProgram(),clock={now:'2026-11-23T12:00:00'};const {dom,document,errors}=await open({'ritmo.demo.ritmo.planning.v1':JSON.stringify([plan])},clock);try{
 await enterPlanning(document);await click(document,'Ativar ciclo ↗');await click(document,'Ativar ciclo ✓');const original=JSON.parse(dom.window.localStorage.getItem('ritmo.demo.ritmo.active-cycle.v1'));await click(document,'Abrir treino do ciclo →');const started=JSON.stringify(library(dom).active);
 await click(document,'◉ Hoje ↗');await click(document,'Gerenciar ciclo');await fillPlanning(dom,document,'Início do ciclo ativo','2026-11-16');await click(document,'Ativar ciclo ✓');const changed=JSON.parse(dom.window.localStorage.getItem('ritmo.demo.ritmo.active-cycle.v1'));assert.notEqual(changed.id,original.id);assert.equal(changed.programRevision,2);assert.equal(JSON.stringify(library(dom).active),started);assert.equal(library(dom).sessions.length,0);assert.match(document.querySelector('.cycle-position').textContent,/Semana 2 de 2/);assert.deepEqual(errors,[]);
 }finally{dom.window.close();}
});

test('nova versão só muda ciclo após reativação e conserva sessão já iniciada',async()=>{
 const plan=calendarProgram(),clock={now:'2026-11-23T12:00:00'};const {dom,document,errors}=await open({'ritmo.demo.ritmo.planning.v1':JSON.stringify([plan])},clock);try{
 await enterPlanning(document);await click(document,'Ativar ciclo ↗');await click(document,'Ativar ciclo ✓');const cycle=JSON.parse(dom.window.localStorage.getItem('ritmo.demo.ritmo.active-cycle.v1'));await click(document,'Abrir treino do ciclo →');const started=JSON.stringify(library(dom).active);
 await enterPlanning(document);await click(document,'Abrir planejamento →');await fillPlanning(dom,document,'Nome do planejamento','Ciclo revisado');await click(document,'Salvar planejamento ✓');assert.equal(JSON.parse(dom.window.localStorage.getItem('ritmo.demo.ritmo.active-cycle.v1')).programRevision,1);await click(document,'◉ Hoje ↗');assert.ok(document.querySelector('.cycle-current').textContent.includes('Nova versão disponível'));
 await click(document,'Gerenciar ciclo');await click(document,'Ativar ciclo ✓');const updated=JSON.parse(dom.window.localStorage.getItem('ritmo.demo.ritmo.active-cycle.v1'));assert.equal(updated.id,cycle.id);assert.equal(updated.programRevision,2);assert.equal(updated.program.title,'Ciclo revisado');assert.equal(JSON.stringify(library(dom).active),started);assert.ok(document.querySelector('.cycle-slot').textContent.includes('Em andamento'));assert.deepEqual(errors,[]);
 }finally{dom.window.close();}
});

test('lista permite mudar o dia de uma sessão, persiste e preserva metas e histórico',async()=>{const plan=calendarProgram(),clock={now:'2026-11-23T12:00:00'};const {dom,document,errors}=await open({'ritmo.demo.ritmo.planning.v1':JSON.stringify([plan])},clock);try{await enterPlanning(document);await click(document,'Ativar ciclo ↗');await click(document,'Ativar ciclo ✓');await click(document,'▦ Minha semana');document.querySelector('[aria-label="Trocar dia de Treino semana 1"]').click();await delay();await fillPlanning(dom,document,'Nova data de Treino semana 1','2026-12-07');await click(document,'Salvar dia');assert.match(document.querySelector('.training-message').textContent,/dentro do ciclo/);await fillPlanning(dom,document,'Nova data de Treino semana 1','2026-11-25');await click(document,'Salvar dia');let saved=JSON.parse(dom.window.localStorage.getItem('ritmo.demo.ritmo.active-cycle.v1'));assert.equal(saved.rescheduled[plan.slots[0].id],'2026-11-25');assert.deepEqual(saved.program.slots,plan.slots);const row=[...document.querySelectorAll('.cycle-day')].find(el=>el.textContent.includes('Treino semana 1'));assert.match(row.querySelector('h3').textContent,/qua/);await click(document,'◉ Hoje ↗');assert.equal(document.querySelector('.cycle-slot'),null);await click(document,'▦ Minha semana');await click(document,'Abrir treino do ciclo →');assert.match(document.querySelector('.series-targets').textContent,/5–8 reps/);const snapshot=JSON.stringify(library(dom).active);await click(document,'▦ Minha semana');assert.equal(document.querySelector('[aria-label="Trocar dia de Treino semana 1"]'),null);assert.equal(JSON.stringify(library(dom).active),snapshot);assert.deepEqual(errors,[]);}finally{dom.window.close();}});

test('alça arrasta, troca treinos e oferece seleção por toque sem alterar metas',async()=>{const plan=calendarProgram();const other=structuredClone(plan.slots[0]);other.id='other-slot';other.day=3;other.label='Treino B';plan.slots.push(other);const {dom,document,errors}=await open({'ritmo.demo.ritmo.planning.v1':JSON.stringify([plan])},{now:'2026-11-23T12:00:00'});try{await enterPlanning(document);await click(document,'Ativar ciclo ↗');await click(document,'Ativar ciclo ✓');await click(document,'▦ Minha semana');const grip=document.querySelector('[aria-label="Mover Treino semana 1"]');const transfer={setData(){},effectAllowed:''};const start=new dom.window.Event('dragstart',{bubbles:true});Object.defineProperty(start,'dataTransfer',{value:transfer});grip.dispatchEvent(start);await delay();const target=document.querySelector('[data-agenda-date="2026-11-25"]');target.dispatchEvent(new dom.window.Event('dragover',{bubbles:true,cancelable:true}));await delay();assert.ok(target.classList.contains('agenda-over'));target.dispatchEvent(new dom.window.Event('drop',{bubbles:true,cancelable:true}));await delay();let cycle=JSON.parse(dom.window.localStorage.getItem('ritmo.demo.ritmo.active-cycle.v1'));assert.equal(cycle.rescheduled[plan.slots[0].id],'2026-11-25');assert.equal(cycle.rescheduled[other.id],'2026-11-23');assert.deepEqual(cycle.program.slots,plan.slots);document.querySelector('[aria-label="Mover Treino semana 1"]').click();await delay();document.querySelector('[aria-label="Mover treino para qui"]').click();await delay();cycle=JSON.parse(dom.window.localStorage.getItem('ritmo.demo.ritmo.active-cycle.v1'));assert.equal(cycle.rescheduled[plan.slots[0].id],'2026-11-26');const handle=document.querySelector('[aria-label="Mover Treino semana 1"]');const day=document.querySelector('[data-agenda-date="2026-11-27"]');document.elementFromPoint=()=>day;for(const [type,y] of [['pointerdown',10],['pointermove',100],['pointerup',100]]){const event=new dom.window.Event(type,{bubbles:true,cancelable:true});for(const [key,value] of Object.entries({pointerId:1,pointerType:'touch',clientX:100,clientY:y}))Object.defineProperty(event,key,{value});handle.dispatchEvent(event);await delay();}cycle=JSON.parse(dom.window.localStorage.getItem('ritmo.demo.ritmo.active-cycle.v1'));assert.equal(cycle.rescheduled[plan.slots[0].id],'2026-11-27');assert.equal(library(dom),null);assert.deepEqual(errors,[]);}finally{dom.window.close();}});
import {snapshotText} from '../src/cloud.ts';
function cloudServer(remote=null){
 const owner='11111111-1111-4111-8111-111111111111',user={id:owner,aud:'authenticated',role:'authenticated',email:'ritmo@example.invalid',app_metadata:{provider:'email',providers:['email']},user_metadata:{},created_at:new Date().toISOString()};let row=remote,online=true,valid=true,badLogin=false;const calls=[];
 const json=(value,status=200)=>new Response(JSON.stringify(value),{status,headers:{'Content-Type':'application/json'}});
 const jwt=()=>{const encode=value=>Buffer.from(JSON.stringify(value)).toString('base64url');return encode({alg:'HS256',typ:'JWT'})+'.'+encode({sub:owner,aud:'authenticated',role:'authenticated',exp:Math.floor(Date.now()/1000)+3600})+'.fake';};
 const session=()=>({access_token:jwt(),refresh_token:'fake-refresh-token',expires_in:3600,expires_at:Math.floor(Date.now()/1000)+3600,token_type:'bearer',user});
 const network=async(input,init={})=>{const url=String(input?.url??input),method=init.method??'GET';calls.push([method,url]);if(url.endsWith('supabase-config.json'))return json({url:'https://test-ritmo.supabase.co',publishableKey:'sb_publishable_test'});if(!online)throw Error('offline');if(url.includes('/auth/v1/token'))return badLogin?json({message:'Invalid login credentials',error_code:'invalid_credentials'},400):json(session());if(url.includes('/auth/v1/signup'))return json(user);if(url.includes('/auth/v1/recover'))return json({});if(url.includes('/auth/v1/user'))return valid?json(user):json({message:'Invalid token',code:'bad_jwt'},401);if(url.includes('/rest/v1/ritmo_snapshots'))return json(row?[{...row,user_id:owner}]:[]);if(url.includes('/rest/v1/rpc/ritmo_save_snapshot')){const body=JSON.parse(init.body);if(body.expected_revision!==(row?.revision??0))return json({code:'40001',message:'snapshot conflict'},409);row={revision:(row?.revision??0)+1,payload:body.next_payload,updated_at:new Date().toISOString()};return json([row]);}return json({});};
 return {owner,user,calls,network,session,get row(){return row;},set row(value){row=value;},set online(value){online=value;},set valid(value){valid=value;},set badLogin(value){badLogin=value;}};
}
const sdkKey='sb-test-ritmo-auth-token';
function snapshot(state=initialState()){return {kind:'ritmoBackup',schemaVersion:1,legacy:state,training:null,planning:[],cycle:null};}
function accountSeed(server,state=server.row?.payload.legacy??initialState()){const prefix='ritmo.account.'+server.owner+'.';return {[sdkKey]:JSON.stringify(server.session()),[prefix+legacyName]:JSON.stringify(state),[prefix+'ritmo.sync.v1']:JSON.stringify({revision:server.row?.revision??1,base:snapshotText(server.row?.payload??snapshot(state))})};}
async function loginCloud(dom,document){await waitFor(()=>document.querySelector('.auth-form'));await fillPlanning(dom,document,'E-mail da conta','ritmo@example.invalid');await fillPlanning(dom,document,'Senha da conta','senha-teste-segura');document.querySelector('.auth-form').dispatchEvent(new dom.window.Event('submit',{bubbles:true,cancelable:true}));await waitFor(()=>!document.querySelector('.auth-loading')&&(document.querySelector('.auth-migration,.auth-feedback,nav')||document.querySelector('h2')?.textContent==='Seu espaço está pronto.'));}
async function submitAuth(dom,document){document.querySelector('.auth-form').dispatchEvent(new dom.window.Event('submit',{bubbles:true,cancelable:true}));await delay();}
async function openAccount(document){await click(document,'⚙ Meu perfil');document.querySelector('.account-status').click();await delay();}
function noWorkspace(document){assert.equal(document.querySelector('ritmo-workspace,nav,training-panel,active-cycle-panel'),null);}
function cleanErrors(errors){assert.deepEqual(errors.filter(error=>!error.includes('navigation')),[]);}

test('página de login bloqueia o app e não altera dados antigos nem os envia',async()=>{const server=cloudServer(),old=initialState();old.profile.name='Privado visitante';const seed={[legacyName]:JSON.stringify(old)},view=await open(seed,null,server.network);try{await waitFor(()=>view.document.querySelector('.auth-form'));noWorkspace(view.document);assert.ok(button(view.document,'Criar conta'));assert.ok(button(view.document,'Esqueci a senha'));assert.equal(view.dom.window.localStorage.getItem(legacyName),seed[legacyName]);assert.equal(server.calls.some(([,url])=>url.includes('/rest/')),false);assert.deepEqual(view.errors,[]);}finally{view.dom.window.close();}});

test('falha de configuração mantém a página de acesso sem liberar o sistema',async()=>{const view=await open({},null,async()=>new Response('{}',{status:503}),null,true);try{await waitFor(()=>view.document.querySelector('h2')?.textContent==='Vamos reconectar?');noWorkspace(view.document);button(view.document,'Tentar novamente');assert.equal(view.dom.window.localStorage.length,0);assert.deepEqual(view.errors,[]);}finally{view.dom.window.close();}});

test('senha incorreta não libera o sistema',async()=>{const server=cloudServer();server.badLogin=true;const view=await open({},null,server.network);try{await loginCloud(view.dom,view.document);await waitFor(()=>view.document.querySelector('.auth-feedback')?.textContent.includes('Confira e-mail'));noWorkspace(view.document);assert.equal(server.row,null);cleanErrors(view.errors);}finally{view.dom.window.close();}});

test('cadastro confirma senhas antes do envio e confirmação por e-mail não libera acesso',async()=>{const server=cloudServer(),{dom,document,errors}=await open({},null,server.network);try{await waitFor(()=>document.querySelector('.auth-form'));await click(document,'Criar conta');await fillPlanning(dom,document,'E-mail da conta','ritmo@example.invalid');await fillPlanning(dom,document,'Senha da conta','senha-teste-segura');await fillPlanning(dom,document,'Confirmar senha','outra-senha-segura');await submitAuth(dom,document);assert.match(document.querySelector('.auth-feedback').textContent,/precisam ser iguais/);assert.equal(server.calls.some(([,url])=>url.includes('/signup')),false);await fillPlanning(dom,document,'Confirmar senha','senha-teste-segura');await submitAuth(dom,document);await waitFor(()=>document.querySelector('.auth-feedback')?.textContent.includes('Confira seu e-mail'));noWorkspace(document);assert.equal(server.row,null);cleanErrors(errors);}finally{dom.window.close();}});

test('recuperação envia somente o pedido de link sem abrir o app',async()=>{const server=cloudServer(),{dom,document,errors}=await open({},null,server.network);try{await waitFor(()=>document.querySelector('.auth-form'));await click(document,'Esqueci a senha');assert.equal(document.querySelector('[aria-label="Senha da conta"]'),null);await fillPlanning(dom,document,'E-mail da conta','ritmo@example.invalid');await submitAuth(dom,document);await waitFor(()=>document.querySelector('.auth-feedback')?.textContent.includes('Se houver uma conta'));assert.ok(server.calls.some(([,url])=>url.includes('/recover')));noWorkspace(document);assert.deepEqual(errors,[]);}finally{dom.window.close();}});

test('login verificado permite migrar os dados antigos por escolha explícita',async()=>{const server=cloudServer(),old=JSON.stringify(initialState()),{dom,document,errors}=await open({[legacyName]:old},null,server.network);try{await loginCloud(dom,document);await waitFor(()=>document.querySelector('.auth-migration'));noWorkspace(document);assert.equal(server.row,null);assert.ok(server.calls.some(([,url])=>url.includes('/auth/v1/user')));await click(document,'Salvar dados deste aparelho na conta');await waitFor(()=>server.row!==null);await delay();assert.equal(server.row.revision,1);assert.equal(dom.window.localStorage.getItem(legacyName),old);assert.equal(dom.window.sessionStorage.getItem('ritmo.workspace.v1'),server.owner);assert.ok(dom.window.localStorage.getItem('ritmo.account.'+server.owner+'.'+legacyName));cleanErrors(errors);}finally{dom.window.close();}});

test('conta nova pode começar separada sem importar dados locais',async()=>{const server=cloudServer(),old=initialState();old.profile.name='Não importar';const {dom,document,errors}=await open({[legacyName]:JSON.stringify(old)},null,server.network);try{await loginCloud(dom,document);await waitFor(()=>document.querySelector('.auth-migration'));await click(document,'Começar no Ritmo →');await waitFor(()=>server.row);assert.notEqual(server.row.payload.legacy.profile.name,'Não importar');assert.equal(JSON.parse(dom.window.localStorage.getItem(legacyName)).profile.name,'Não importar');assert.equal(dom.window.sessionStorage.getItem('ritmo.workspace.v1'),server.owner);cleanErrors(errors);}finally{dom.window.close();}});

test('login de conta existente abre sua cópia sem enviar dados do visitante',async()=>{const state=initialState();state.profile.name='Online';const server=cloudServer({revision:4,payload:snapshot(state),updated_at:new Date().toISOString()}),old=JSON.stringify(initialState()),{dom,document,errors}=await open({[legacyName]:old},null,server.network);try{const original=JSON.stringify(server.row);await loginCloud(dom,document);await waitFor(()=>dom.window.sessionStorage.getItem('ritmo.workspace.v1')===server.owner);assert.equal(JSON.stringify(server.row),original);assert.equal(dom.window.localStorage.getItem(legacyName),old);assert.equal(JSON.parse(dom.window.localStorage.getItem('ritmo.account.'+server.owner+'.'+legacyName)).profile.name,'Online');noWorkspace(document);cleanErrors(errors);}finally{dom.window.close();}});

test('sessão restaurada só abre os treinos após validação no servidor',async()=>{const server=cloudServer({revision:1,payload:snapshot(),updated_at:new Date().toISOString()}),{dom,document,errors}=await open(accountSeed(server),null,server.network,server.owner);try{await waitFor(()=>document.querySelector('nav'));assert.equal(document.querySelector('.auth-page'),null);assert.ok(server.calls.some(([,url])=>url.includes('/auth/v1/user')));await click(document,'▤ Treinos');await click(document,'Criar treino +');await click(document,'Séries tradicionais ↗');await click(document,'Salvar treino ✓');assert.equal(JSON.parse(dom.window.localStorage.getItem('ritmo.account.'+server.owner+'.ritmo.training.v2')).workouts.length,1);assert.equal(dom.window.localStorage.getItem('ritmo.training.v2'),null);assert.deepEqual(errors,[]);}finally{dom.window.close();}});

test('sessão expirada ou falsa não mostra dados guardados da conta',async()=>{const state=initialState();state.profile.name='Não pode aparecer';const server=cloudServer({revision:1,payload:snapshot(state),updated_at:new Date().toISOString()});server.valid=false;const seed=accountSeed(server),{dom,document,errors}=await open(seed,null,server.network,server.owner);try{await waitFor(()=>document.querySelector('.auth-form'));noWorkspace(document);assert.ok(!document.body.textContent.includes('Não pode aparecer'));assert.equal(dom.window.localStorage.getItem('ritmo.account.'+server.owner+'.'+legacyName),seed['ritmo.account.'+server.owner+'.'+legacyName]);assert.equal(server.calls.some(([,url])=>url.includes('/rest/')),false);cleanErrors(errors);}finally{dom.window.close();}});

test('outra conta não mostra informações nem importa cache do usuário anterior',async()=>{const server=cloudServer(),other='22222222-2222-4222-8222-222222222222',privateState=initialState();privateState.profile.name='Outra pessoa';const seed={[sdkKey]:JSON.stringify(server.session()),['ritmo.account.'+other+'.'+legacyName]:JSON.stringify(privateState)},view=await open(seed,null,server.network,other);try{await waitFor(()=>view.document.querySelector('h2')?.textContent==='Seu espaço está pronto.');noWorkspace(view.document);assert.equal(view.document.querySelector('.auth-migration'),null);assert.ok(!view.document.body.textContent.includes('Outra pessoa'));assert.equal(server.row,null);cleanErrors(view.errors);}finally{view.dom.window.close();}});

test('entrar novamente preserva alterações ainda não enviadas da própria conta',async()=>{const online=initialState(),local=initialState();online.profile.name='Na nuvem';local.profile.name='Edição sem internet';const server=cloudServer({revision:2,payload:snapshot(online),updated_at:new Date().toISOString()}),prefix='ritmo.account.'+server.owner+'.';const {dom,document,errors}=await open({[prefix+legacyName]:JSON.stringify(local)},null,server.network);try{await loginCloud(dom,document);await waitFor(()=>dom.window.sessionStorage.getItem('ritmo.workspace.v1')===server.owner);assert.ok(dom.window.localStorage.getItem(prefix+legacyName).includes('Edição sem internet'));assert.equal(server.row.payload.legacy.profile.name,'Na nuvem');cleanErrors(errors);}finally{dom.window.close();}});

test('recuperação mantém acesso bloqueado até salvar a nova senha',async()=>{const server=cloudServer({revision:1,payload:snapshot(),updated_at:new Date().toISOString()}),session=server.session(),url='https://ritmo-ui-test.invalid/#access_token='+session.access_token+'&refresh_token=fake-refresh-token&expires_in=3600&token_type=bearer&type=recovery';const {dom,document,errors}=await open(accountSeed(server),null,server.network,server.owner,true,url);try{await waitFor(()=>document.querySelector('[aria-label="Nova senha da conta"]'));noWorkspace(document);await fillPlanning(dom,document,'Nova senha da conta','senha-nova-segura');await fillPlanning(dom,document,'Confirmar nova senha','senha-nova-segura');await submitAuth(dom,document);await waitFor(()=>document.querySelector('nav'));assert.ok(server.calls.some(([method,url])=>method==='PUT'&&url.includes('/auth/v1/user')));cleanErrors(errors);}finally{dom.window.close();}});

test('sair da conta remove imediatamente as telas pessoais e mantém os dados salvos',async()=>{const server=cloudServer({revision:1,payload:snapshot(),updated_at:new Date().toISOString()}),seed=accountSeed(server),{dom,document,errors}=await open(seed,null,server.network,server.owner);try{await waitFor(()=>document.querySelector('nav'));await openAccount(document);await click(document,'Sair da conta');await waitFor(()=>document.querySelector('.auth-page'));noWorkspace(document);assert.equal(dom.window.sessionStorage.getItem('ritmo.workspace.v1'),'guest');assert.equal(dom.window.localStorage.getItem(sdkKey),null);assert.ok(dom.window.localStorage.getItem('ritmo.account.'+server.owner+'.'+legacyName));cleanErrors(errors);}finally{dom.window.close();}});

test('conta envia mudanças, retoma após falha e bloqueia conflitos com outro aparelho',async()=>{
 const state=initialState(),payload=snapshot(state),server=cloudServer({revision:1,payload,updated_at:new Date().toISOString()}),prefix='ritmo.account.'+server.owner+'.';const {dom,document,errors}=await open(accountSeed(server),null,server.network,server.owner);try{
 await waitFor(()=>document.querySelector('nav'));await openAccount(document);await click(document,'Sincronizar agora');await waitFor(()=>document.querySelector('.account-sync-state')?.textContent.includes('Sincronizado'));
 const edit=async name=>{const value=JSON.parse(dom.window.localStorage.getItem(prefix+legacyName));value.profile.name=name;dom.window.localStorage.setItem(prefix+legacyName,JSON.stringify(value));dom.window.dispatchEvent(new dom.window.Event('ritmo-data-change'));await delay();};
 await edit('Meu primeiro envio');await click(document,'Sincronizar agora');assert.equal(server.row.revision,2);assert.equal(server.row.payload.legacy.profile.name,'Meu primeiro envio');
 server.online=false;await edit('Treino sem conexão');await click(document,'Sincronizar agora');assert.equal(server.row.revision,2);assert.ok(dom.window.localStorage.getItem(prefix+legacyName).includes('Treino sem conexão'));
 server.online=true;for(let i=0;i<400&&button(document,'Sincronizar agora').disabled;i++)await delay();await click(document,'Sincronizar agora');assert.equal(server.row.revision,3);assert.equal(server.row.payload.legacy.profile.name,'Treino sem conexão');
 const other=structuredClone(server.row);other.revision=4;other.payload.legacy.profile.name='Mudou no iPhone';server.row=other;await edit('Mudou no computador');await click(document,'Sincronizar agora');assert.equal(server.row.revision,4);assert.equal(server.row.payload.legacy.profile.name,'Mudou no iPhone');assert.ok(document.querySelector('cloud-account').textContent.includes('alterações diferentes'));assert.ok(button(document,'Aplicar versão da conta e reabrir').disabled);assert.ok(dom.window.localStorage.getItem(prefix+legacyName).includes('Mudou no computador'));assert.deepEqual(errors,[]);
 }finally{dom.window.close();}
});

test('Hoje fecha boas-vindas até reabrir e conta fica no final do perfil',async()=>{const {dom,document,errors}=await open();let saved;try{assert.ok(document.querySelector('.welcome-note'));assert.equal(document.querySelector('.topbar .account-status'),null);assert.equal(document.querySelector('.account-status'),null);assert.equal(document.querySelector('.assistant-card h3').textContent,'Uma rotina que acompanha você.');document.querySelector('[aria-label="Fechar mensagem de boas-vindas"]').click();await delay();assert.equal(document.querySelector('.welcome-note'),null);await click(document,'⚙ Meu perfil');assert.ok(document.querySelector('.profile-account .account-status'));assert.equal(document.querySelector('.profile-account').previousElementSibling.classList.contains('profile-form'),true);await click(document,'◉ Hoje ↗');assert.equal(document.querySelector('.welcome-note'),null);saved=Object.fromEntries(Object.entries(dom.window.localStorage));assert.deepEqual(errors,[]);}finally{dom.window.close();}const reopened=await open(saved);try{assert.ok(reopened.document.querySelector('.welcome-note'));assert.deepEqual(reopened.errors,[]);}finally{reopened.dom.window.close();}});

test('demo público não acessa Supabase nem dados pessoais, mesmo com conta selecionada',async()=>{const server=cloudServer(),seed=accountSeed(server),view=await open(seed,null,server.network,server.owner,'demo');try{await openAccount(view.document);assert.equal(server.calls.length,0);assert.ok(view.document.querySelector('cloud-account').textContent.includes('janela própria'));assert.equal(view.dom.window.localStorage.getItem('ritmo.account.'+server.owner+'.'+legacyName),seed['ritmo.account.'+server.owner+'.'+legacyName]);assert.ok(view.dom.window.localStorage.getItem(legacyKey));assert.deepEqual(view.errors,[]);}finally{view.dom.window.close();}});
