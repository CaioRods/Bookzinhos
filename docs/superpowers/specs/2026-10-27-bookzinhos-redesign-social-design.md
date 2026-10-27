# Bookzinhos: redesign imersivo, sagas e comunidade social

## Objetivo

Transformar o Bookzinhos em uma biblioteca social literária com aparência de aplicativo nativo. A experiência deve unir personalização visual, organização de coleções e interação comunitária sem perder os livros, usuários, avaliações, posts ou configurações existentes.

O resultado será entregue como uma única evolução full-stack, embora a implementação seja dividida internamente em etapas verificáveis.

## Princípios do produto

- A imagem escolhida pelo usuário é a origem da identidade visual, não apenas uma decoração.
- O conteúdo deve continuar legível independentemente da luminosidade ou saturação da imagem.
- A página de um livro deve parecer editorial e focada no livro, não um painel de cartões.
- Saga é uma estrutura de catálogo pesquisável, e não texto duplicado em cada livro.
- A comunidade deve funcionar como rede social: publicar, conversar, reagir, republicar e compartilhar.
- Desktop, celular, teclado e toque devem oferecer os mesmos recursos essenciais.
- Migrações precisam preservar dados e ser seguras para execução repetida.

## Direção visual

### Janela do aplicativo

No desktop, toda a interface ficará dentro de uma janela com margem externa, cantos contínuos e recorte real. O elemento da janela controlará o `overflow`, impedindo que a página atravesse a curva inferior da sidebar. A altura será limitada ao viewport e somente as áreas internas apropriadas rolarão.

O espaço externo usará a mesma imagem ativa da sidebar, ampliada, escurecida e desfocada. Assim, o ambiente parecerá uma continuação da janela. A composição terá uma camada tonal para preservar contraste e reduzir ruído.

No celular, a janela ocupará o viewport. A identidade dinâmica continuará presente no cabeçalho, nos banners e na navegação inferior, sem criar margens artificiais.

### Tema dinâmico controlado

O sistema extrairá uma paleta da imagem ativa e a converterá em tokens funcionais:

- cor principal e cor de contraste;
- acento suave;
- superfície da sidebar;
- cor de foco;
- tratamento do banner;
- ambiente externo.

Os tokens serão calculados com limites de luminosidade e contraste. Se a imagem produzir uma combinação ilegível, o sistema ajustará a cor automaticamente. Usuários continuarão podendo definir cor, recorte, zoom e intensidade manualmente.

A identidade ameixa atual deixa de ser uma restrição global e passa a ser uma opção de fallback quando não houver imagem ou paleta válida.

### Tipografia e composição

Títulos editoriais de livros e sagas usarão uma fonte adequada à leitura. Controles e textos utilitários usarão uma sans legível. A hierarquia será construída por escala, espaço e alinhamento, evitando excesso de bordas, sombras e cartões idênticos.

Capas, banners e imagens da comunidade serão os elementos expressivos. A estrutura ao redor permanecerá discreta.

## Shell e navegação

A sidebar desktop conterá marca, navegação principal e ação para adicionar livro. O bloco de perfil inferior será removido, pois busca, notificações e perfil já ficam no canto superior direito.

A imagem personalizada ocupará a sidebar sob uma camada tonal. Itens ativos usarão o acento derivado do tema com contraste validado. As bordas superior e inferior pertencerão à mesma janela, evitando o vazamento atual.

Leitor e chat continuarão podendo ocupar a tela inteira. O shell deve conservar o comportamento atual dessas rotas.

## Página de detalhes do livro

### Banner editorial

O topo será um banner horizontal, não um background de página inteira. Ele combinará imagem temática, capa sobreposta e informações essenciais:

- título e autoria;
- saga e volume, quando aplicável;
- avaliação, extensão e estado da leitura;
- ações de ler, favoritar, concluir, editar e compartilhar.

O banner terá altura controlada e não prejudicará o restante da página. Abaixo dele, conteúdo e avaliações usarão navegação simples, seguidos pela saga, galeria e recomendações.

### Saga na página do livro

Quando o livro pertencer a uma saga, uma linha ordenada mostrará os volumes, destacará o atual e permitirá abrir cada livro. Também haverá acesso à página completa da saga. Livro sem saga não exibirá uma seção vazia.

### Galeria do livro

A galeria exibirá publicações visuais vinculadas ao livro. Um clique abrirá um visualizador com carrossel, descrição, autoria, comentários e reações.

Clique ou toque simples no controle principal aplicará coração. Pressão longa abrirá coração, panda, triste e emocionado. Desktop e tecnologias assistivas terão um botão explícito para abrir o seletor; nenhuma função dependerá exclusivamente de pressão longa.

## Edição e cadastro de livros

O formulário será organizado em etapas:

1. informações do livro;
2. arquivos e capa;
3. saga e posição;
4. aparência e banner;
5. revisão e salvamento.

No desktop, uma prévia fixa mostrará capa e banner. No celular, a prévia será recolhível. O estado local do formulário será preservado durante falhas recuperáveis, e a interface mostrará claramente qual etapa ou arquivo falhou.

Administradores poderão criar uma saga sem sair do formulário, pesquisar uma saga existente, vincular ou desvincular o livro, definir volume e posição e reorganizar a sequência. Desvincular nunca apagará o livro.

## Modelo de sagas

### Entidades

`series` conterá identificador, nome, descrição opcional, imagem opcional, criador e datas de criação e atualização.

`series_books` conterá série, livro, posição ordenável e rótulo de volume. Cada livro pertencerá no máximo a uma saga nesta entrega. A posição será única dentro da saga e será normalizada após reordenação ou remoção.

