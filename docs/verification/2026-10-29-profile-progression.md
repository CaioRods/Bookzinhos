# Verificação — perfil, progressão e catálogo de personagens

Data: 2026-10-29

## Resultado

- Servidor: `node --test server/tests/*.test.js` — 20/20 testes aprovados.
- Interface: `npm run test:run --prefix frontend` — 34/34 testes aprovados.
- Tipos: `npm run typecheck --prefix frontend` — aprovado.
- Produção: `npm run build --prefix frontend` — aprovado (1.697 módulos transformados).
- Integridade: `git diff 16eecdd..HEAD --check` — sem erros.

## Regressões cobertas

- Avatar enviado aparece como imagem no mini perfil, sem link aninhado no botão.
- Alterar o nome atualiza a saudação da Home na sessão aberta.
- Ajustes administrativos de XP e nível exigem administrador, motivo e geram auditoria.
- Migrações de progressão podem ser reaplicadas com segurança.
- Celebrações diferenciam nível comum e marcos de dez níveis.
