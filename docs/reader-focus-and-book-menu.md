# Leitura limpa, gestos e menu de livros

O leitor abre com as páginas e sem barras, progresso, avisos offline ou convite de instalação. Um toque curto e parado revela somente o botão de controles; clicar no botão mostra todas as informações, e clicar novamente as esconde. No computador, o mouse também revela o botão; H alterna os controles e Esc fecha painéis e retorna à leitura limpa. Arrastar para virar páginas, rolar verticalmente e movimentos que voltam ao ponto inicial não são tratados como toque para revelar controles.

## Ajuste por dispositivo

No celular/tablet, mantenha três dedos parados na página durante três segundos. Mover mais de 16 px, soltar antes do prazo, adicionar outro dedo ou interromper o gesto cancela a abertura. Também existe Ajustar uma e duas páginas no painel de ajustes, como alternativa ao gesto.

A primeira etapa ajusta uma página; a segunda ajusta duas. Arraste para mover e use pinça com dois dedos para zoom; há um slider e Centralizar como alternativas. As prévias usam o mesmo palco, medidas, preferências e renderização do leitor. A configuração não navega nem grava outro progresso enquanto é editada. Confirmar salva os dois presets e mantém a página atual; cancelar descarta os rascunhos. Se a pessoa estava em rolagem, confirmar passa para uma página para aplicar o encaixe.

Os presets ficam no armazenamento persistente do navegador, separados por conta e naturalmente por dispositivo. Sair e entrar ou abrir outro livro restaura os mesmos valores. Limpar os dados do navegador remove as preferências locais.

## Tutorial

O primeiro acesso ao leitor em um dispositivo de toque mostra um guia com leitura limpa, swipe, três dedos, pinça, presets e rolagem. Fechar/confirmar marca a leitura do guia localmente e na conta do servidor. Não depende do livro e não reaparece nos próximos acessos, inclusive em outro aparelho depois que a confirmação chegar ao servidor. No offline, essa confirmação é enfileirada para sincronizar; o guia não fica reaparecendo no mesmo aparelho. O painel oferece uma consulta manual posterior.

A migração cria `users.reader_tutorial_seen` com padrão zero e a API expõe o estado na sessão. `POST /reader/tutorial-seen` é autenticado e idempotente e altera apenas a própria conta. O header de proteção de replay continua sendo verificado no modo offline. Presets de enquadramento não são compartilhados com outras contas ou dispositivos.

## Menu do livro

O menu por botão direito ou toque prolongado tem cabeçalho, área de ações com rolagem e botão de fechar. A seta Mais opções abaixo aparece enquanto houver conteúdo para descer e também permite rolar ao clicar. O posicionamento usa o tamanho real do painel e os limites da janela/visual viewport, recalculados quando o conteúdo, a janela ou a área visível mudam. No celular, a folha também respeita a altura disponível; em janelas baixas, as ações rolam internamente.

Adicionar à Booklist mostra as pastas da própria conta. As que já contêm o livro ficam cinzas e desabilitadas. Selecionar outra pasta acrescenta o livro ao final, preserva a ordem e desabilita a pasta após confirmação do servidor. Criar Booklist continua disponível somente em Meus livros. Inclusão em pastas exige conexão e mantém as verificações de propriedade e disponibilidade dos livros na API.

## Verificação

- Testes: toque versus swipe/rolagem, três dedos por três segundos e cancelamentos, presets de uma/duas páginas por conta e guia por conta; inclusão em Booklist com bloqueio de duplicatas.
- API completa em SQLite temporário: confirmação do tutorial requer cookie, pode ser repetida e não marca outra conta.
- Chromium com emulação de toque e um PDF real: primeira apresentação do guia, swipe sem revelar interface, botão explícito, pressão de três dedos, pinça nas duas etapas, página preservada e presets restaurados após recarregar.
- Chromium desktop/celular: menu próximo à borda, rolagem interna, seta de continuação, inclusão na pasta e duplicatas bloqueadas. Redimensionamento até 320 × 260 mantém o painel dentro da área visível.

Publique frontend e API juntos. Não é necessário executar SQL manual no Supabase.
