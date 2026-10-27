# Comunidade, galeria editorial e sagas

## Catálogo e Home

Ao adicionar ou editar um livro, o campo **Saga / série** permite criar uma coleção ou selecionar uma existente, ver os volumes vinculados e definir o volume do livro. A biblioteca pesquisa por nome da saga e exibe o volume. Cada saga tem uma página em `/series/:seriesId`, com todos os volumes em ordem. Na página do livro, o admin pode usar **Organizar** para reordenar os volumes e salvar a ordem compartilhada.

Em **Admin → Postagens**, selecione **Saga relacionada** para vincular a coleção inteira. A saga e o livro individual são alternativas. A publicação da Home passa a abrir a página da coleção, tanto pela imagem quanto pelo cartão/título.

## Rede social

**Comunidade → Feed** aceita texto, livro opcional e até oito imagens por publicação. O app prepara as imagens para manter o envio dentro do limite de requisição da hospedagem serverless. Formatos de entrada: JPG, PNG, WebP ou AVIF, até 4 MB por imagem.

A página `/social/post/:postId` concentra a publicação, comentários e respostas. Publicações e comentários aceitam coração, panda, triste e emocionado. Segure a curtida ou use a seta ao lado para escolher. Também é possível republicar, copiar o link, usar o compartilhamento do dispositivo e enviar o link para um leitor pelo chat. O feed “Seguindo” inclui publicações próprias, de pessoas seguidas e republicações dessas pessoas. As atividades antigas de leitura continuam em **Leituras**.

A pessoa autora ou o admin pode excluir uma publicação. As operações de participação verificam a conta no servidor, seguindo o mecanismo de sessão existente do app.

## Galeria do livro

A galeria editorial é separada de posts de leitores que mencionam o livro. **Somente o admin pode publicar imagens na galeria**, com verificação no servidor. Leitores podem abrir as imagens, reagir e participar da conversa. Cada publicação pode conter várias imagens e uma descrição.

## Implantação e verificação

Atualize os projetos de **frontend e API** para o mesmo commit. A API inicializa as tabelas `book_series`, `community_posts`, `community_comments`, `community_reactions` e `community_reposts`, e adiciona os campos de saga aos livros e posts da Home. As migrações preservam os dados existentes. Não é necessário criar tabelas no Supabase: o banco da API continua SQLite/Turso; imagens usam o storage já configurado.

```sh
node --test server/tests/*.test.js
npm run typecheck --prefix frontend
npm run build --prefix frontend
```

Os testes de API usam SQLite em memória. As verificações de interface foram feitas no Chromium com banco local isolado, incluindo publicação de imagens, reações por pressão prolongada, comentários/respostas, vínculo de saga no mural, navegação à coleção e edição de volume.
