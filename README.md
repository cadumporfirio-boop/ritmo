# Ritmo — versão 0.7.1

Aplicação web para organizar treinos e registrar desempenho, com Angular + TypeScript e API em PHP/Laravel. Versão atual: 0.7.1.

![Interface do Ritmo](preview.png)

O projeto demonstra planejamento semanal, registro por série e revisão de sessões. A integração real com IA ainda não está ativa.

## Novidades da versão 0.7.1

Hoje tem boas-vindas com botão de fechar, mantidas ocultas durante a navegação e reapresentadas ao recarregar/reabrir ou autenticar uma conta. O aviso é transitório e não entra no backup. A navegação fica fixa embaixo em telas até 800 px, com espaço para a área segura do iPhone e para ações fixas durante o treino. Em telas maiores, a navegação lateral permanece.

Conta e sincronização ficam no último card de Meu perfil. Textos repetidos de Hoje foram reduzidos; avisos de falha de armazenamento e conflitos continuam visíveis. A frase do assistente usa espaços explícitos, sem uma quebra de linha que una palavras no celular. O banner externo do beta foi substituído pelo aviso dispensável do app.

## Novidades da versão 0.7.0

Conta por e-mail/senha usando Supabase Auth, cópia por usuário no Postgres e sincronização com comparação de versões. O modo sem conta continua local. Consulte [a configuração do Supabase](supabase/README.md).

O primeiro login exige escolher entre enviar os dados deste aparelho para uma conta vazia e abrir a cópia da conta. O login nunca envia automaticamente a biblioteca sem conta. A conta usa um espaço separado no navegador; sair retorna aos dados sem login. Senhas e chaves administrativas não fazem parte do backup.

Alterações salvas localmente são enviadas após uma pausa de 1,8 s; também há nova tentativa ao voltar à janela, reconectar e a cada minuto. A API só grava quando a revisão esperada ainda é a atual. Alterações simultâneas são sinalizadas, sem sobrescrita automática. Atualizações remotas são aplicadas por escolha explícita, com cópia local anterior. Aplicá-las exige finalizar a sessão ativa e salvar as edições.

O registro sem conexão funciona enquanto a página está aberta; esta versão ainda não tem service worker para abrir o site do zero sem internet. O backup completo pode ser baixado em Minha conta. O projeto Free pode pausar por inatividade e não inclui garantia de disponibilidade nem restauração automática de backups do provedor.

A configuração pública contém somente URL e chave publishable. Nunca coloque senha do banco, chave secreta ou service_role nela. O beta incorporado ao portfólio continua sem login; a conta é usada no endereço próprio do Ritmo.

## Novidades da versão 0.6.0

O botão **Ativar ciclo**, em Minha semana → Planejamento de ciclos, permite escolher um planejamento salvo e sua data inicial. Hoje e Minha semana passam a usar a cópia ativada, com sessões e metas correspondentes às datas. A semana civil pode ser consultada para trás e para a frente. Datas são calculadas como dias de calendário, sem somar horas locais sujeitas a horário de verão. A data é atualizada ao retornar à janela e periodicamente enquanto a página permanece aberta.

A ativação fica em `ritmo.active-cycle.v1`, separada da rotina de referência e das bibliotecas. Ela conserva uma cópia do planejamento, seu identificador, versão e data. Ajustar a data salva uma nova versão do planejamento; fichas guiadas são rematerializadas para respeitar os dias da semana. Ativar outra data ou outro planejamento cria uma nova instância. Reaplicar a mesma data e planejamento conserva a instância e atualiza a versão escolhida.

Sessões iniciadas pela ativação recebem `planning.activationId`. A associação impede que registros de outra execução do ciclo sejam contados como se pertencessem à atual. Sessões em andamento e concluídas preservam seus planos; o calendário não preenche registros, não conclui pendências nem repete automaticamente um ciclo encerrado. Alterações do planejamento só chegam à ativação após escolha explícita do usuário.

A rotina de referência permanece acessível e inalterada. Atividades pessoais e outros esportes aparecem como referência nos dias do ciclo. A ativação e seus registros são guardados localmente e, a partir da versão 0.7, podem ser sincronizados com uma conta.

## Novidades da versão 0.5.0

