# Orientação para agentes

## Integrações e importações

Quando a tarefa envolver integrações externas, importações, exportações ou o roteiro de comercialização, comece por [INTEGRATIONS.md](INTEGRATIONS.md). Ele aponta para planos executáveis por integração em `docs/integrations/`.

Os planos estão inicialmente **Planejados**: não confundir documentação com funcionalidade pronta. Leia apenas o plano necessário, confira o código atual e execute o MVP solicitado. Não implementar o roteiro inteiro automaticamente.

Preserve o mecanismo de sessão por cookie, o isolamento por conta, a PWA/leitura offline e as preferências atuais. Use testes isolados/mocks/sandbox; não testar contra banco, canais ou cobranças reais de produção. As instruções explícitas do usuário prevalecem sobre estes documentos.

Para outras tarefas, estes planos não precisam ser lidos. Não há exigência adicional de aprovação criada por este arquivo.
