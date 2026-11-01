# INT-04 — Google Books: busca e preenchimento por ISBN

Estado: Implementado parcialmente — mock; validação com provedor pendente.

Busca autenticada por título/autor ou ISBN, prévia por campo e origem persistida implementadas em `server/integrations/book-metadata.js` e `BookMetadataLookup.tsx`. A classificação automática exige correspondência conservadora e mantém a edição manual. Chave opcional `GOOGLE_BOOKS_API_KEY` somente no servidor; timeout, cache e limite por conta. Testes com mocks e navegador passaram. Consultas reais não foram validadas neste ambiente (rede bloqueada). Câmera, importação de capas, idiomas e preenchimento de páginas pela API continuam pendentes.

## O que importa

Título, autores, descrição, editora, ano, páginas, idiomas, identificadores e capa da edição escolhida. Não importa PDF, direito de distribuição, progresso nem avaliações da comunidade.

## Procedimento

1. Definir um DTO pequeno de metadados externo, reutilizável pela INT-05. Investigar migração aditiva para ISBN-10/ISBN-13 e referências externas; não há ISBN no `Book` revisado. Normalizar e validar os dígitos verificadores. Não impor unicidade global só por título.
2. Implementar adaptador em `server/integrations/google-books.js` e endpoint de busca, por exemplo `GET /integrations/books/search?source=google&q=...`. O servidor monta a URL do provedor, aplica timeout, cache e limites. Não aceitar URL remota arbitrária.
3. Consultar ISBN quando informado; usar título/autor como alternativa. Configurar `GOOGLE_BOOKS_API_KEY` no servidor se exigida pela configuração vigente; não colocá-la no bundle. Conferir documentação/cotas atuais.
4. Em Upload/edição, adicionar Buscar informações. Exibir resultados e edições, permitir selecionar e mostrar quais campos serão preenchidos. Não sobrescrever alterações manuais silenciosamente.
5. Salvar pelos fluxos existentes, com suas permissões. Descrições devem virar texto seguro; capas HTTPS precisam respeitar a política de origem e ter fallback. Não baixar ou publicar obras completas.

## Offline e falhas

Busca externa precisa de internet; dados confirmados ficam no cadastro normal. Tratar vazio, timeout, 429, chave inválida, capa ausente e ISBN sem correspondência. Uma falha não deve impedir cadastro manual.

## Aceite

Mocks de múltiplas edições, campos incompletos, descrição HTML e quotas; teste de ISBN e permissões. Prévia e escolha no celular/PC. Só depois implementar leitura pela câmera: `BarcodeDetector` se disponível, fallback gratuito e entrada manual sempre acessível.

Referência: https://developers.google.com/books/docs/v1/using
