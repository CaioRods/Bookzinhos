# Anotações e cadernos

O endereço `/notes` substitui o diário por cadernos privados. Notas antigas continuam na tabela original e são importadas de forma idempotente para **Anotações anteriores**. Snapshots antigos disponíveis no aparelho também podem ser recuperados offline.

## Conteúdo e interface

- Capa com cor/ícone vetorial ou foto recortada na proporção 520 × 720, usando a geometria compartilhada do editor de recortes.
- A capa permite posicionar e dimensionar título, descrição e ícone, com cores individuais e sem painel sobre a imagem.
- Folhas 800 × 1100, lisas, pautadas ou de pergaminho. A folha aberta e as miniaturas visíveis usam o mesmo desenho; miniaturas fora da tela são descarregadas. Número e título aparecem acima de cada miniatura.
- Texto estruturado, sem HTML: fonte, tamanho, cor, negrito, itálico, sublinhado e alinhamento. Traços SVG com caneta, marca-texto, borracha, desfazer/refazer e rejeição de toque enquanto a caneta está ativa.
- Imagens comprimidas no aparelho, com posicionamento e redimensionamento. A importação de livros renderiza uma página por vez e preserva livro, página e retângulo de origem. O toque prolongado abre uma confirmação antes de navegar para `/read/:id?page=N&clip=...`.
- A exportação gera PDF no aparelho, mantendo texto e traços vetoriais, transparência de imagens e seleção de páginas/capa. Processa páginas sequencialmente e carrega apenas as fontes necessárias.

## Offline e sincronização

Os documentos ficam no IndexedDB já existente, dentro de `<conta>::notebook::`. Capa, folha, resumo, índice e fila têm registros separados. A fila guarda somente identificadores; imagens e desenhos de folhas limpas não são carregados para contar pendências ou listar páginas.

A gravação de folha/resumo/fila é atômica. A sincronização envia capas antes das folhas, confirma revisões e preserva qualquer edição feita durante uma requisição anterior. Exclusões usam marcações locais e tombstones no servidor para impedir que uma edição offline atrasada recrie conteúdo excluído. Uma revisão conflitante nunca substitui silenciosamente outra; a cópia local fica disponível, com erro explícito de sincronização e exportação em PDF.

Criação, edição, desenho, anexos do aparelho, exclusão e exportação funcionam offline. A importação oferece **somente livros instalados** quando offline, usando os arquivos privados do dispositivo. A ação **Instalar caderno offline** baixa todas as folhas de um caderno existente; páginas criadas no próprio aparelho já ficam locais. Aplicativo, bibliotecas de PDF, workers e fontes fazem parte do precache do service worker.

Limites: fotos de entrada de até 15 MB, comprimidas no aparelho; documento de folha de até 3,5 milhões de caracteres JSON; até 5.000 elementos e 100.000 pontos por folha. Os erros preservam o conteúdo em edição e a exportação pode resgatar a folha em memória caso a gravação local falhe.

## Permissões e compartilhamento

As rotas `/notebooks` e `/notebook-shares` resolvem a identidade exclusivamente pela sessão do servidor. O cabeçalho `X-Notebook-Account` somente verifica que a conta não mudou durante o envio.

Compartilhar exige conexão e uma ação explícita com destinatário e escopo. O servidor cria a permissão e a mensagem do chat. Compartilhar uma página não concede acesso às demais; compartilhar o caderno inclui suas páginas. O destinatário tem somente leitura e pode instalar/exportar o conteúdo autorizado. Downloads já recebidos permanecem no aparelho.

Documentos privados não entram no cache HTTP público do service worker. Imagens de anotações são dados internos do documento, não uploads publicamente endereçáveis. Compartilhamentos armazenados para leitura offline são separados por conta.

## Verificação

Testes em `server/tests/notebooks.test.js`, `frontend/src/app/lib/notebooks/*.test.ts` e `frontend/src/app/components/notebooks/PageCanvas.test.tsx` cobrem permissões, importação, revisões, exclusões atrasadas, gravação offline, isolamento entre contas, entrada de texto, ordenação por leitura recente e PDF vetorial. A verificação de navegador usa contas, PDFs e SQLite temporários; nunca o banco de produção.

## Controles do ateliê

Ctrl+rolagem aproxima a folha sem alterar o zoom do navegador. A mão move a câmera; a lateral do aplicativo fica reduzida enquanto o caderno está aberto. A borracha recorta apenas o trecho tocado e a caneta suaviza curvas. Ctrl+Z desfaz, Ctrl+Y refaz; Delete e Backspace removem o elemento selecionado, preservando a edição nativa de texto. As páginas podem ser reorganizadas pelo arraste da miniatura ou pela alça (com suporte às setas do teclado).

O ateliê ocupa a altura disponível da tela, sem navegação inferior sobre a folha. A lista de páginas começa recolhida e abre pelo botão no topo (sobreposta em celulares). Nome do caderno e título da folha ficam na mesma barra; ações secundárias ficam no menu de três pontos e ferramentas usam rolagem horizontal quando necessário.