**Montar com IA** gera um pedido portável para copiar ou baixar e levar a um chat externo. O pedido inclui as instruções, um contrato de resposta e os dados escolhidos pelo usuário. Fichas, planejamento de referência e histórico confirmado são opcionais. O histórico exportado se limita às cinco sessões estruturadas concluídas mais recentes e não inclui observações pessoais. Nenhum dado é enviado automaticamente para outro serviço.

A resposta pode ser colada como JSON, inclusive em bloco de código, ou importada de arquivo. O formato compacto materializa todas as semanas no planejador guiado; o formato avançado preserva ciclos livres, blocos e exercícios independentes por sessão. A importação exige validação estrutural e semântica, confere o identificador do pedido quando disponível e abre uma cópia para revisão. Salvar continua sendo uma ação explícita; o histórico não é importado nem substituído.

O contrato compartilhado está em `contracts/ai-exchange.schema.json`. A interface PHP `PlanningProvider` define a porta futura de geração. O adaptador padrão é `UnconfiguredPlanningProvider` e `RITMO_AI_ENABLED=false`. Os endpoints privados são `GET /api/ai/capabilities`, `POST /api/ai/validate-response` e `POST /api/ai/planning`; a geração também tem limite de requisições. Mesmo ativando a opção, não há geração sem implementar e vincular um provedor no servidor. A resposta da API é validada e não é gravada automaticamente. Chaves de provedor devem permanecer somente no servidor.

A demonstração pública do GitHub Pages continua estática e usa a troca manual. A API PHP preparada no projeto não é hospedada pelo GitHub Pages. Os custos e limites do chat externo dependem do serviço escolhido; não há chamada de API paga no fluxo manual.

## Novidades da versão 0.4.1

A criação de planejamento abre uma montagem guiada: rotina, metas por abordagem e sequência de semanas. A revisão mostra os exercícios com as metas das abordagens e um quadro semanal de séries previstas ou realmente registradas. Cores de abordagem são identificações; as cores de desempenho vêm das metas preservadas em cada sessão.

As fichas podem ser reutilizadas ou escritas na montagem. Nome e observações do exercício são compartilhados entre abordagens; quantidades, tipos de série e metas permanecem independentes. As faixas são configuradas pelo usuário, sem inferência pelo nome do estímulo. Os valores anotados no exemplo não são fabricados como histórico.

O contrato aceita a propriedade opcional guided. As sessões são materializadas como cópias independentes e validadas contra a montagem; a execução mantém o plano e a versão usados. Planejamentos antigos continuam compatíveis. O editor livre está em Mais opções → Criar planejamento avançado; mudanças individuais nas sessões ou na duração no modo avançado desvinculam a montagem guiada do novo rascunho.

## Novidades da versão 0.4.0

Em **Minha semana → Planejamento de ciclos**, o planejamento é uma camada temporal acima das fichas. O motor em `frontend/src/planning.ts` distribui sessões independentes, copia intervalos e permite ajustar cada ocorrência. Modelo e estímulo são identificações livres: não determinam automaticamente séries, faixas, cargas ou deload.

- Duração de 1 a 730 dias e até 500 sessões. Macro, meso, micro, fase e agrupamentos livres são opcionais; um microciclo não precisa ter sete dias. Períodos pais delimitam apenas a posição dos filhos.
- Contexto de objetivo, experiência, disponibilidade, prioridades e recuperação. Estratégias de progressão têm condições e ações e podem ser combinadas por exercício; sua aplicação continua manual.
- O editor por sessão permite variar exercícios, ordem, séries, repetições, carga, RIR/RPE, descanso em segundos e percentual de 1RM. Percentuais não são convertidos automaticamente para kg.
- Cada sessão iniciada conserva o plano resolvido e sua origem: identificador, versão e dia do planejamento. Alterações futuras não reescrevem esse registro.
- A distribuição por músculos principais usa apenas atribuições explícitas. Não infere músculos nem adequação do volume. Aquecimento, recuperação e desaquecimento são contabilizados separadamente.
- Contrato independente em `contracts/planning.schema.json`. Biblioteca local em `ritmo.planning.v1`, com versões, cópia anterior, importação revisada e proteção contra gravação concorrente. Rascunhos permanecem em memória ao trocar de tela; salve ou exporte antes de recarregar.
- O planejamento ainda não possui persistência PHP, sincronização ou IA. O PHP reconhece as novas métricas e protege a origem das sessões históricas no contrato de treino.

## Estrutura de treinos da versão 0.3.0

