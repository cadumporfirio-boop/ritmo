# Operação do beta: dados e exclusão

Procedimento técnico. Não substitui política de privacidade ou validação jurídica. O fornecedor, contato público e política para menores continuam pendentes por decisão do responsável.

## Atendimento diário

O usuário abre Meu perfil → Seus dados, exporta dados ou registra acesso, correção, informação ou ajuda com exclusão. A tabela `public.ritmo_privacy_requests` registra protocolo, titular autenticado, mensagem e resposta. O próprio usuário só pode inserir os campos id/kind/message e ler seus pedidos. Limite de cinco registros por 24 horas. Não há envio automático de e-mail; o dono deve conferir diariamente o Table Editor, filtrar status=pending e responder usando acesso administrativo. Nunca solicitar senha, documentos ou detalhes clínicos no texto livre. Para corrigir um registro, conferir a identidade, o pedido, a revisão do snapshot e efeitos na próxima sincronização; não alterar silenciosamente uma sessão histórica.

Registrar response, status=answered e answered_at. O usuário consulta a resposta na mesma área. A confirmação de envio incerto reaproveita o protocolo; não criar novas solicitações ao repetir uma tentativa. A exportação por conta inclui dados do aparelho, cópia online e protocolos; não inclui senha ou tokens. Pedidos formais de acesso podem exigir outros registros administrativos; conferir provedores e os prazos legais aplicáveis com o responsável.

## Exclusão pelo titular

1. Recomendar exportação antes da exclusão. E-mail, senha, EXCLUIR e reconhecimento explícito são exigidos na interface.
2. Reautenticar com senha pelo Supabase Auth. A função `delete-account` exige JWT, consulta getUser, confere e-mail e login há no máximo cinco minutos. Nenhum id de usuário vindo do corpo é aceito.
3. Registrar hash SHA-256 do UUID e protocolo em `ritmo_erasure_log`, acessível somente ao servidor. Não registra e-mail ou dados de treino. É pseudonimização, não anonimização.
4. Revogar sessões e usar Auth Admin deleteUser com exclusão física. As FKs removem snapshot e solicitações. JWTs já emitidos podem existir até expirar, mas não há mais linha de conta/snapshot a ler; novas inserções dependem da FK de usuário existente. A função sempre valida getUser.
5. Remover todas as chaves `ritmo.account.<id>.*`, incluindo .previous e before-cloud, e a sessão do projeto neste navegador. Outras abas recebem aviso. Dados antigos sem conta só são apagados quando a opção separada é marcada. Outras contas e a demonstração não são tocadas.
6. Baixar comprovante de exclusão. Se a rede falhar após envio, não afirmar que apagou: verificar acesso/estado antes de nova tentativa. Ledger pendente exige revisão administrativa.

## Backups e restauração: procedimento obrigatório

Não prometer exclusão imediata de backups imutáveis ou logs de terceiros. Conferir no painel do Supabase quais backups existem no plano, retenção, suporte e contrato; essa informação ainda não foi confirmada. Não declarar prazo inventado na interface.

Antes de qualquer restauração, exportar `ritmo_erasure_log` atual para um local administrativo protegido fora do conjunto que será restaurado. Nunca colocar essa exportação no Git. Restringir acessos e registrar quem executou o procedimento. Suspender a aplicação durante restauração. Depois de restaurar, reaplicar o ledger mais recente e eliminar novamente usuários cujo hash do UUID esteja nele; revalidar snapshots e solicitações em cascata. Conferir entradas pending antes de liberar acesso. Não reabrir o serviço sem essa checagem. Há teste de cascata em tests/privacy-isolation.sql; não executar exclusões em usuários reais como teste.

O hash é calculado com SHA-256 sobre o UUID em texto UTF-8, equivalente a `encode(sha256(convert_to(id::text,'UTF8')),'hex')`. A lista de supressão não possui expiração automática nesta etapa para não permitir ressurreição após restauração. O responsável deve definir retenção mínima compatível com a janela real de backups e obrigações legais e então autorizar a rotina de descarte; não manter indefinidamente por conveniência. Pedidos respondidos também precisam de prazo de retenção definido antes de ampliar o beta.

Arquivos baixados, cópias antigas sem conta, navegadores offline em outros aparelhos, histórico da área de transferência e chats externos não são controlados remotamente. Orientar o titular a apagá-los. Se um provedor de IA for integrado, incluir seu procedimento de exclusão no inventário antes de ativá-lo. Não atribuir à simples remoção do banco ativo uma conformidade LGPD completa.

## Limites atuais

O canal público para quem perdeu acesso depende de e-mail a definir pelo dono. Nenhum endereço foi inventado. Solicitações sem login ainda não estão disponíveis. Política e termos gerais permanecem fora deste escopo; não foram publicados como se estivessem aprovados juridicamente.
