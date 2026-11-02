export const NOTEBOOK_ICONS = [
 {id:"sparkles",label:"Brilhos",paths:["m12 3 2.3 6.7L21 12l-6.7 2.3L12 21l-2.3-6.7L3 12l6.7-2.3Z","M20 2v4m-2-2h4"]},
 {id:"moon",label:"Lua",paths:["M20.9 13A9 9 0 0 1 11 3.1 9 9 0 1 0 20.9 13Z"]},
 {id:"flower",label:"Flor",paths:["M12 8c-5-8-11 0-5 4-6 4 0 12 5 4 5 8 11 0 5-4 6-4 0-12-5-4Z","M14 12a2 2 0 1 1-4 0 2 2 0 0 1 4 0"]},
 {id:"heart",label:"Coração",paths:["M20.8 4.6a5.5 5.5 0 0 0-7.8 0L12 5.7l-1.1-1.1a5.5 5.5 0 0 0-7.8 7.8L12 21l8.8-8.6a5.5 5.5 0 0 0 0-7.8Z"]},
 {id:"coffee",label:"Café",paths:["M18 8h1a3 3 0 1 1 0 6h-1","M3 8h15v9a4 4 0 0 1-4 4H7a4 4 0 0 1-4-4Z","M6 2v2m4-2v2m4-2v2"]},
 {id:"book",label:"Livro",paths:["M12 7v14","M3 3h5a4 4 0 0 1 4 4 4 4 0 0 1 4-4h5v16h-5a4 4 0 0 0-4 2 4 4 0 0 0-4-2H3Z"]},
 {id:"feather",label:"Pena",paths:["M20.2 3.8a6 6 0 0 1 0 8.5L9 23H1v-8L11.7 3.8a6 6 0 0 1 8.5 0Z","M16 8 2 22m7-5h7"]},
 {id:"map",label:"Mapa",paths:["m3 6 6-3 6 3 6-3v15l-6 3-6-3-6 3Z","M9 3v15m6-12v15"]},
 {id:"leaf",label:"Folha",paths:["M20 3c-8 0-16 1-16 9a7 7 0 0 0 14 0c0-3 0-6 2-9Z","M4 21c0-6 4-10 10-13"]},
 {id:"zap",label:"Raio",paths:["m13 2-9 12h7l-1 8 10-12h-7Z"]},
] as const;
const legacy:Record<string,string>={"✦":"sparkles","☾":"moon","❀":"flower","♡":"heart","☕":"coffee","📖":"book","🪶":"feather","🗺️":"map","🗺":"map","🌿":"leaf","⚡":"zap"};
export function notebookIcon(value:string){const id=legacy[value]||value;return NOTEBOOK_ICONS.find(icon=>icon.id===id)||NOTEBOOK_ICONS[0];}
