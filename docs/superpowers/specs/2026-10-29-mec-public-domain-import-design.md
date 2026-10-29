# Importação curada do MEC Livros

## Objetivo

Importar para o myBooks um lote curado de obras conhecidas e legalmente distribuídas pelo MEC Livros ou pelo Portal Domínio Público. Cada cadastro deve incluir PDF, título, autor, gênero e, quando a fonte oficial fornecer, descrição. Registros sem PDF válido não entram no catálogo.

## Escopo do primeiro lote

O importador prioriza clássicos reconhecidos e procurados, especialmente literatura brasileira e traduções comprovadamente livres. Exemplos prioritários incluem obras de Machado de Assis, José de Alencar, Aluísio Azevedo, Lima Barreto, Castro Alves, Gonçalves Dias, Júlia Lopes de Almeida, Euclides da Cunha e outros autores em domínio público presentes no acervo oficial.

O lote exclui:

- documentos técnicos, acadêmicos ou administrativos;
- registros sem autoria ou título bibliograficamente confiáveis;
- duplicatas de livros já cadastrados;
- obras contemporâneas sujeitas a empréstimo ou login Gov.br;
- PDFs cuja licença, origem ou integridade não possa ser confirmada;
- traduções ainda protegidas, mesmo quando a obra original estiver em domínio público.

## Fonte e conformidade

As únicas origens aceitas inicialmente são:

- `https://meclivros.mec.gov.br`;
- `https://dominiopublico.mec.gov.br`.

O importador registra a URL da fonte, o tipo de licença e a data de coleta. Um arquivo só é copiado para o armazenamento do myBooks quando houver download oficial direto e autorização compatível com redistribuição. Itens de empréstimo digital controlado permanecem fora do myBooks.

## Dados armazenados

Cada obra importada contém:

- identificador interno estável;
- título;
- autor;
- gênero normalizado conforme os gêneros do myBooks;
- descrição, quando publicada pela fonte oficial;
- URL original e origem do acervo;
- PDF armazenado no Supabase;
- capa, quando a fonte oficial permitir o download;
- hash SHA-256 do PDF para detectar duplicatas;
- situação da licença;
- marcador interno de popularidade.

## IPR

O marcador invisível será chamado **IPR — Índice de Popularidade Relativa**.

- intervalo: `0–100`;
- livros já existentes: valor inicial entre `80–100`;
- obras públicas importadas: valor inicial entre `10–29`;
- o campo não aparece na interface nem nas respostas públicas da API;
- futuramente poderá influenciar recomendações e ordenação;
- o cálculo inicial considera destaque no MEC, reconhecimento cultural e sinais internos do myBooks;
- alterações automáticas futuras deverão ser graduais e auditáveis.

## Arquitetura

### Migração de banco

A tabela `books` recebe campos internos para IPR, origem, URL de origem, licença e hash do arquivo. A migração é aditiva e repetível. Livros existentes recebem IPR entre 80 e 100 por uma regra determinística baseada em aberturas, salvamentos, leituras e avaliações, sem alterar dados visíveis.

### Catálogo curado

Um manifesto versionado lista os títulos aprovados para tentativa de importação. Isso impede que uma varredura ampla cadastre materiais irrelevantes e permite revisar individualmente título, autor, gênero e licença.

### Importador

O importador executa as seguintes etapas:

1. consulta o manifesto curado;
2. resolve apenas páginas oficiais permitidas;
3. confirma metadados e disponibilidade de PDF;
4. valida tipo MIME, assinatura `%PDF`, tamanho e hash;
5. rejeita duplicatas por título/autor e por hash;
6. envia PDF e capa autorizada ao Supabase;
7. cria o registro somente após o upload completo;
8. registra sucesso, descarte ou erro para retomada posterior.

Falhas em uma obra não interrompem as demais. Reexecutar o processo não duplica livros nem arquivos.

## Segurança e operação

- URLs redirecionadas precisam continuar dentro da lista oficial permitida.
- O download possui limites de tamanho, tempo e quantidade por execução.
- Conteúdo HTML disfarçado de PDF é rejeitado.
- Credenciais do Supabase permanecem somente no servidor.
- O importador roda como comando administrativo, não como rota pública.
- O relatório final informa tentativas, importações, duplicatas, itens sem PDF e falhas.

## Experiência no aplicativo

Os livros importados aparecem na biblioteca como os demais, com indicação normal de título, autor e gênero. O IPR, a origem técnica e o hash permanecem invisíveis. Obras sem capa usam o tratamento visual padrão existente. Nenhum livro é publicado antes de seu PDF terminar de ser validado e armazenado.

## Verificação

- testes da migração e de repetição segura;
- testes de normalização de metadados e gêneros;
- testes de bloqueio de domínios externos e arquivos inválidos;
- teste de duplicidade por metadados e hash;
- execução em modo de simulação antes da produção;
- conferência de uma amostra de PDFs importados;
- comparação da contagem e do relatório final com o banco.

## Critérios de conclusão

O primeiro lote termina quando todas as obras do manifesto tiverem um resultado registrado. Somente registros com PDF oficial válido ficam publicados. O sistema não apresenta duplicatas, não expõe o IPR e pode retomar a importação sem repetir trabalho.
