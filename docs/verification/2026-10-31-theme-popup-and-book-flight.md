# Temas, identidade e abertura de livros

- Perfil → Alterar cenário abre um diálogo. A primeira etapa mostra capas, títulos e quantidade de temas; a segunda mostra os banners e o nome abaixo de cada imagem. Temas sem livro ficam em Temas gerais. Criar, editar, remover/restaurar, quatro vagas pessoais e permissões existentes foram preservados.
- O menu da conta usa o nome de exibição atualizado. Autores de posts, resenhas e atividades também resolvem o nome atual, mantendo username como identificador de sessão, links, relações e @. Eventos de sessão/storage atualizam a interface. Uma resposta parcial da sessão não apaga o nome salvo.
- Capas saem da biblioteca em uma camada própria, vão ao centro com desfoque/ondas e aterrissam nas dimensões medidas da capa de detalhes. A animação aguarda o destino, tem limite de espera e respeita redução de movimento. Links de capas editoriais, sagas e relacionados usam a mesma transição.
- Detalhes de livros com PDF têm Baixar PDF, além do menu de ações já existente. Requer conta autenticada.
- Botão direito em banners de perfil, temas, livro e Home abre Salvar banner. O download preserva o arquivo original; não é uma captura reduzida do elemento. O banner composto da biblioteca oferece sua arte de fundo original. Temas nativos armazenados em atlas mantêm o arquivo de origem do atlas.
- Seleção, cópia, recorte e arraste são bloqueados no conteúdo. Campos editáveis continuam funcionando. Menus de contexto próprios e ações explícitas de copiar/compartilhar continuam disponíveis. Isso é comportamento de interface: não impede screenshots, ferramentas do navegador ou acesso direto a arquivos públicos.

## Validação

Testes unitários: menu acompanha nome editado; respostas parciais de sessão preservam nome; autores existentes atualizam sem trocar identificador; bloqueios respeitam campos e removem listeners; popup abre sob demanda, agrupa por livro, seleciona tema e deixa nomes fora do banner.

Playwright/Chromium com API interceptada e dados fictícios: abertura do popup, contagem e seleção, 390 px sem overflow, edição de nome refletida no menu, download WebP original e PDF, transição até o retângulo real da capa (diferença inferior a 2 px), sem erros de execução. O teste não grava no banco de produção.

Deploy: alteração apenas no frontend; nenhuma migração adicional da API ou do banco é necessária.
