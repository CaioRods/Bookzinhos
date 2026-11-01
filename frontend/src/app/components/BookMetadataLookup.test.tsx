// @vitest-environment jsdom
import '@testing-library/jest-dom/vitest';
import React from 'react';
import {cleanup,fireEvent,render,screen,waitFor} from '@testing-library/react';
import {afterEach,beforeEach,expect,it,vi} from 'vitest';
const mocks=vi.hoisted(()=>({search:vi.fn(),detail:vi.fn()}));
vi.mock('../lib/bookMetadata',async original=>({...await original<object>(),searchBookMetadata:mocks.search,openLibraryDetails:mocks.detail}));
import {BookMetadataLookup} from './BookMetadataLookup';
const book={id:'edition1',source:'google' as const,sourceUrl:'https://books.google.com/books?id=edition1',title:'Título correto',authors:['Autora correta'],description:'Sinopse encontrada',genres:['Fantasia'],publisher:'Editora',publishedYear:'2020',pageCount:250,isbn:'0306406152'};
const current={title:'Título manual',author:'Autor manual',description:'',genre:'Outros',publisher:'',publishedYear:''};
beforeEach(()=>{vi.clearAllMocks();mocks.search.mockResolvedValue([book]);});afterEach(cleanup);
it('previews fields and does not overwrite manual title and author by default',async()=>{
 const apply=vi.fn();render(<BookMetadataLookup current={current} onApply={apply}/>);
 fireEvent.click(screen.getByRole('button',{name:'Buscar dados do livro'}));fireEvent.change(screen.getByRole('textbox',{name:'Título ou ISBN'}),{target:{value:'Consulta nova'}});expect(mocks.search).not.toHaveBeenCalled();
 fireEvent.click(screen.getByRole('button',{name:'Buscar'}));fireEvent.click(await screen.findByRole('button',{name:/Título correto/}));
 const title=await screen.findByRole('checkbox',{name:/^Título/});expect(title).not.toBeChecked();expect(screen.getByRole('checkbox',{name:/^Autor/})).not.toBeChecked();
 fireEvent.click(screen.getByRole('button',{name:'Aplicar selecionados'}));
 expect(apply).toHaveBeenCalledWith(expect.objectContaining({description:'Sinopse encontrada',genre:'Fantasia'}),book);
 expect(apply.mock.calls[0][0]).not.toHaveProperty('title');expect(apply.mock.calls[0][0]).not.toHaveProperty('author');
});
it('allows explicitly replacing an existing field and keeps errors recoverable',async()=>{
 const apply=vi.fn();render(<BookMetadataLookup current={current} onApply={apply}/>);fireEvent.click(screen.getByRole('button',{name:'Buscar dados do livro'}));
 mocks.search.mockRejectedValueOnce(new Error('Limite do catálogo'));fireEvent.click(screen.getByRole('button',{name:'Buscar'}));expect(await screen.findByRole('alert')).toHaveTextContent('Limite do catálogo');expect(apply).not.toHaveBeenCalled();
 fireEvent.click(screen.getByRole('button',{name:'Buscar'}));fireEvent.click(await screen.findByRole('button',{name:/Título correto/}));
 fireEvent.click(await screen.findByRole('checkbox',{name:/^Título/}));fireEvent.click(screen.getByRole('button',{name:'Aplicar selecionados'}));
 expect(apply.mock.calls[0][0].title).toBe('Título correto');
});
