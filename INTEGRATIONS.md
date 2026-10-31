# Plano de integrações do myBooks

Status: **planejamento; nenhuma integração nova foi implementada por estes documentos**.
Base revisada: `0e32671`, em 31/10/2026. Antes de executar, confira o código e os commits posteriores. O pedido do usuário prevalece sobre este plano.

Este é o ponto de entrada para uma IA implementar as integrações. Cada documento define a experiência, o que importar/exportar, os pontos do código, as etapas e a conclusão esperada. Não implemente todas de uma vez.

## Ordem recomendada e custo de execução

S = mudança pequena e poucas dependências; M = vários fluxos e persistência; L = autenticação externa, processamento em lote ou cobrança. São estimativas relativas de trabalho e consumo de contexto, **não uma promessa de tempo ou quantidade de tokens**.

| ID | Integração | Primeira entrega | Esforço | Custo externo do MVP | Estado |
|---|---|---|---|---|---|
| INT-01 | [Calendário por arquivo ICS](docs/integrations/01-calendar-ics.md) | Evento de leitura importável no calendário | S | Sem API paga | Planejado |
| INT-02 | [Compartilhamento social](docs/integrations/02-social-sharing.md) | Compartilhar livro/link; Booklist como imagem | S no link; M na imagem | Sem API paga no compartilhamento nativo | Planejado |
| INT-03 | [Spotify](docs/integrations/03-spotify.md) | Vincular playlist pública e abrir no Spotify | S | Sem API no MVP | Planejado |
| INT-04 | [Google Books e ISBN](docs/integrations/04-google-books.md) | Buscar edição e preencher cadastro | M | Consultas sujeitas às regras/cotas vigentes | Planejado |
| INT-05 | [Open Library](docs/integrations/05-open-library.md) | Segunda fonte de metadados e capas | M; menor após INT-04 | API pública, com limites de uso | Planejado |
| INT-06 | [Goodreads por CSV](docs/integrations/06-goodreads-csv.md) | Importar estante com prévia e deduplicação | L | Sem API paga; há processamento próprio | Planejado |
| INT-07 | [Notion](docs/integrations/07-notion.md) | Markdown manual; depois exportação autorizada | S no arquivo; L no OAuth | Arquivo sem API; conferir condições do serviço | Planejado |
| INT-08 | [Google Agenda por OAuth](docs/integrations/08-google-calendar.md) | Criar/atualizar evento na agenda conectada | L | Conferir cotas e requisitos de verificação | Planejado |
| INT-09 | [Discord](docs/integrations/09-discord.md) | Webhook administrativo com envio manual | M | Uso básico dentro dos limites do serviço | Planejado |
| INT-10 | [Telegram](docs/integrations/10-telegram.md) | Bot autorizado para avisos de clube | M | Uso básico dentro dos limites do serviço | Planejado |
| INT-11 | [Gutenberg/Gutendex](docs/integrations/11-public-domain.md) | Descoberta; depois importação editorial permitida | L | API pública; storage/tráfego próprios | Planejado |
| INT-12 | [Mercado Pago / Stripe](docs/integrations/12-subscriptions.md) | Um provedor de assinaturas em sandbox | L | Taxas comerciais por transação e possíveis extras | Planejado |

**Começar com menos contexto/tokens:** INT-01, INT-03 na versão de link, INT-02 na versão nativa. Exportar Markdown da INT-07 também é pequeno, mas não conecta a conta do Notion. Não chamar OAuth, cobrança ou importação em lote de tarefa rápida só porque a API tem acesso gratuito.

## O que já existe e deve ser reaproveitado

