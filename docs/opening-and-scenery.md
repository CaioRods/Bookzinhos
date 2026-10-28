# Abertura e continuidade do cenário

O fundo externo usa o mesmo tema, recorte, zoom e escala da imagem do menu lateral. Uma camada alinhada à geometria do menu mantém a continuidade na borda da janela; uma segunda camada difusa preenche as áreas que ultrapassam a imagem original. A intensidade acompanha a configuração do tema. O alinhamento é recalculado ao redimensionar e ao navegar entre janelas com margens diferentes.

A abertura animada aparece depois de um login bem-sucedido e na primeira abertura de uma aba com a conta já ativa. O livro abre e passa quatro folhas em perspectiva, resolvendo no arquivo original `/logo.svg?v=3`. A marca permanece visível antes da transição para o app. A sequência dura aproximadamente quatro segundos; as telas e seus dados carregam por baixo dela.

A marcação de conclusão é por conta e por aba, em `sessionStorage`. Navegar ou recarregar essa aba não repete a abertura. Um novo login a reproduz novamente. O app continua utilizável se o navegador bloquear o armazenamento.

O botão **Pular abertura** e a tecla **Esc** encerram a sequência. Durante ela, o app fica inerte para não receber cliques nem foco acidentalmente. A preferência `prefers-reduced-motion` apresenta a marca com uma breve transição, sem as viradas tridimensionais. Há um limite de segurança para liberar a interface caso uma animação seja cancelada.

Verificação:

```sh
npm run typecheck --prefix frontend
npm run test:run --prefix frontend
npm run build --prefix frontend
```

Os testes cobrem a primeira sessão, novo login, visitantes e armazenamento indisponível. A revisão no Chromium verificou a animação, conclusão automática, recarga sem repetição, saída por botão/Esc, celular e movimento reduzido. Também verificou a igualdade de posição, escala e recorte entre menu e fundo em três larguras e após navegação.

Esta mudança é somente no frontend.
