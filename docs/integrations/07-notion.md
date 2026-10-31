# INT-07 — Exportar leituras para o Notion

Estado: Planejado. S no arquivo Markdown; L na conexão OAuth.

## O que exporta

Livro/Booklist escolhidos e, somente quando selecionadas, anotações privadas e avaliação pessoal. O destino é o espaço do próprio usuário; nada é enviado automaticamente ao conectar uma conta.

## Etapa A: entrega rápida sem integração de conta

1. Criar gerador de `.md` com título, autor, link, seções e listas a partir de dados já disponíveis. Escapar conteúdo conforme o contexto e remover qualquer segredo.
2. Oferecer Exportar Markdown no livro/Booklist/diário, com prévia e seleção das informações incluídas.
3. Baixar o arquivo e explicar como importá-lo no Notion. Pode funcionar offline com dados locais. **Não chamar isso de sincronização ou conta Notion conectada.**

## Etapa B: integração direta

1. Conferir API e fluxo OAuth atuais. Configurar client ID/secret e callback HTTPS no servidor, com state de uso único vinculado à sessão.
2. Criar vínculo privado por usuário/workspace e guardar tokens criptografados com chave de ambiente; não guardar token na tabela de preferências públicas nem no localStorage.
3. A pessoa escolhe uma página autorizada. Mostrar prévia e conteúdo escolhido antes de exportar. Usar a estrutura atual de páginas/blocos; não presumir formatos antigos de databases/data sources.
4. Criar a página e guardar mapeamento origem/destino para atualizar por ação explícita, sem duplicar a cada retry. Não habilitar sincronização bidirecional no MVP.
5. Oferecer Desconectar e tratar revogação, página removida, limite de blocos, 429 e falha parcial sem indicar sucesso completo.

## Aceite

Testar geração manual, isolamento de token entre contas, state inválido, destino sem permissão, retry sem duplicação e exclusão de campos privados não selecionados. Exportação direta exige internet; não enfileirar credenciais/ações Notion na fila genérica de leitura. Conferir as condições comerciais atuais antes de prometer ausência de custos.

Referência: https://developers.notion.com/
