# INT-09 — Avisos para Discord

Estado: Planejado. Esforço M. MVP via webhook, sem bot completo.

## O que envia

Mensagens escolhidas pelo admin para um canal de clube: encontro de leitura, link de livro/publicação ou recado editorial. Não importar conversas nem enviar atividade pessoal ou notas privadas.

## Procedimento

1. Acrescentar seção Integrações no admin. A pessoa administradora configura um webhook do canal que controla e escolhe o nome visível do destino.
2. Guardar URL/token no servidor de forma protegida; a API de leitura retorna apenas nome/status, nunca o segredo completo. Não incluir a URL no frontend, logs ou documentação.
3. Validar host e formato conforme a documentação atual do Discord; não permitir que o backend envie POST para uma URL arbitrária. Aplicar timeout e limites de tamanho.
4. Criar um compositor com prévia e botão Enviar. No MVP, cada mensagem depende dessa ação; publicação automática é uma etapa posterior com opt-in e filtros.
5. Desativar menções por padrão (`allowed_mentions`) para não disparar @everyone ou notificações inesperadas a partir de texto importado.
6. Usar chave de operação/outbox e guardar resultado. Tratar 429 respeitando retry_after. Se houver timeout depois de um possível envio, mostrar estado incerto em vez de repetir cegamente e gerar spam.

## Offline e aceite

Envio exige rede e autorização administrativa atual, sem fila offline genérica. Testes usam mock HTTP; enviar uma mensagem a um Discord real exige solicitação explícita ou execução pelo botão na aplicação configurada. Confirmar que não-admin não configura/envia e que nenhuma informação privada entra no payload. Remover a integração interrompe futuros envios.

Custos: webhooks básicos respeitam limites do serviço; verificar condições vigentes. Sem serviço intermediário pago no MVP.

Referência: https://discord.com/developers/docs/resources/webhook