- `frontend/`: React/Vite/TypeScript; `server/`: Express + SQLite/Turso; Supabase/S3 armazenam arquivos.
- A identidade vem do cookie HttpOnly. Nunca confiar em username, isAdmin ou `x-user-id` enviados pelo frontend para autorizar operações.
- `frontend/src/app/components/Community.tsx` já compartilha posts com `navigator.share`, cópia de link e chat. Estender, sem duplicar.
- `frontend/src/app/lib/booklists.ts`, `components/Booklists.tsx`, `FolderArtwork.tsx` e `server/booklists.js` oferecem pastas privadas por conta, capa e ordem dos livros.
- `frontend/src/app/pages/Upload.tsx`, `components/EditBookModal.tsx` e `lib/api.ts` cuidam do cadastro atual. Não substituir o catálogo inteiro nem preencher campos editados sem confirmação.
- `server/catalog-importer.js`, `catalog-schema.js`, `catalog-source.js` e o importador MEC já têm deduplicação e políticas de origem. O importador atual exige um PDF; **não usá-lo diretamente para registros apenas bibliográficos**.
- Não há ISBN tipado no modelo `Book` revisado. Não presumir coluna, índice, tela de eventos de clube ou sistema de assinaturas já prontos.
- PWA/offline e fila por conta: `frontend/src/app/lib/offline/`; não enfileirar ações externas indiscriminadamente. Notas privadas, pagamentos, tokens e dados de terceiros não entram no cache público do service worker.
- Preferências de animação e acessibilidade, menus por botão direito/toque prolongado e recortes de capa devem ser preservados.

## Procedimento para a próxima IA

1. Leia `AGENTS.md`, este índice e **somente o plano da integração solicitada**. Abra os arquivos de código relacionados; não carregue o histórico inteiro de planos.
2. Confirme `git status`, branch e estado atual do remoto. Preserve trabalho existente. Inspecione o código antes de assumir que um caminho proposto ainda vale.
3. Execute primeiro o MVP indicado. Rotas e tabelas destes planos são propostas, não contratos já implementados. Reutilize estruturas atuais e não crie uma plataforma genérica de integrações antes de haver necessidade.
4. Para serviço externo, confira documentação oficial, disponibilidade, termos, cotas e formato atual da API. Os links são referências, não garantia de gratuidade ilimitada. Não usar scraping como substituto silencioso de uma API inexistente.
5. Produza migrações aditivas/idempotentes se necessárias. Segredos somente no servidor/ambiente; `.env.example` recebe nomes de variáveis, nunca valores reais. Desenvolva com mocks/sandbox enquanto faltarem credenciais.
6. Implemente prévia, erro recuperável, cancelamento quando aplicável e comportamento offline definido no plano. Ninguém deve receber mensagem de sucesso antes da confirmação exigida.
7. Teste transformação/deduplicação/permissões e o caminho de interface que mudou. Nunca importar, publicar mensagens, enviar cobranças ou usar o banco de produção para testes.
8. Execute as verificações aplicáveis, registre limitações e atualize o estado neste índice. Diferencie `Planejado`, `Implementado — mock/sandbox`, `Validado com provedor` e `Em produção`.
9. Faça commit/push quando autorizado pelo usuário. Não declarar integração ativa, mensagem enviada ou cobrança real validada só porque houve build ou push. Informe se o deploy precisa de frontend, API e configuração externa.

Verificações usuais, conforme os arquivos alterados:

```sh
node --test server/tests/*.test.js
npm run typecheck --prefix frontend
npm run test:run --prefix frontend
npm run build --prefix frontend
```

Para mudanças somente em documentação, confira links, caminhos e coerência; não é necessário rodar o app.

## Solicitações prontas

- “Implemente o MVP da INT-01 conforme INTEGRATIONS.md e seu plano; mantenha as outras integrações planejadas.”
- “Implemente apenas a vinculação por link da INT-03, sem API do Spotify nem player incorporado.”
- “Implemente INT-04 com busca manual por ISBN/título; deixe câmera e INT-05 para outra etapa.”

## Decisões comuns

- Metadados, listas e arquivos de estante **não trazem os PDFs das obras**.
- Conteúdo importado pessoalmente é privado por padrão. Dados de leitura importados não geram XP, recompensas, posts ou avaliações públicas automaticamente.
- Publicar livros exige origem e permissão adequadas; domínio público varia por país. Consultar uma API não autoriza distribuir o texto completo.
- Integrações pessoais conectam apenas a própria conta. Publicação em canais de clubes/admin depende de uma configuração autorizada; nunca disparar mensagens ao testar este plano.
