# Aceite único no cadastro

O aceite é exigido somente de novas contas criadas por senha ou Google. Contas existentes ficam dispensadas, inclusive sem versão registrada. Após o aceite inicial, a pendência é removida no banco e nunca depende da comparação entre versões da política.

A API acrescenta automaticamente `users.privacy_required` com padrão zero, preservando os registros anteriores de aceite. Os dois fluxos de criação de conta marcam a pendência; login e recuperação de sessão não a criam. A sessão e o perfil expõem `privacyRequired`; o frontend utiliza esse sinal, sem comparar versões. Aceitar limpa a pendência e registra versão e horário.

Frontend e API precisam ser publicados juntos. Não há SQL manual para executar no Supabase.

Verificação: suíte do servidor (65 testes), suíte do frontend e build; testes específicos cobrem contas antigas sem aceite, aceite de versão anterior, cadastro pendente, aceite e restauração posterior sem reapresentar o diálogo.
