# INT-01 — Calendário por ICS

Estado: Planejado. Esforço: S. Sem OAuth ou serviço pago no MVP.

## O que faz

A pessoa agenda uma sessão de leitura a partir de um livro/Booklist e baixa um `.ics`. Ela importa o evento no Google Agenda, Apple Calendar ou Outlook. Não existe sincronização automática nem alteração de uma agenda remota.

## Procedimento

1. Criar um gerador puro em `frontend/src/app/lib/calendarIcs.ts`: título, início, duração e descrição com link apropriado do app.
2. Adicionar uma ação explícita Agendar leitura nos detalhes do livro/Booklist, usando os menus existentes, e um modal com nome, data, horário, duração e prévia.
3. Validar início/fim e timezone. Converter a data local para UTC; serializar `DTSTART`/`DTEND` com Z, `UID`, `DTSTAMP`, `SUMMARY` e `DESCRIPTION`. Escapar vírgula, ponto e vírgula, barra invertida e quebras; usar CRLF e dobramento de linhas em UTF-8 conforme RFC 5545.
4. Baixar Blob `text/calendar;charset=utf-8` com nome seguro. Revogar a URL temporária depois do uso.
5. Explicar que o arquivo precisa ser aberto/importado. Não afirmar “evento criado na sua agenda” ao baixar.

## Dados, offline e limites

Nenhuma tabela, token ou API nova. Pode funcionar offline com livro/Booklist já disponível. Não incluir diário, progresso privado ou conteúdo completo na descrição; deixar a pessoa revisar o texto. Um link para uma pasta privada continua exigindo a conta e não vira convite público.

## Aceite e testes

Teste escaping, Unicode, UTC, duração inválida e leitura do arquivo em um parser independente. Conferir importação manual no Google Agenda e abertura no calendário de um celular quando disponível. Modal e download devem funcionar no computador/celular. Não criar eventos reais sem ação do usuário.

Referência: https://www.rfc-editor.org/rfc/rfc5545

## Entrega de 31/10/2026

MVP implementado e verificado localmente. Calendário e Markdown estão disponíveis no livro, Booklist e diário; anotações do diário exigem seleção explícita e autoria identificada. Compartilhamento externo limita-se a livros públicos e posts, preservando pastas privadas. Spotify é um link opcional no editor da Booklist, validado pela API e preservado nas outras edições. Não há OAuth, sincronização ou player incorporado. Nenhuma alteração manual no Supabase é necessária; atualizar frontend e API. Importação real nos provedores e publicação não foram verificadas.
