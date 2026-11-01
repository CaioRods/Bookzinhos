# INT-05 — Open Library como fonte complementar

Estado: Implementado parcialmente — mock; validação com provedor pendente.

Busca autenticada e consulta de descrição/gêneros de obras implementadas no adaptador compartilhado `server/integrations/book-metadata.js`, com prévia e fonte persistida. A busca automática usa esta fonte como alternativa ao Google. Resultados são identificados como obras; não se inferem ISBN, editora, ano ou páginas a partir de edições misturadas. Seleção específica de edição e capas continuam pendentes. Testes com mocks e navegador passaram; consultas reais não foram validadas neste ambiente (rede bloqueada).

## O que importa

Informações bibliográficas de obra/edição e capa disponível. Não importa empréstimos, arquivos protegidos ou a estante pessoal de uma conta Open Library.

## Procedimento

1. Se INT-04 não estiver pronta, implementar primeiro o DTO neutro de metadados e a prévia, sem criar outra tela paralela de cadastro.
2. Criar adaptador do servidor para busca por ISBN/título/autor e consulta de edição. Identificar claramente work, edition e ISBN: uma obra pode ter várias edições.
3. Usar campos de edição para páginas/editora/idioma quando existirem. Não misturar capa de uma edição com ISBN de outra sem sinalizar a escolha.
4. Acrescentar Open Library ao seletor de origem e uma alternativa explícita quando a primeira fonte não encontrar resultado. Não consultar ambos os provedores a cada tecla; usar debounce, cancelamento, cache e paginação.
5. Registrar identificador/URL de origem junto dos metadados confirmados. Configurar o cliente conforme as políticas atuais, incluindo identificação quando solicitada.

## Dados e offline

Reutilizar campos e referências externas da INT-04; manter nulo quando desconhecido. Sem chave paga presumida, mas respeitar cotas/regras atuais. Busca precisa de conexão; livros já cadastrados continuam no fluxo offline existente. Erro externo não bloqueia cadastro manual.

## Aceite

Testar edição sem capa, ISBN inválido, vários autores, obra com várias edições, ausência de páginas e timeout. Garantir que o usuário revisa os dados e que nenhuma ação baixa automaticamente o texto da obra.

Referências: https://openlibrary.org/developers/api e https://openlibrary.org/dev/docs/api/covers
