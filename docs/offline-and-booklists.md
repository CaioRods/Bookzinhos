# Instalação, leitura offline e Booklists

O frontend é uma PWA: pode ser instalado pelo navegador no computador e no Android. No iPhone/iPad, abra no Safari e use Compartilhar → Adicionar à Tela de Início. O botão Instalar app oferece o convite do navegador quando disponível e instruções nos demais casos. A instalação requer HTTPS (localhost é permitido para desenvolvimento).

## Livros no aparelho

Em detalhes ou no menu de um livro, **Instalar livro** salva o PDF completo (ou as páginas de texto), informações, capa e capítulos no IndexedDB. É diferente de **Baixar PDF**, que continua sendo uma exportação de arquivo. A instalação mostra bytes/porcentagem, permite cancelar, informa falhas e só marca o livro como instalado depois de gravar todo o conteúdo em uma transação. PDFs inválidos, downloads interrompidos e falta de espaço não recebem o indicador verde.

O indicador verde junto ao título significa que o livro está instalado **neste aparelho e neste navegador/app**. É possível remover a instalação sem excluir o livro do catálogo. Cada conta tem seu próprio armazenamento. Trocar de conta cancela downloads da conta anterior; conteúdos de uma conta não entram na biblioteca offline de outra.

Ao perder conexão, o aviso Modo offline fica visível. A biblioteca mostra apenas os instalados, mantendo busca, ordenação e leitura. O leitor usa o arquivo local inclusive para PDFs que normalmente abririam fora do app. O aplicativo e o leitor podem ser reabertos sem rede: o build gera `precache.js` com todos os módulos, fontes e worker de PDF. O service worker mantém a interface local; dados privados e PDFs ficam fora desse cache compartilhado.

O armazenamento depende do espaço disponibilizado pelo navegador. O app solicita persistência quando essa API existe. Limpar os dados do site/aplicativo remove os livros locais. Downloads em lote funcionam enquanto o app está em execução; depois de fechar/interromper, Instalar todos pula os concluídos e tenta os restantes novamente.

## Alterações offline e sincronização

Progresso/estado de leitura, favoritos e anotações privadas do diário são gravados localmente antes de a interface confirmar sucesso. A fila persiste ao fechar a página. Ao reconectar ou reabrir com internet, o app verifica a sessão e sincroniza automaticamente. O aviso informa pendências e permite tentar de novo quando necessário.

- Progresso por livro é consolidado no estado mais recente da fila. Um progresso mais novo já registrado no servidor por outro aparelho é preservado.
- Notas recebem um identificador estável antes do primeiro envio. Repetir uma requisição cuja resposta se perdeu não cria outra nota. A exclusão de uma nota criada offline também funciona depois da sincronização.
- A fila não é descartada por erro, sessão expirada ou troca de conta. Cada replay envia `X-Offline-Account`; a API compara com o dono do cookie, impedindo aplicação de alterações na conta errada mesmo se o cookie mudar durante o envio.
- Perfil, permissões, publicações, administração, capas/temas e criação/edição de Booklists precisam de conexão. Essas mutações não são enfileiradas. Tempo de atividade e recompensas não são inventados a partir do tempo offline.
- Sair da conta sem rede encerra o acesso local; a revogação do cookie é concluída na próxima conexão antes de restaurar a mesma conta.

A primeira entrada da conta e os downloads precisam acontecer com internet. Não é possível instalar conteúdo que nunca foi baixado enquanto já estiver offline.

## Booklists

Somente **Meus livros** oferece Criar Booklist. É possível definir nome, cor, ícone e imagem opcional. A capa tem prévia na proporção exata do cartão, posição horizontal/vertical e zoom; ao escolher uma imagem, a cor inicial acompanha sua paleta e pode ser ajustada. Pastas usam camadas translúcidas, brilho, contornos e sombras inspiradas na referência.

Clique na pasta para abrir uma página da coleção (`/my-books?booklist=...`), com sua identidade e apenas seus livros em ordem. A transição respeita redução de movimento. Botão direito, pressão prolongada ou o botão de opções permitem editar, selecionar vários livros com pesquisa, remover livros, excluir a pasta e instalar todos. Excluir uma Booklist não apaga os livros nem suas instalações.

**Instalar todos** aparece dentro da coleção e no menu da pasta. O download é sequencial, segue a ordem da seleção e pula livros já instalados. Há progresso geral e do arquivo atual, cancelamento e indicação de arquivos que falharam. Repetir tenta apenas os que ainda não estão instalados.

Booklists são privadas por conta e sincronizadas no servidor. A API valida o proprietário e se os livros selecionados são públicos, pertencem à pessoa ou estão disponíveis ao admin. No offline, as Booklists já carregadas podem ser consultadas, exibindo apenas seus volumes instalados.

## Implantação

Publique **frontend e API** do mesmo commit. A API cria `booklists` automaticamente, reutiliza o armazenamento de imagens existente e adiciona compatibilidade com os identificadores de anotações e o cabeçalho de replay. Não há SQL manual no Supabase.

O frontend precisa ser construído pelo Vite para gerar a lista completa do service worker. Não sirva apenas `public/`. O cache de navegação é uma reserva quando não há rede; `/api` não recebe fallback HTML nem cache de respostas privadas. Atualizações mantêm uma versão anterior dos assets para abas já abertas.

## Verificação

```sh
node --test server/tests/*.test.js
npm run typecheck --prefix frontend
npm run test:run --prefix frontend
npm run build --prefix frontend
```

Testes cobrem isolamento entre contas, consolidação de progresso, resposta de rede atrasada, recusa de mutações de identidade offline, download incompleto, sessão expirada, replay, identificadores estáveis e instalação em ordem. Integração da API usa SQLite em memória; verificação adicional da API completa usa um diretório temporário, cookies reais, repetição/exclusão de nota e conflito de progresso, sem acessar produção.

Chromium com build de produção e API local isolada: registro/controle do service worker; criação/edição e seleção múltipla de Booklists; variantes de cor; instalação sequencial de dois PDFs reais; reabertura sem rede; biblioteca restrita aos instalados; PDF renderizado em canvas offline; diário/progresso reenviados ao reconectar; perfil bloqueado offline; pressão prolongada no celular; upload e recorte da capa; larguras 1440, 1024, 768, 390 e 320 sem overflow. A instalação pelo sistema operacional não foi automatizada; o teste valida a PWA e o modo responsivo no navegador.

## Instalação pelas Configurações e movimento inicial

No final de Configurações há a seção Instalar aplicativo. O botão usa o convite nativo do Chrome quando disponível. O evento de instalação é guardado no módulo compartilhado antes da montagem da página, portanto navegar até Configurações não perde o convite. Após instalar, o botão informa que o app já está instalado. Sem convite nativo, mostra o caminho de instalação no menu do Chrome e a alternativa do Safari.

Contas criadas a partir desta atualização (senha ou Google) começam com Animações da interface desligado. `users.animations_default_off` tem padrão zero na migração, preservando contas existentes; apenas os dois fluxos de cadastro gravam um. A escolha manual fica por conta neste aparelho e é preservada ao restaurar a sessão, editar o perfil, sair e entrar novamente. Outras preferências não são redefinidas.

Verificação adicional: testes de preferência para contas novas/antigas, ativação posterior e troca de conta; convite de instalação recebido antes de abrir a página; chamada do prompt por botão e estado instalado. Chromium validou a opção desligada inicialmente, ativação persistente após recarregar e acionamento do convite simulado a partir do final de Configurações. Frontend e API devem ser publicados juntos para aplicar o novo padrão apenas aos novos cadastros.
