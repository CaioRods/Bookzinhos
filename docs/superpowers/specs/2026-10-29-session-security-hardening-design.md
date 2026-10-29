# Segurança de sessão e endurecimento da aplicação

Data: 2026-10-29

## Objetivo

Impedir que alterações feitas pelo inspetor, por chamadas HTTP manuais ou por JavaScript injetado permitam assumir outra conta, obter dados privados ou executar ações administrativas. HTML, CSS e JavaScript públicos continuarão inspecionáveis, pois são enviados ao navegador; nenhuma autorização dependerá deles.

Também será removido o bloco editorial “Autor em destaque” da Home.

## Problemas atuais

- O servidor identifica o usuário pelo header `x-user-id`, controlado pelo cliente.
- Algumas contas antigas e contas iniciais podem ter senha em texto puro.
- A inicialização reafirma uma senha administrativa configurada a cada execução.
- O CORS aceita qualquer origem.
- Não há política central de conteúdo nem limites consistentes para tentativas de autenticação.
- O cliente mantém a identidade em `localStorage`, que deve servir apenas à apresentação, nunca à autorização.

## Autenticação

Será criada a tabela `auth_sessions` com token opaco, usuário, criação, expiração, última utilização e revogação. O token bruto será entregue uma única vez em cookie `HttpOnly`; o banco guardará somente seu hash SHA-256.

O cookie terá:

- `HttpOnly`;
- `Secure` em produção;
- `SameSite=Lax` quando frontend e API compartilham o mesmo site;
- duração limitada e renovação controlada;
- nome próprio do app, sem conter o usuário.

Login por senha e Google criará uma sessão. Logout revogará a sessão e apagará o cookie. Uma rota `/auth/session` devolverá somente o perfil público da conta autenticada.

## Compatibilidade e migração

Durante uma janela de transição, rotas públicas continuarão funcionando sem sessão. Rotas privadas aceitarão apenas sessão válida; `x-user-id` deixará de conceder identidade ou permissão.

Ao realizar login válido em uma conta cuja senha ainda esteja em texto puro, a senha será convertida imediatamente para `scrypt`. Contas iniciais não receberão mais senha fixa `1234`. A conta administrativa não terá sua senha sobrescrita durante a inicialização.

Sessões existentes no `localStorage` não serão consideradas autenticadas após a migração; o usuário precisará entrar novamente. Isso é intencional para eliminar identidades falsificáveis.

## Autorização

Um middleware central resolverá a sessão e preencherá o usuário autenticado. As verificações serão divididas em:

- sessão opcional para rotas públicas personalizadas;
- sessão obrigatória para perfil, biblioteca pessoal, chat, publicações e uploads;
- administrador obrigatório para curadoria, usuários, XP, selos, temas globais e alterações administrativas.

O nome do usuário usado em gravações virá exclusivamente da sessão. Valores `username`, `actor`, `owner` ou equivalentes enviados no corpo serão ignorados para autorização.

## Proteções HTTP

O servidor aplicará:

- CORS restrito às origens de `FRONTEND_ORIGINS`, com credenciais;
- Content Security Policy permitindo scripts apenas do próprio app e, quando configurado, do login Google;
- bloqueio de frames externos;
- `X-Content-Type-Options: nosniff`;
- `Referrer-Policy` restritiva;
- `Permissions-Policy` com recursos não utilizados desativados;
- limites menores para JSON e validação dos tipos de upload;
- ausência de detalhes internos em erros de produção.

A CSP permitirá imagens do storage configurado e estilos inline já utilizados pelo tema, mas bloqueará scripts arbitrários e conexões para destinos não autorizados.

## Limites de tentativa

Um limitador em memória, com chaves por IP e identidade normalizada, protegerá:

- login;
- envio e validação de código;
- cadastro e redefinição de senha;
- uploads e mutações administrativas.

Ele devolverá `429` e `Retry-After`. Em implantação com várias instâncias, o contrato permitirá trocar o armazenamento por Redis sem mudar as rotas.

## Cliente

Todas as chamadas usarão `credentials: "include"`. O cliente deixará de enviar `x-user-id`. O perfil salvo localmente será apenas cache visual e será validado por `/auth/session` ao iniciar.

Quando a sessão expirar, ações privadas abrirão a autenticação novamente. Dados de senha ou token nunca serão gravados em `localStorage`, logs ou respostas de perfil.

## Home

O bloco condicional “Autor em destaque” será removido. A área editorial continuará exibindo somente livro ou série em destaque, sem criar uma coleção automática por autor.

## Testes e aceite

- Alterar `x-user-id` não muda a identidade autenticada.
- Usuário comum recebe `403` em rotas administrativas mesmo falsificando headers ou corpos.
- Cookie não fica disponível ao JavaScript e é removido no logout.
- Sessão expirada recebe `401`.
- Senha legada é migrada para `scrypt` após login.
- Login excessivo recebe `429`.
- CORS rejeita origem não autorizada.
- Cabeçalhos de segurança e CSP estão presentes.
- APIs públicas não expõem senha, token, e-mail privado ou XP privado.
- Fluxos de login, cadastro, chat, upload, perfil e admin continuam funcionando.
- “Autor em destaque” não aparece nem é gerado pela Home.

## Implantação e reversão

A tabela de sessões é aditiva. A implantação deve configurar `FRONTEND_ORIGINS`, `SESSION_COOKIE_SECURE` e os domínios de storage permitidos. A reversão do código não exige apagar a tabela, mas não deve reativar confiança em `x-user-id` em produção. Sessões podem ser revogadas em massa sem afetar contas ou conteúdo.
