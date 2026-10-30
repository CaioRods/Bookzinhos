# Personalização visual

Em **Perfil → Escolha seu cenário**, cada conta pode criar até quatro temas pessoais. É possível copiar um tema do sistema e ajustar separadamente o recorte do banner e do menu (posição e zoom), a intensidade da imagem no menu e a cor principal. Uma referência opcional associa o tema a um livro do catálogo e/ou a uma saga.

O banner do perfil tem largura e altura responsivas. O editor mede o banner exibido e reproduz exatamente sua proporção na prévia, inclusive ao redimensionar a janela. Recomendamos **2400 × 1600 px** para acomodar os recortes do perfil e do menu; para uso exclusivo como banner panorâmico, **2400 × 800 px**. JPG, PNG, WebP ou AVIF, até 8 MB.

O admin pode marcar **Disponível para todos** para publicar um tema do sistema ou editar um existente. Excluir uma personalização dos seis temas originais restaura seu padrão. Temas pessoais continuam privados à conta e o limite é aplicado no servidor, inclusive em gravações simultâneas.

Na página de um livro, o botão **Aparência** permite ao admin definir banner, recorte, desfoque, intensidade e cor principal. A imagem fica restrita a um banner panorâmico de 250 px no computador e 180 px no celular (recomendado: 2400 × 800 px). Por padrão, o banner usa a capa e a página extrai sua cor dominante; quando a imagem não pode ser lida, usa uma cor de reserva.

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
