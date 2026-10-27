# Personalização visual

Em **Perfil → Escolha seu cenário**, cada conta pode criar até quatro temas pessoais. É possível copiar um tema do sistema e ajustar separadamente o recorte do banner e do menu (posição e zoom), a intensidade da imagem no menu e a cor principal. Uma referência opcional associa o tema a um livro do catálogo e/ou a uma saga.

O banner tem largura responsiva e altura de 190 px no computador e 180 px no celular. Recomendamos **2400 × 1600 px** para acomodar os dois recortes; para uso exclusivo como banner, **2400 × 600 px**. JPG, PNG, WebP ou AVIF, até 8 MB.

O admin pode marcar **Disponível para todos** para publicar um tema do sistema ou editar um existente. Excluir uma personalização dos seis temas originais restaura seu padrão. Temas pessoais continuam privados à conta e o limite é aplicado no servidor, inclusive em gravações simultâneas.

Na página de um livro, o botão **Aparência** permite ao admin definir banner, recorte, desfoque, intensidade e cor principal. Por padrão, a página usa a capa ampliada com desfoque e extrai sua cor dominante; quando a imagem não pode ser lida, usa uma cor de reserva.

## Implantação

Esta alteração precisa de **frontend e API atualizados**. A inicialização do servidor cria `appearance_themes` e adiciona `books.appearance_json` sem apagar dados existentes. Imagens usam o armazenamento já configurado para uploads do app. Em hospedagens com disco temporário, mantenha armazenamento remoto configurado.

Os temas são carregados por conta. Mudanças públicas são atualizadas ao recuperar o foco ou a cada 45 segundos com a página visível. A seleção do cenário mantém a preferência local já usada pelo app.

## Verificação

```sh
node --test server/tests/appearance.test.js
npm run typecheck --prefix frontend
npm run build --prefix frontend
```

O teste de integração usa SQLite em memória e uma porta temporária, sem acessar o banco configurado no ambiente.