### Busca

Busca global e catálogo encontrarão um livro por título, autor ou nome da saga. A busca por saga também poderá retornar a própria página da saga.

## Comunidade social

### Publicações

Qualquer usuário autenticado poderá criar publicação com texto, uma ou várias imagens e vínculo opcional com um livro. O feed oferecerá as visões “Para você” e “Seguindo”. Nesta entrega, “Para você” será uma ordenação determinística por recência e engajamento, sem sistema de recomendação opaco.

Posts terão rota própria. O autor poderá editar ou apagar o próprio conteúdo; administradores poderão moderar. A exclusão será confirmada e executada em transação.

### Conversas

Comentários aceitarão respostas encadeadas por `parent_id`. A interface carregará a conversa por níveis, com limites de profundidade visual para evitar colunas estreitas; níveis adicionais continuarão semanticamente encadeados, mas serão apresentados com recuo máximo controlado.

Posts, comentários e respostas aceitarão coração, panda, triste e emocionado. Cada usuário terá uma reação ativa por alvo, podendo substituí-la ou removê-la.

### Republicação e compartilhamento

Republicações poderão ser diretas ou conter observação. A publicação original continuará sendo a fonte de mídia e livro associado; apagar o original deixará uma indicação de conteúdo indisponível em vez de quebrar o feed.

Compartilhar oferecerá:

- envio interno para um leitor;
- cópia de link canônico;
- API nativa de compartilhamento, quando disponível.

### Feed e criação

O compositor ficará no topo do feed e aceitará prévia, reordenação e remoção de imagens antes do envio. Limites de quantidade, tipo e tamanho serão validados no cliente e novamente na API.

Contadores e reações usarão atualização otimista com reversão em falhas. Criação, edição e exclusão exigirão confirmação da API antes de consolidar mudanças destrutivas.

## Dados e API

Novas tabelas serão adicionadas por migrações idempotentes:

- `series` e `series_books`;
- `social_posts` e `social_post_media`;
- `social_comments`;
- `social_reactions`;
- `social_reposts`.

O backend manterá endpoints antigos durante a transição. Posts atuais serão migrados para `social_posts` com autoria preservada; quando o autor antigo não corresponder a um usuário, serão associados à conta administrativa existente. Imagem e livro associados serão preservados.

Comentários e avaliações atuais continuarão funcionando. A galeria será uma consulta de posts sociais com mídia e `book_id`, evitando manter dois sistemas de publicação visual.

Operações que alterem ordem, removam conteúdo ou criem múltiplas mídias usarão transações. Permissões serão verificadas no servidor, nunca apenas pela interface.

## Estados de erro e vazios

- Falha na extração de paleta usa o tema de fallback sem impedir a navegação.
- Falha em uma imagem não impede a visualização das demais.
- Upload parcial não cria publicação incompleta; arquivos órfãos serão limpos quando possível.
- Saga sem livros apresenta ação administrativa para adicionar o primeiro volume.
- Feed vazio orienta o usuário a seguir leitores ou criar a primeira publicação.
- Conteúdo removido em uma republicação aparece como indisponível, preservando o contexto da conversa.
- A interface informa erros com ação concreta de repetição ou correção.

## Acessibilidade e responsividade

- Contraste será validado após gerar a paleta.
- Todos os controles terão foco visível e nomes acessíveis.
- Carrosséis funcionarão com teclado, toque e botões explícitos.
- Imagens aceitarão texto alternativo e descrições.
- Animações respeitarão `prefers-reduced-motion`.
- Seletores por pressão longa terão alternativa de clique.
- O layout será testado em larguras móveis, tablet e desktop.

## Estratégia de testes

### Backend

- migrações idempotentes e preservação de dados;
- criação, vínculo, reordenação e remoção de sagas;
- permissões de post, comentário e moderação;
- comentários encadeados;
- uma reação por usuário e alvo;
- republicação direta e com observação;
- rollback de posts com falha de mídia;
- busca por nome da saga.

### Frontend

- recorte da janela e sidebar sem perfil duplicado;
- geração e fallback dos tokens de tema;
- fluxo de cadastro e edição por etapas;
- organização de volumes;
- composição de post com várias imagens;
- abertura isolada de post, comentários e respostas;
- carrossel e seletor acessível de reações;
- atualização otimista com reversão.

### Verificação visual

As telas principais serão verificadas por captura em desktop e celular: shell, detalhes, edição, saga, feed, publicação isolada e galeria expandida. A revisão visual conferirá vazamentos, contraste, rolagem, foco, densidade e consistência da paleta.

## Critérios de conclusão

- A janela desktop recorta corretamente as quatro bordas e o ambiente externo continua visualmente a imagem ativa.
- O perfil não aparece na base da sidebar.
- Detalhes e edição de livros seguem o novo desenho e permanecem funcionais em celular.
- Livros podem ser criados, vinculados, pesquisados e reordenados em sagas.
- A comunidade permite posts multimídia, livro associado, rota própria, comentários, respostas, reações, republicações e compartilhamento.
- A página do livro possui galeria expansível com descrições e reações.
- Dados existentes permanecem disponíveis após a migração.
- Testes automatizados e verificações visuais críticas passam sem regressões conhecidas.

## Fora do escopo

- mensagens privadas em grupo;
- vídeo em publicações;
- múltiplas sagas para o mesmo livro;
- algoritmo personalizado por aprendizado de máquina;
- moderação automática de conteúdo;
- notificações push nativas para todas as novas interações.
