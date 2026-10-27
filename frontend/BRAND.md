# myBooks · identidade visual

A identidade segue as referências visuais aprovadas: marfim, pergaminho, ameixa, terracota e paisagens atmosféricas. O símbolo original representa um livro aberto com páginas dobradas; não usa a maçã nem marcas da Apple.

## Marca reutilizável

- `public/logo.svg`: ícone vetorial colorido.
- `public/logo-mark.svg`: versão monocromática em `currentColor`, para incorporar como SVG.
- `public/icon-1024.png`, `public/icon-512.png`, `public/icon-192.png`, `public/apple-touch-icon.png`, `public/favicon-64.png`: ícones rasterizados para web, PWA e Expo.
- `src/app/components/Brand.tsx`: marca com assinatura horizontal.

`npm run icons --prefix frontend` lê a geometria do SVG e gera os PNGs, incluindo os arquivos de `assets/` usados pelo Expo. O gerador usa apenas módulos nativos do Node. Preserve o enquadramento de 96 × 96 e as quatro páginas em paths M/L/Q/Z. Use o símbolo a partir de 24 px e o ícone a partir de 32 px, sempre com espaço ao redor.

## Paleta

| Uso | Cor |
| --- | --- |
| Marfim | `#faf7f2` |
| Superfície | `#fffdfb` |
| Pergaminho | `#f2ede8` |
| Ameixa | `#3e2747` |
| Ação principal | `#64344f` |
| Terracota | `#c96a4f` |
| Rosa névoa | `#d8c2b8` |

Os tokens estão em `src/styles/theme.css`. `references.css` define a composição de telas, cenários e componentes da direção visual. O tema escuro tem seus próprios tokens. A tipografia nativa do sistema atende títulos e interface; Iowan/Palatino/Georgia são reservadas para chamadas editoriais, citações e títulos de livros.

## Cenários

As seis paisagens são ilustrações geradas para o projeto, servidas em um atlas WebP de aproximadamente 500 kB. `Scenery.tsx` recorta os painéis por viewport SVG, preservando a proporção. A imagem de ramos dourados tem aproximadamente 94 kB e é reutilizada na vitrine e nos detalhes de livros.

A escolha de cenário é uma preferência deste aparelho, persistida nas configurações locais. Ela altera a faixa do perfil e a paisagem lateral, sem alterar a foto nem os dados públicos do leitor.

## Movimento e dados

As animações são breves e respeitam a configuração de movimento reduzido. Mostre progresso, contagens, avaliações e discussões vindos da API; os números e comentários dos mockups não são dados de demonstração para publicar.
