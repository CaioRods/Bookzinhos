# INT-11 — Gutenberg/Gutendex: descoberta e catálogo permitido

Estado: Planejado. Esforço L na importação; começar apenas pela busca.

## O que importa

Busca obras, autores, idiomas, identificadores, links e formatos disponíveis. Importar um arquivo completo depende da análise da obra/edição e da permissão para distribuição no país atendido. A indicação de domínio público nos EUA não basta para concluir domínio público no Brasil.

## Procedimento

1. Criar adaptador Gutendex com consulta por título/autor/idioma, paginação, timeout e cache. Mostrar fonte e formatos reais. Não anunciar que todo resultado tem PDF.
2. Entregar primeiro a descoberta e um link de origem. Para importação, usar tela editorial do admin com prévia e status de direitos, não uma importação em massa automática.
3. Reutilizar `server/catalog-source.js`, `catalog-manifest.js`, `catalog-schema.js` e `catalog-importer.js` onde compatível. Registrar origem, edição e análise; não sobrescrever importações MEC.
4. O leitor atual suporta PDF e páginas de texto, não EPUB nativo. Não importar EPUB e fingir que ele é legível. Aceitar inicialmente PDF permitido e validado; TXT/HTML precisam de adaptador seguro para páginas; EPUB requer projeto separado de leitor/conversão e avaliação operacional.
5. Restringir hosts/redirects permitidos, tamanho, timeout e tipo real do arquivo. Calcular hash, deduplicar por fonte/edição/hash e preservar arquivos preexistentes em falhas de transação.
6. Registrar cada operação e permitir dry-run, lotes pequenos e retry sem duplicação. Só depois de completar a importação o livro aparece no catálogo. Instalação offline pelo leitor segue o fluxo normal já existente.

## Aceite

Testar resultado sem PDF, arquivo inválido, fonte não permitida, duplicata, cleanup seguro e acesso de não-admin. Não criar XP por importação. Confirmar armazenamento remoto adequado na hospedagem serverless e relatório da origem/licença. Testes não baixam/publicam um catálogo real de produção.

Referências: https://gutendex.com/ e https://www.gutenberg.org/policy/permission.html
