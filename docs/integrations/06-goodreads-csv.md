# INT-06 — Importar Goodreads por CSV

Estado: Planejado. Esforço L. Sem API Goodreads no MVP.

## O que importa

Arquivo exportado pela própria pessoa: título, autor, ISBN, estante e avaliação pessoal, com mapeamento revisável. Não importa PDF, contas de seguidores ou posts. Não presumir que o Skoob tenha o mesmo formato ou uma API disponível.

## Fluxo

Meus livros → Importar biblioteca → selecionar CSV → mapear colunas → revisar correspondências, duplicatas e erros → confirmar → acompanhar resultado. O MVP deve aceitar até 500 linhas por operação, com limite de arquivo explícito; ajustar esse limite depois de medir processamento.

## Procedimento

1. Criar parser testado para CSV com aspas, vírgulas, quebras dentro de campos, UTF-8/BOM e ISBNs exportados como fórmulas. Nunca avaliar fórmula. Não dividir linhas com `split(',')`.
2. Separar parsing da execução. Produzir prévia sem gravar nada, com linha de origem e motivo de cada erro.
3. Resolver por ISBN/edição; título+autor só como sugestão para confirmação. Identificar duplicatas dentro do arquivo e no catálogo. Não usar `catalog-importer.js` diretamente: ele exige PDF.
4. Na confirmação, associar registros ao usuário autenticado. Criar apenas registros bibliográficos privados quando necessário, ou reutilizar livro existente permitido. Manter proveniência e hash de operação/linha para retries idempotentes.
5. Mapear read/to-read/currently-reading para estados existentes sem inventar página lida ou percentual intermediário. Avaliações importadas ficam privadas por padrão; não usar o endpoint de review pública automaticamente. Se não houver modelo privado adequado, propor/implementar tabela própria aditiva antes de guardar as notas.
6. Processar em lotes pequenos com relatório de sucesso, ignorados e falhas. Não apagar progresso/avaliação existente sem escolha explícita. Permitir tentar novamente só as falhas.

## Offline e aceite

Pode analisar o arquivo localmente, mas confirmar exige rede e permissões. Testar reenvio sem duplicação, importação entre contas, mesma obra/edições distintas e colunas ausentes. Não gerar XP, recompensas ou publicações pelo histórico importado. CSV é troca de arquivo, não sincronização contínua.

Referência inicial do fornecedor: https://www.goodreads.com/review/import
