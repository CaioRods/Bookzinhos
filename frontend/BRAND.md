# myBooks · identidade visual

O símbolo reúne três livros sobre uma linha de estante. A marca é original e não usa a maçã nem elementos proprietários da Apple.

## Arquivos reutilizáveis

- `public/logo.svg`: ícone vetorial colorido, escalável, fundo cobre e símbolo marfim.
- `public/logo-mark.svg`: símbolo monocromático em `currentColor`; pode ser incorporado em SVG para acompanhar a cor do texto.
- `public/icon-1024.png`, `public/icon-512.png`, `public/icon-192.png`, `public/apple-touch-icon.png`, `public/favicon-64.png`: ícones do app, PWA e navegadores.
- `src/app/components/Brand.tsx`: composição de símbolo e nome usada na interface.

Gere os PNGs com `npm run icons --prefix frontend`. Os arquivos de `assets/` usados pelo Expo também são atualizados. O gerador mantém as mesmas formas e proporções do SVG; ao alterar a geometria, atualize ambos.

## Paleta e tipografia

| Uso | Claro | Escuro |
| --- | --- | --- |
| Papel | `#f8f7f4` | `#191817` |
| Superfície | `#ffffff` | `#252422` |
| Tinta | `#282623` | `#f6f2e9` |
| Cobre | `#a94f32` | `#e4a282` |

Os tokens ficam em `src/styles/theme.css`. A interface usa a fonte nativa do sistema; títulos editoriais usam a família local Iowan/Palatino/Georgia, sem download de fontes. Use `--font-display` e `--font-sans`, sem criar novas famílias por página.

## Proporção e movimento

Preserve a proporção do símbolo e um respiro mínimo de um quarto da largura do ícone. O símbolo funciona a partir de 24 px; o ícone completo, a partir de 32 px. Não acrescente emojis, contornos ou novos gradientes à marca.

A interface combina superfícies claras, divisórias discretas, cantos de 12–24 px e escala de espaço em múltiplos de 4. As transições duram em geral 180–400 ms, sem movimento contínuo decorativo. O modo de movimento reduzido, tanto do sistema quanto das configurações do app, deve continuar funcionando.
