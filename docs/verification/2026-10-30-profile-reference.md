# Perfis conforme referência visual

Atualizado a partir de `aafd109` com `git pull --ff-only origin main`.

- Cabeçalho compartilhado entre perfil próprio e público: banner completo, avatar e identidade sobre a imagem, redes sociais, frase e ações contextuais.
- Seis cartões de estatísticas reais com ilustrações vetoriais locais; painel de personalização aberto no perfil próprio e acesso pelo botão do banner.
- Mantidos níveis, selos, estante, resenhas, favoritos, edição de identidade, escolha de avatar e preferências.
- Ao visitar outro leitor, a janela e o menu mostram temporariamente o cenário desse leitor. A preferência pessoal não é sobrescrita e volta ao sair.
- Perfis públicos não recebem controles de personalização nem exibem o percentual privado de XP.
- Sem tema selecionado, o cabeçalho utiliza um fundo neutro. As imagens dos banners continuam sendo as escolhidas pelos usuários.

Verificação:

```sh
npm run typecheck --prefix frontend
npm run test:run --prefix frontend
npm run build --prefix frontend
```

Resultado: TypeScript e build passaram; 61 testes passaram. Chromium, com API simulada: edição e salvamento do perfil, seguir leitor, expansão da personalização, privacidade de XP, estatísticas e ausência de transbordamento nas larguras 1789, 1440, 1280, 1024, 768, 390 e 320 px.

Adicionado `@types/node` ao ambiente de desenvolvimento para compilar os testes com `node:fs` trazidos pelo pull. Atualização somente do frontend; não há migração de banco de dados.
