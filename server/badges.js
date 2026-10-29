const DEFINITIONS = [
  ['pioneer-3','Entre os 3 primeiros','Pioneiro lendário','pioneer',3], ['pioneer-10','Entre os 10 primeiros','Pioneiro','pioneer',10], ['pioneer-100','Entre os 100 primeiros','Primeira geração','pioneer',100],
  ['published-10','10 livros publicados','Autor da estante','published',10], ['published-100','100 livros publicados','Biblioteca viva','published',100], ['published-1000','1.000 livros publicados','Acervo lendário','published',1000],
  ['read-10','10 livros lidos','Primeiros capítulos','finished',10], ['read-50','50 livros lidos','Leitor constante','finished',50], ['read-100','100 livros lidos','Cem mundos','finished',100], ['read-1000','1.000 livros lidos','Mil vidas','finished',1000],
  ['theme-first','Primeiro tema aprovado','Criador de mundos','approvedThemes',1],
  ['level-10','Nível 10','Aprendiz','level',10], ['level-20','Nível 20','Explorador','level',20], ['level-30','Nível 30','Curte leitura','level',30], ['level-50','Nível 50','Leitor dedicado','level',50], ['level-75','Nível 75','Bibliófilo','level',75], ['level-100','Nível 100','Lenda literária','level',100],
];

function badgeCodesForStats(stats) {
  return DEFINITIONS.filter(([, , , field, threshold]) => {
    if (field === 'pioneer') return Number(stats.registrationOrder || Infinity) <= threshold;
    return Number(stats[field] || 0) >= threshold;
  }).map(([code]) => code);
}

module.exports = { DEFINITIONS, badgeCodesForStats };
