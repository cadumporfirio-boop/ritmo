# Supabase do Ritmo

## Implantação gratuita

Projeto: Ritmo, região sa-east-1, ref ronghntorgipesxvmybz. Nenhum recurso pago, branch de banco, IA paga ou domínio personalizado é necessário para esta versão.

Configuração pública: frontend/public/supabase-config.json (URL + publishable key). Não usar senha, service_role, secret key ou access token.

No Supabase Auth → URL Configuration, usar Site URL e Redirect URL https://cadumporfirio-boop.github.io/ritmo/.

## Banco e segurança

ritmo_snapshots guarda uma cópia dos dados salvos por conta: perfil, rotina, histórico legado, fichas, sessões, planejamentos e ciclo ativo. Uma linha por usuário, chave primária user_id, RLS de leitura por auth.uid(). Sem acesso anônimo ou escrita direta por clientes.

A função pública ritmo_save_snapshot usa SECURITY INVOKER e delega a uma função privada com proprietário derivado do JWT. Compara a revisão esperada e grava atomicamente; revisão antiga gera conflito 40001. A função privada tem search_path vazio, nomes qualificados e execução revogada de PUBLIC/anon. O esquema ritmo_private não deve ser exposto na Data API.

As migrações correspondem ao histórico aplicado no projeto. tests/owner-isolation.sql testa isolamento entre duas contas fictícias, nega acesso anônimo/escrita direta e exige erro para revisão antiga. Os dados de teste são revertidos ao final.

## Cadastro e e-mail

Para o beta pessoal, o e-mail padrão do Supabase só envia confirmações aos membros da organização e tem limite reduzido. Não desative a confirmação de e-mail como atalho. Para abrir cadastro a outras pessoas, configurar SMTP próprio ou um provedor OAuth antes de divulgar.

Referência: https://supabase.com/docs/guides/auth/auth-smtp

## Sincronização e recuperação

Sem conta, chaves locais antigas são preservadas. Com conta, dados usam ritmo.account.<userId>.<key>. A escolha do espaço é por aba em sessionStorage. Outra conta não recebe os dados anteriores.

Somente dados salvos são sincronizados; rascunhos não fazem parte da cópia online. O cliente mantém a última cópia confirmada para distinguir edição local, atualização online e conflito. Conflitos não são resolvidos por último escritor silencioso.

Instalar cópia online salva a cópia anterior em ritmo.before-cloud.v1 dentro do espaço da conta. Os dados sem conta permanecem separados. O backup completo é exportável; restauração administrativa/mesclagem ainda não têm assistente próprio.

Sem service worker nesta etapa: a página deve estar aberta para registrar sem conexão. O projeto gratuito pode pausar por inatividade. Manter cópias exportadas.

## Validação

Testes locais usam armazenamento isolado e Supabase simulado. Testes SQL foram executados no projeto e revertidos. A validação com e-mail real deve ser concluída pelo dono no app, sem compartilhar senha ou código de confirmação.
