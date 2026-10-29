# Perfil, progressão e catálogo de personagens — especificação

## Objetivo

Transformar o perfil do myBooks em uma identidade literária viva: aparência personalizada, catálogo reutilizável de personagens, conquistas, níveis difíceis de evoluir, temas comunitários e administração auditável. A entrega também corrige o banner aleatório da Biblioteca e a navegação do chat.

## Princípios e limites

- Preservar usuários, livros, sagas, personagens, temas, conversas, leituras e avaliações existentes.
- O servidor é a autoridade para XP, níveis, selos, tempo ativo e conclusão de leitura.
- Toda recompensa repetível possui chave de idempotência, limite por pessoa ou janela de tempo.
- SQLite local e Turso devem usar o mesmo esquema e as mesmas consultas.
- A interface permanece responsiva e respeita teclado, leitor de tela e `prefers-reduced-motion`.
- A implementação não exige que o usuário execute SQL manualmente no Supabase; o Supabase continua sendo apenas uma opção de armazenamento de arquivos.
- A entrega será incremental no código, mas publicada como um conjunto integrado.

## 1. Biblioteca: três livros aleatórios

`LibraryBanner` filtra livros com capa, embaralha uma cópia do conjunto com Fisher–Yates e seleciona até três itens distintos. O sorteio ocorre na montagem do componente, não a cada renderização. Assim, recarregar a página ou sair e voltar à Biblioteca produz uma nova seleção sem fazer as capas piscarem durante atualizações de estado da mesma tela.

Quando houver menos de três livros com capa, todos os disponíveis aparecem. O estado vazio atual permanece.

## 2. Editor de avatar

O editor apresenta a imagem inteira em uma área retangular e desenha, sobre ela, uma máscara escura translúcida com abertura circular central. A parte que será descartada permanece visível; a abertura mostra o resultado com nitidez e inclui uma borda de contraste.

Interações:

- arrastar em qualquer direção move a imagem;
- controle deslizante, roda do mouse e gesto de pinça ajustam o zoom;
- o zoom mínimo sempre cobre completamente o círculo de recorte;
- a imagem não pode ser movida até deixar áreas vazias dentro do recorte;
- teclado move a imagem com as setas e `+`/`-` altera o zoom;
- botão “Centralizar” restaura a posição inicial;
- o resultado é exportado em WebP quadrado de 720 × 720, mantendo a qualidade atual.

O cálculo de exportação usa as mesmas dimensões e transformações da prévia, evitando divergência entre o que a pessoa enquadrou e o arquivo salvo.

## 3. Catálogo reutilizável de personagens

### Modelo

`character_avatars` passa a representar a identidade canônica do personagem, sem pertencer exclusivamente a um livro. Uma nova tabela `character_books` relaciona muitos personagens a muitos livros:

- `character_id`
- `book_id`
- `created_at`
- chave primária composta

O campo antigo `book_id` continua disponível durante a migração e é convertido em uma relação na nova tabela. Nenhum personagem existente é perdido.

### Reutilização e organização

Ao cadastrar ou editar um personagem, o admin pode pesquisar e selecionar vários livros. Se um livro pertence a uma saga, o editor mostra os personagens já ligados a qualquer volume dessa saga e oferece “Usar personagem existente”. Isso adiciona o novo vínculo, em vez de duplicar nome e imagem.

O seletor de avatar agrupa o catálogo desta forma:

1. nome da saga, por exemplo “O povo do ar”;
2. volumes em ordem, por exemplo “O príncipe cruel”, “O rei perverso”, “A rainha do nada”;
3. personagens ligados à saga ou ao volume.

Um mesmo Cardan aparece como uma única identidade, mesmo que esteja relacionado a todos os volumes. Livros sem saga aparecem em “Livros independentes”. Personagens não vinculados aparecem em “Outros personagens”.

## 4. Navegação do chat

Ao entrar no chat, a aplicação registra uma única rota de origem válida, ignorando qualquer rota `/chat/*`. Trocar de conversa usa navegação com `replace`, portanto não empilha conversas no histórico. O botão voltar usa a origem registrada e, na ausência dela, retorna para `/social`.

Recarregar uma conversa preserva uma origem segura armazenada na sessão. URLs externas nunca são aceitas como destino de retorno.

## 5. Menu da conta

O avatar no topo abre um popover com:

- resumo da conta, avatar, nome, `@handle`, nível e progresso;
- Perfil;
- Configurações;
- Administrador, apenas para administradores;
- Sair.

Administrador e Configurações deixam a navegação lateral. No celular, o mesmo popover é usado no cabeçalho; a aba Perfil do dock continua levando diretamente ao perfil para não prejudicar a navegação principal.

## 6. Perfil público

O perfil utiliza o tema escolhido pelo dono como sistema visual, sem comprometer legibilidade:

