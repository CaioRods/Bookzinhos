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
it('matches the reported book with edition labels, subtitles and inverted author name',()=>{
 expect(automaticGenres([book('Os garotos corvos (Vol. 1)','Stiefvater, Maggie')],'Os Garotos Corvos','Maggie Stiefvater')).toEqual(['Fantasia']);
 expect(automaticGenres([book('Os garotos corvos: A saga dos corvos','Maggie Stiefvater')],'Os Garotos Corvos','Maggie Stiefvater')).toEqual(['Fantasia']);
 const translated={...book('The Raven Boys','Maggie Stiefvater'),alternativeTitles:['Os garotos corvos']};
 expect(automaticGenres([translated],'Os Garotos Corvos','Maggie Stiefvater')).toEqual(['Fantasia']);
 expect(automaticGenres([book('Os garotos corvos (Vol. 2)','Maggie Stiefvater')],'Os Garotos Corvos','Maggie Stiefvater')).toEqual([]);
 expect(automaticGenres([book('Os garotos corvos','Outra pessoa')],'Os Garotos Corvos','Maggie Stiefvater')).toEqual([]);
 expect(automaticGenres([book('The Raven Boys','Maggie Stiefvater')],'Os Garotos Corvos','Maggie Stiefvater')).toEqual([]);
});

it('accepts an edition subtitle only with confirmed author and tolerates translator credits',()=>{
 const edition=book('Os garotos corvos - A saga dos corvos','Maggie Stiefvater');
 expect(automaticGenres([edition,{...edition,authors:['Maggie Stiefvater','Tradutora']}],'Os Garotos Corvos','Maggie Stiefvater')).toEqual(['Fantasia']);
 expect(automaticGenres([edition],'Os Garotos Corvos','')).toEqual([]);
 expect(automaticGenres([book('Os Garotos Corvos: Livro 2','Maggie Stiefvater')],'Os Garotos Corvos','Maggie Stiefvater')).toEqual([]);
 expect(automaticGenres([book('Os Garotos Corvos (A saga dos corvos, #1)','Maggie Stiefvater')],'Os Garotos Corvos','Maggie Stiefvater')).toEqual(['Fantasia']);
});
