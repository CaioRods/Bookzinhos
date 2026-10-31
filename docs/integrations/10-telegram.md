# INT-10 — Avisos para Telegram

Estado: Planejado. Esforço M; bot de avisos, sem chat importado.

## O que faz

Envia avisos editoriais para um grupo/canal administrado pela pessoa que configura a integração. Vincular uma conta pessoal e receber lembretes privados é uma etapa distinta e opcional.

## Procedimento

1. A pessoa cria o bot pelos mecanismos oficiais do Telegram e o adiciona ao destino com as permissões necessárias. O admin cadastra a configuração no myBooks.
2. Guardar bot token no servidor e proteger a leitura/edição por permissão. Guardar chat ID e nome do destino separadamente; não aceitar bot token de outra pessoa sem configuração autorizada.
3. Criar adaptador limitado a operações previstas da Bot API, com timeout, escape do texto e opção de mensagem sem formatação. Não aceitar comandos/URLs arbitrários.
4. Oferecer prévia e Enviar manualmente. Respeitar limites de mensagem, 429 e chat removido. Uma etapa de automação posterior pode reutilizar a outbox editorial da INT-09, mantendo resultados por destino.
5. Para lembretes privados futuros, usar código de vínculo curto e de uso único, confirmado pela conta autenticada. O bot não inicia conversa com alguém que nunca o habilitou. Oferecer desativação.
6. Se receber updates por webhook, validar secret token e consumir update_id uma única vez. Implementar esse recebimento só quando necessário, não para o MVP de envio ao canal.

## Offline e aceite

Não enfileirar envios pessoais/editoriais na fila offline de progresso. Não exportar biblioteca privada automaticamente. Testar ausência de permissão, repetição, formatação, chat inexistente e segredo ausente nos DTOs/logs. Nenhum envio real durante testes sem autorização explícita.

Uso básico pode ser gratuito dentro das condições do serviço; recursos pagos e limites de distribuição não entram no MVP.

Referência: https://core.telegram.org/bots/api