- banner personalizado no topo;
- avatar sobreposto ao banner;
- cor principal aplicada a destaques, progresso, abas e ícones;
- nome, `@handle`, biografia, Instagram e TikTok;
- cartão de nível com título atual, XP atual e XP necessário;
- estatísticas de livros lidos, publicados, avaliações e tempo ativo;
- vitrine de selos conquistados;
- abas para atividade, biblioteca pública e temas publicados.

Temas claros ou imagens de baixo contraste recebem automaticamente uma camada de proteção atrás dos textos. Perfis sem personalização usam o tema padrão do produto.

## 7. Selos

Selos são calculados a partir de dados verificáveis e gravados em `user_badges` quando conquistados. Uma conquista não pode ser removida automaticamente se a contagem diminuir.

Categorias iniciais:

- pioneiros: 3, 10 e 100 primeiras contas, usando uma sequência de cadastro estável;
- publicação: 10, 100 e 1.000 livros publicados;
- leitura: 10, 50, 100 e 1.000 livros concluídos validamente;
- comunidade: avaliações, comentários e compartilhamentos válidos;
- criação: primeiro tema aprovado e marcos de temas aprovados;
- nível: 10, 20, 30, 50, 75 e 100.

Cada definição possui código imutável, nome, descrição, ícone e raridade. O perfil mostra conquistados primeiro e pode exibir os próximos objetivos sem revelar selos administrativos.

## 8. XP, níveis e títulos

### Histórico e saldo

`xp_events` é o livro-razão de progressão:

- id, usuário beneficiado, tipo, quantidade base, multiplicador e quantidade final;
- ator e entidade de origem;
- chave idempotente única;
- metadados JSON e data.

O saldo materializado em `user_progression` acelera as consultas, mas é sempre atualizado na mesma operação lógica do evento. Ajustes administrativos também geram eventos; valores anteriores ficam auditáveis.

### Curva

O servidor deriva o nível a partir do XP total. A curva cumulativa é contínua e monotônica:

- níveis 1–12: crescimento suave para ensinar o sistema;
- níveis 13–30: crescimento exponencial moderado;
- níveis 31–100: crescimento exponencial alto, calibrado para anos de uso consistente;
- nível máximo inicial: 100.

Fórmula cumulativa, arredondada para múltiplos de 25:

- `L <= 12`: `90 × (L - 1)^1,55`
- `13 <= L <= 30`: XP do nível 12 + `420 × (L - 12)^1,9`
- `L >= 31`: XP do nível 30 + `2.400 × (L - 30)^2,25`

O nível exibido é o maior `L` cujo requisito cumulativo foi alcançado. O admin pode definir diretamente o nível, gerando o ajuste de XP necessário para o início desse nível.

### Títulos

- 1–9: Iniciante
- 10–19: Aprendiz
- 20–29: Explorador de histórias
- 30–39: Curte leitura
- 40–49: Leitor
- 50–59: Leitor dedicado
- 60–69: Conhecedor
- 70–79: Bibliófilo
- 80–89: Mestre das páginas
- 90–99: Guardião das histórias
- 100: Lenda literária

### Fontes e limites iniciais

- publicar livro aprovado: 120 XP, uma vez por livro;
- livro receber primeira curtida de cada pessoa: 4 XP para o autor;
- livro ser salvo pela primeira vez por cada pessoa: 6 XP para o autor;
- livro ser concluído validamente por outra pessoa: 18 XP para o autor;
- compartilhamento único por pessoa e livro: 3 XP para autor e 1 XP para quem compartilha, limitado a 10 por dia;
- concluir leitura válida: 80 XP;
- avaliar livro: 12 XP por livro, concedido somente na primeira avaliação;
- comentar com conteúdo válido: 8 XP por livro, no máximo 5 por dia;
- conversa ativa: 2 XP a cada bloco de 10 mensagens substanciais, no máximo 20 XP por dia, sem contar mensagens repetidas ou apenas emotes;
- tema aprovado: 250 XP e multiplicador 2× por 24 horas;
- ações do próprio usuário sobre o próprio conteúdo não concedem XP.

Valores ficam centralizados no servidor para futura calibração sem alterar componentes de interface.

## 9. Atividade e leitura válida

### Atividade geral

O cliente envia batimentos de atividade apenas enquanto a aba está visível e houve teclado, ponteiro, toque, rolagem ou navegação nos últimos dez minutos. O servidor aceita no máximo o intervalo esperado por batimento, impedindo que o cliente envie grandes períodos falsos.

`user_activity_daily` acumula segundos ativos por dia. Esse tempo alimenta estatísticas e pequenas recompensas controladas, mas não concede XP ilimitado apenas por manter o app aberto.

### Leitura

`reading_sessions` registra segundos ativos por usuário e livro. `reading_page_visits` registra páginas distintas visitadas. Uma conclusão é válida quando:

- há pelo menos 2.400 segundos ativos acumulados no livro;
- todas as páginas conhecidas foram visitadas;
- o progresso chegou à última página;
- a recompensa ainda não foi concedida.

