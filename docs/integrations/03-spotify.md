# INT-03 — Trilha de leitura do Spotify

Estado: Planejado. MVP S, sem conta Spotify conectada e sem SDK.

## O que faz

Vincula uma playlist pública musical à Booklist. A pessoa abre a trilha no Spotify. Não converte livros em músicas, não baixa áudio e não sincroniza histórico de reprodução.

## Procedimento

1. Em `server/booklists.js`, estender a configuração normalizada com `spotifyPlaylistUrl` opcional; registros antigos recebem vazio. Atualizar o tipo `Booklist` e o editor em `components/Booklists.tsx`.
2. Aceitar apenas HTTPS e hostname exato `open.spotify.com`, com caminho de playlist e ID validado. Remover parâmetros de rastreio. Não aceitar javascript, host parecido, redirecionador ou iframe arbitrário.
3. Na página da pasta, mostrar Ouvir trilha, abrindo com `noopener,noreferrer`. Edição exige conexão e verificação do proprietário no servidor.
4. Em outra etapa, acrescentar player incorporado oficial somente por ação da pessoa, gerado a partir do ID validado, com carregamento lazy. Se houver CSP, permitir apenas a origem necessária em `frame-src`; nunca adicionar wildcard de scripts.
5. Preservar a trilha ao editar capa, incluir livros e salvar outros campos. Conferir o append atômico de `server/booklists.js`.

## Offline, custo e limitações

Offline mostra a associação salva e informa que ouvir requer internet. Sem token/chave ou tabela nova no MVP; o campo entra no JSON existente da Booklist. A reprodução, previews, login e eventuais exigências de Premium são controlados pelo Spotify. Não prometer reprodução integral gratuita.

## Aceite

Testar URLs válidas/inválidas, edição de pasta alheia, ausência do campo em registros antigos e preservação da trilha em outras edições. Link funciona em celular e PC. OAuth, recomendações e controle de reprodução ficam fora do MVP.

Referência: https://developer.spotify.com/documentation/embeds
