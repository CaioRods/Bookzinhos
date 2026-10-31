# INT-12 — Assinaturas: Mercado Pago ou Stripe

Estado: Planejado. Esforço L. Integração sem mensalidade obrigatória não significa transação sem taxa; confirmar contratos atuais.

## Primeira decisão e escopo

Escolher **um provedor** para o MVP; não implementar os dois simultaneamente. Para o público brasileiro, avaliar Mercado Pago primeiro; Stripe é uma alternativa. Conferir se os meios de pagamento desejados suportam recorrência na conta/país contratados. Não prometer Pix recorrente ou outro método sem verificar o produto específico.

O sistema cobra assinatura de recursos do myBooks, não concede por si só licença para distribuir livros. Usar um plano de teste com preço e moeda definidos no servidor. Valores de R$ 19,90/mês e R$ 199/ano citados na conversa são hipóteses, não configuração comercial aprovada.

## Procedimento

1. Listar recursos gratuitos/premium e definir como cancelamento e fim de período funcionam. Preservar livros pessoais/públicos instalados; não apagar arquivos locais automaticamente para simular DRM. Conteúdo licenciado com restrições offline exige desenho específico.
2. Criar tabelas aditivas de clientes, assinaturas, eventos recebidos e direitos de acesso. Mapear usuário pelo cookie autenticado, nunca por username/preço aceito do frontend. Manter uma assinatura ativa por conta no MVP.
3. Configurar somente chaves sandbox no desenvolvimento. Implementar criação de checkout/assinatura no servidor com preço permitido e chave de idempotência.
4. Acrescentar planos e estado da assinatura às Configurações. Abrir checkout hospedado oficial; o myBooks não coleta número de cartão/CVV.
5. Implementar webhook autenticado pelas regras oficiais do provedor. Stripe exige corpo bruto antes de `express.json`; em `server/index.js` o parser global já existe e a rota precisa ser organizada corretamente. Mercado Pago tem sua própria assinatura/verificação; não reutilizar o algoritmo da Stripe.
6. Processar event ID uma única vez, buscar o estado oficial quando necessário e tolerar eventos fora de ordem. A página de retorno e a palavra “sucesso” na URL **não liberam Premium**.
7. Implementar pagamento aprovado, pendente, falho, cancelamento, renovação, expiração e reembolso. Liberar/revogar recursos no servidor; estado local é apenas uma representação visual. Portal do provedor pode reduzir o escopo de gerenciamento.
8. Exibir datas, cobrança e cancelamento de forma clara. Não duplicar uma assinatura por clique repetido. Manter suporte e reconciliação de eventos sem registrar dados financeiros sensíveis.

## Offline, testes e publicação

Novas compras, mudanças de plano e confirmação de permissão exigem rede. Não usar a fila offline de leitura para operações financeiras. O acesso já contratado pode mostrar último estado conhecido, mas ações protegidas continuam verificadas pelo servidor; não inventar autorização offline irrestrita.

Testar webhook com assinatura inválida, repetição, atraso, conta incorreta, checkout cancelado, renovação e reembolso em sandbox. Documentar configuração e deploy de frontend/API/webhook. Produção exige conta comercial configurada e decisão do usuário de ativar cobranças reais; não fazer cobranças ou testar cartões reais como etapa automática do plano.

Referências: https://www.mercadopago.com.br/developers/pt/docs/subscriptions/overview e https://docs.stripe.com/billing/subscriptions/overview