Trocar rapidamente entre páginas não substitui o requisito de tempo. Releituras continuam disponíveis, mas não repetem a recompensa de primeira conclusão.

## 10. Temas comunitários

Temas pessoais permanecem privados por padrão. O criador pode marcar “Solicitar publicação para todos”, criando uma entrada em `theme_submissions` com estado `pending`.

O admin recebe uma fila com prévia do perfil e menu lateral, dados do criador, data e ações:

- aprovar: transforma o tema em público, concede XP e ativa 2× por 24 horas;
- rejeitar: mantém o tema privado e registra uma justificativa curta;
- devolver para ajustes: mantém a solicitação editável sem perder o tema.

Uma nova versão de um tema já aprovado exige nova revisão. O multiplicador se aplica a eventos elegíveis criados durante a janela, não retroativamente, e não duplica ajustes administrativos.

## 11. Administração

A aba de usuários passa a mostrar nível, XP, multiplicador e últimos eventos. O admin pode:

- adicionar ou remover uma quantidade de XP com motivo obrigatório;
- definir um nível entre 1 e 100;
- consultar o histórico completo de ajustes;
- analisar temas enviados;
- consultar selos e conceder apenas selos explicitamente administrativos.

O admin não edita diretamente o saldo no banco. Todas as ações passam pelo serviço de progressão e produzem auditoria em `admin_audit_log`.

## 12. Animação e som de nível

Após qualquer resposta da API que contenha mudança de nível, um controlador global atualiza o progresso:

- nível comum: toast visual com som curto;
- múltiplos de dez: modal celebratório mostrando nível anterior, novo nível e título desbloqueado;
- a animação toca uma vez por evento e continua correta após recarregar;
- `prefers-reduced-motion` troca movimento por transição de opacidade;
- áudio respeita as configurações de som existentes e nunca toca antes de uma interação do usuário.

## 13. API e segurança

Novos módulos do servidor isolam responsabilidades:

- `progression-rules`: curva, títulos, limites e cálculos puros;
- `progression-service`: eventos idempotentes, saldo e promoções;
- `progression-routes`: perfil, atividade e administração;
- `badges`: avaliação de marcos;
- `theme-submissions`: fluxo de moderação;
- `character-catalog`: vínculos muitos-para-muitos e agrupamento.

As rotas mutáveis exigem usuário autenticado; rotas administrativas usam `requireAdmin`. Nomes de evento, quantidades, atores e multiplicadores são derivados no servidor. O cliente nunca envia “quanto XP ganhar”.

## 14. Migração e compatibilidade

As tabelas novas usam `CREATE TABLE IF NOT EXISTS`; colunas novas usam o helper de migração existente. A inicialização executa backfills idempotentes:

1. cria sequência de cadastro para usuários atuais com ordem estável;
2. cria progressão nível 1 e XP 0 para contas existentes;
3. transforma `character_avatars.book_id` em entradas de `character_books`;
4. preserva temas atuais como privados ou públicos conforme o proprietário;
5. deriva selos pioneiros somente depois de estabilizar a ordem de cadastro.

Índices cobrem usuário/data, tipo/chave idempotente, personagem/livro, status de moderação e sessões de leitura. Nenhuma tabela ou coluna antiga será removida nesta entrega.

## 15. Critérios de aceite

- Entrar novamente na Biblioteca sorteia três capas distintas sem alterar durante a mesma visita.
- O avatar exportado corresponde visualmente à área circular escolhida em desktop e celular.
- Um personagem pode aparecer em vários volumes sem duplicação e é agrupado pela saga.
- Alternar entre três conversas e sair retorna à página que abriu o chat.
- Perfil, Configurações, Admin e Sair aparecem no menu do avatar conforme a permissão.
- O perfil público reflete tema, banner, nível, progresso e selos do dono.
- Eventos repetidos, ações próprias e limites diários não concedem XP duplicado.
- Dez minutos de inatividade interrompem a contagem; voltar a interagir retoma.
- Uma leitura com menos de 40 minutos ou páginas não visitadas não conclui a recompensa.
- Tema aprovado fica público, concede XP e ativa 2× por exatamente 24 horas.
- Admin consegue ajustar XP ou definir nível, sempre com motivo e auditoria.
- Mudança de nível comum e marco de dez níveis exibem experiências distintas e acessíveis.
- Migração roda mais de uma vez sem duplicar vínculos, XP, selos ou progressão.

## 16. Verificação

- testes unitários das curvas, títulos, limites, idempotência, atividade e conclusão;
- testes de API para permissões, backfills, catálogo de personagens e moderação;
- testes de componentes para sorteio estável, recorte, menu da conta e retorno do chat;
- typecheck e build de produção;
- inspeção responsiva em desktop e celular;
- teste de migração sobre uma cópia do esquema atual e segunda execução idempotente.
