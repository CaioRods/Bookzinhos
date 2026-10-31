# INT-08 — Google Agenda com conta conectada

Estado: Planejado. Esforço L. A alternativa rápida é a INT-01.

## O que faz

Cria ou atualiza eventos de leitura na agenda escolhida pelo usuário. Não importa todos os compromissos nem monitora a agenda pessoal no MVP. O login Google existente no myBooks **não concede automaticamente acesso ao Google Agenda**.

## Procedimento

1. Reutilizar o formulário e a validação de eventos da INT-01. Validar timezone, início e fim antes de enviar.
2. Configurar aplicação OAuth, tela de consentimento e redirect URI. Selecionar o escopo mínimo adequado, conferir exigências atuais de verificação e não ampliar o login existente silenciosamente.
3. Implementar conexão/callback no servidor com state de uso único vinculado à sessão. Guardar refresh/access tokens criptografados por conta; renovar quando necessário e permitir desconexão.
4. Listar apenas o necessário para a pessoa escolher um calendário autorizado. Mostrar a agenda de destino na confirmação de cada evento.
5. Criar mapeamento privado entre evento local/chave de operação e ID retornado. Em retries, consultar/usar o ID determinístico permitido pelo provedor em vez de criar duplicatas.
6. Separar Atualizar evento de Excluir evento. Não remover compromissos quando alguém excluir um livro ou uma Booklist; exigir uma ação específica sobre o evento.

## Offline e aceite

Criar/atualizar na agenda exige conexão. Continuar oferecendo ICS como alternativa independente, sem dizer que é sincronização. Tratar token revogado, escopo insuficiente, agenda removida e conflito. Testar com mocks e uma agenda de teste quando autorizada, nunca alterando compromissos reais automaticamente.

Confirmar cotas e condições atuais: ausência de cobrança da API não elimina eventuais custos da infraestrutura ou de verificação/configuração.

Referências: https://developers.google.com/calendar/api e https://developers.google.com/identity/protocols/oauth2/web-server
