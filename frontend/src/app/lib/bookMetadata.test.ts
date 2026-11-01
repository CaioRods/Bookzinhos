import {expect,it} from 'vitest';
import {automaticGenres,localGenres,type BookMetadata} from './bookMetadata';
import {filenameMetadata} from './prepareBook';
const book=(title:string,author:string,genres=['Fantasia']):BookMetadata=>({id:'x',source:'google',sourceUrl:'https://books.google.com',title,authors:[author],genres,description:'',publisher:'',publishedYear:'',pageCount:null,isbn:null});
it('fills automatic genres only for an exact, unambiguous title and author',()=>{
 expect(automaticGenres([book('História','Autora')],'HISTORIA','Autora')).toEqual(['Fantasia']);
 expect(automaticGenres([book('Outra obra','Autora')],'História','Autora')).toEqual([]);
 expect(automaticGenres([book('História','Autora'),book('História','Outro autor')],'História','')).toEqual([]);
});
it('recognizes file genres and title-author filenames without replacing unknown subjects',()=>{
 expect(localGenres(['Fiction / Fantasy','Romance'])).toEqual(['Fantasia','Romance']);
 expect(localGenres('tag desconhecida')).toEqual([]);
 expect(filenameMetadata('História - Autora.pdf')).toEqual({title:'História',author:'Autora'});
});
