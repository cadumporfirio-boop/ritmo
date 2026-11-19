# Ritmo — versão 0.4.1

Aplicação web para organizar treinos e registrar desempenho, com Angular + TypeScript e API em PHP/Laravel. Versão atual: 0.4.1.

![Interface do Ritmo](preview.png)

O projeto demonstra planejamento semanal, registro por série e revisão de sessões. A integração real com IA ainda não está ativa.

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