O painel **Meus treinos** permite criar, editar, duplicar, ordenar e importar fichas com blocos aninhados e etapas. Cada etapa tem suas métricas: repetições, carga, RIR, RPE, tempo em segundos, distância em metros, frequência cardíaca, potência, cadência e ritmo em segundos/km. Metas podem ser exatas, faixas, mínimos, máximos ou apenas registro. Os modelos de séries, top set/back-offs, circuitos, intervalos e rounds são exemplos editáveis, não prescrições personalizadas.

### Decisões de arquitetura

- O contrato versionado está em `contracts/training.schema.json`, validado por Ajv no Angular e Opis JSON Schema no PHP. Unidades ficam explícitas e são normalizadas por métrica.
- Blocos repetem sequências e podem conter outros blocos. O motor expande a ordem de execução, com limite de 4 níveis e 300 etapas por sessão para evitar crescimento acidental.
- Fichas são versionadas. Uma sessão recebe uma cópia da versão usada; editar a biblioteca não altera sessões em andamento ou históricas. O backend recusa reescrita de versões existentes.
- Resultados são separados das metas. Campos vazios, etapas não realizadas e metas opcionais ausentes não viram sucesso automaticamente.
- O fluxo antigo permanece compatível, sem migração destrutiva. É possível copiar a estrutura de uma sessão antiga para o editor; as anotações originais são preservadas.
- A biblioteca nova fica na chave local `ritmo.training.v2`; o histórico antigo usa sua chave original. Exportação e restauração da biblioteca exigem validação e confirmação. Uma alteração concorrente em outra aba bloqueia gravações silenciosas.
- A estrutura usa os mesmos princípios de etapas, duração, metas e repetições documentados no [Garmin FIT](https://developer.garmin.com/fit/articles/file-types/workout.html) e no [TrainingPeaks](https://help.trainingpeaks.com/hc/en-us/articles/235164967-Structured-Workout-Builder), sem implementar importação FIT ou integração com esses serviços.

### API e limites atuais

Os endpoints privados `GET/PUT /api/training` validam e armazenam a biblioteca do piloto, separados do histórico antigo, com controle de revisão. `POST /api/training/validate` valida uma ficha pelo mesmo contrato. A interface pública ainda salva localmente e não está conectada a esses endpoints. Não há conta multiusuário, sincronização em nuvem, cronômetro, sensores, geração por IA ou periodização automática. PHP 8.4 é necessário.

Para começar, abra **Meus treinos**, escolha uma estrutura ou crie uma ficha, revise as metas e salve. É possível iniciar pela biblioteca ou associar ao dia selecionado. Uma sessão antiga em andamento deve ser finalizada antes de iniciar outra. As sessões estruturadas são consultadas na própria biblioteca.

### Validação

Execute `npm run build`, `npm run test:domain` e `npm run test:ui` em `frontend`; em `backend`, execute `php vendor/phpunit/phpunit/phpunit`. Os testes de interface usam DOM isolado, sem dados reais e sem substituir inspeção visual em navegador.

## Novidades da versão 0.2.0

- Análises por regras fixas na revisão e no histórico, com mensagens curtas.
- Indicadores de séries confirmadas, volume e cumprimento das metas de repetições.
- Comparação com a sessão anterior compatível, sem tratar pendências como queda de desempenho.
- Cores com rótulos: verde para metas/aumento, âmbar para atenção, azul para comparação e cinza para contexto insuficiente.
- Registro de série extra e exportação JSON das análises para futura consulta por IA.
- Metas estruturadas validadas também na API PHP.

Registros antigos são preservados. Não são inventadas metas ou comparações quando faltam informações. Mais séries ou volume não significa automaticamente melhor treino. A IA real, a autenticação multiusuário e a sincronização da interface com o servidor continuam pendentes.

A tag v0.1.0 preserva a primeira entrega.

## Executar neste computador

Instale Node.js 24 com npm, PHP 8.4 e Composer. Antes de iniciar, instale as dependências:

```powershell
cd frontend
npm ci
cd ../backend
composer install
Copy-Item .env.example .env
php artisan key:generate
New-Item -ItemType File -Path database/database.sqlite -Force
php artisan migrate
cd ..
```

Para testar os endpoints privados de persistência, configure `RITMO_OWNER_TOKEN` no arquivo `backend/.env` com um token aleatório de pelo menos 32 caracteres. Não publique esse arquivo. O registro da interface funciona localmente no navegador nesta versão.

Abra dois terminais PowerShell nesta pasta:

```powershell
./start-backend.ps1
```

```powershell
./start-frontend.ps1
```

Acesse http://127.0.0.1:4200. A API responde em http://127.0.0.1:8000/api/health.
Os servidores só escutam neste computador; esse endereço não abre o aplicativo no iPhone.

## O que funciona

- Semana inicial com os compromissos discutidos, editável.
- Seleção da atividade e sessão de demonstração com duração escolhida.
- Sessão curta de musculação com três exercícios de exemplo.
- Carga, repetições e RIR por série; somente valores confirmados entram nos totais.
- Registro durante a execução, revisão final e edição posterior sem duplicar sessões.
- Retomada da sessão após recarregar, histórico local e exportação JSON.
- Perfil com objetivo, experiência, equipamentos e preferência de autonomia.
- Troca manual entre dias e desfazer a última troca.
- Layout responsivo para celular e computador.

## Limites desta entrega

Esta é uma base funcional local, não um serviço pronto para lançamento público. As fichas são demonstrações explícitas, não prescrições por IA. A escolha de duração reduz o exemplo de treino, não calcula uma prescrição personalizada nem mede o tempo executado.

O frontend salva no navegador, sem conta, sincronização ou importação de backup. Limpar o armazenamento do navegador remove os registros locais; exporte uma cópia. A API de persistência existe e foi testada, mas ainda não está ligada ao salvamento da interface. A conexão frontend/backend atual verifica o estado da geração de planos.

A IA não está conectada a um provedor; `/api/planning` responde 503 `AI_NOT_CONFIGURED`, sem inventar resultados nem enviar dados a terceiros. Não há cobrança por uso de IA nesta entrega.

PWA, cache offline, autenticação de usuários, implantação pública, dieta, geração de modalidades específicas, comparação longitudinal e reorganização automática ainda não estão implementados.

## API PHP

- `GET /api/health`: estado do serviço.
- `POST /api/planning`: estado explícito da integração pendente.
- `GET /api/state`: estado do piloto, protegido por bearer token.
- `PUT /api/state`: salva `{revision, state}`, protegido por bearer token. Retorna 409 em caso de revisão antiga para evitar sobrescrever alterações concorrentes.

`RITMO_OWNER_TOKEN` deve ter pelo menos 32 caracteres. A configuração local é ignorada pelo Git e não deve ser enviada ao repositório. Esse mecanismo atende um piloto privado de um proprietário, não autenticação multiusuário. A chave de um futuro provedor de IA deve existir exclusivamente no backend.

## Ambiente e banco

Neste computador foi usado PHP portátil 8.4, Laravel 13 e Angular 22; as versões resolvidas estão nos lockfiles. A pasta `tools` contém ferramentas locais ignoradas pelo Git.

Para outro computador, instale Node 24, npm, PHP 8.4 com as extensões exigidas pelo Composer e Composer. Execute `npm ci` em `frontend` e `composer install` em `backend`. Crie `.env` a partir de `.env.example`, gere `APP_KEY` com `php artisan key:generate`, configure o banco e o token e execute `php artisan migrate`.

O banco local e os testes usam SQLite para não exigir instalação de servidor. As migrations foram escritas com o Schema Builder do Laravel para uso com PostgreSQL, mas PostgreSQL ainda não foi executado aqui. Para adotá-lo, configure `DB_CONNECTION=pgsql`, `DB_HOST`, `DB_PORT`, `DB_DATABASE`, `DB_USERNAME`, `DB_PASSWORD` e a extensão `pdo_pgsql`; depois execute as migrations.

## Verificação

Frontend:

```text
npm run build
npm run test:domain
```

Backend:

```text
php vendor/phpunit/phpunit/phpunit
```

Os testes cobrem séries confirmadas, sessões incompletas, validação de números, proteção do histórico local, autorização da API, validação da semana e conflitos de gravação. Há configuração SQLite em memória exclusiva para testes.

## Próxima etapa

1. Conectar persistência da interface à API e criar autenticação individual.
2. Completar onboarding com disponibilidade, restrições e atividades externas.
3. Escolher provedor de IA e implementar geração estruturada, validação de regras, versões e desfazer.
4. Ampliar histórico e análises com informações suficientes para comparação.
5. Preparar PWA, PostgreSQL e hospedagem com suporte a PHP antes do teste no iPhone.
