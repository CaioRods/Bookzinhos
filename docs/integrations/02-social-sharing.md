# INT-02 — Compartilhamento social

Estado: Planejado. Esforço S para links; M para cartões. Sem OAuth no MVP.

## O que faz

Compartilha um livro ou publicação pelo menu do aparelho, WhatsApp ou cópia de link. Uma segunda etapa gera uma imagem de livro/Booklist pronta para Stories e feeds. Não publica automaticamente em Instagram/TikTok.

## Procedimento

1. Extrair/reutilizar o compartilhamento já existente em `components/Community.tsx` num helper/componente pequeno; adicionar aos detalhes de livro. Verificar se o conteúdo pode ser compartilhado e o destino existe.
2. Usar `navigator.share` sob clique do usuário; tratar cancelamento sem toast de erro. Copiar link quando a API não estiver disponível, preservando os botões explícitos apesar do bloqueio geral de cópia da interface.
3. Para Booklists, o MVP compartilha **imagem**, não um link falso de acesso público: as pastas atuais são privadas. Manter um link privado apenas se a interface explicar que exige a conta proprietária.
4. Na etapa gráfica, criar Canvas com variantes 1080×1920 e 1080×1080: título, capas escolhidas, nome da coleção e marca. Mostrar prévia e permitir baixar PNG ou compartilhar arquivo se `navigator.canShare` aceitar.
5. Esperar fontes/imagens; tratar capa sem CORS com fallback de cor/título sem quebrar o export. Não criar um proxy que busque qualquer URL fornecida pelo cliente.

## Dados e offline

Sem banco novo no MVP. Gerar cartões offline apenas com assets disponíveis. Não incluir notas privadas, dados de terceiros ou contadores pessoais por padrão. Links não garantem visualização sem login; conferir o fluxo de destinatário.

## Aceite

Testar share suportado, indisponível, cancelado, cópia e download de PNG sem canvas contaminado. Conferir layout mobile e desktop. Link público de Booklist é outra entrega: opt-in explícito, token revogável e DTO sem arquivos privados.

Referência: https://developer.mozilla.org/en-US/docs/Web/API/Web_Share_API

## Entrega de 31/10/2026

MVP implementado e verificado localmente. Calendário e Markdown estão disponíveis no livro, Booklist e diário; anotações do diário exigem seleção explícita e autoria identificada. Compartilhamento externo limita-se a livros públicos e posts, preservando pastas privadas. Spotify é um link opcional no editor da Booklist, validado pela API e preservado nas outras edições. Não há OAuth, sincronização ou player incorporado. Nenhuma alteração manual no Supabase é necessária; atualizar frontend e API. Importação real nos provedores e publicação não foram verificadas.
