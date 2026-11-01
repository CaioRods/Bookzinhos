// @vitest-environment jsdom
import "@testing-library/jest-dom/vitest";
import React,{useState} from 'react';
import {cleanup,fireEvent,render,screen,waitFor} from '@testing-library/react';
import {afterEach,beforeEach,expect,it,vi} from 'vitest';
const mocks=vi.hoisted(()=>({fetch:vi.fn()}));
vi.mock('../lib/authors',async original=>({...await original<object>(),fetchAuthors:mocks.fetch}));
import {AuthorField} from './AuthorField';
const records=[{id:'one',name:'José Saramago',bookCount:2,books:[{id:'b1',title:'Livro um',coverImagePath:'/cover1.jpg'},{id:'b2',title:'Livro dois',coverImagePath:'/cover2.jpg'}]},{id:'two',name:'Outra autora',bookCount:0,books:[]}];
beforeEach(()=>{mocks.fetch.mockReset();mocks.fetch.mockResolvedValue(records);});afterEach(cleanup);
function Form(){const[value,set]=useState('');return <AuthorField value={value} onChange={set}/>;}
it('searches existing authors without accents, selects a name and shows linked covers',async()=>{
 render(<Form/>);fireEvent.click(screen.getByRole('button',{name:'Selecionar autor cadastrado'}));
 await screen.findByRole('button',{name:/José Saramago/});fireEvent.change(screen.getByRole('textbox',{name:'Pesquisar autores'}),{target:{value:'JOSE'}});
 expect(screen.queryByRole('button',{name:/Outra autora/})).not.toBeInTheDocument();
 fireEvent.click(screen.getByRole('button',{name:/José Saramago/}));
 expect(screen.getByLabelText('Autor')).toHaveValue('José Saramago');expect(screen.getByAltText('Capa de Livro um')).toBeInTheDocument();expect(screen.getByAltText('Capa de Livro dois')).toBeInTheDocument();
 expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
});
it('keeps manual author input available when the registry fails and supports retry',async()=>{
 mocks.fetch.mockRejectedValueOnce(new Error('Indisponível'));
 render(<Form/>);fireEvent.change(screen.getByLabelText('Autor'),{target:{value:'Autor digitado'}});fireEvent.click(screen.getByRole('button',{name:'Selecionar autor cadastrado'}));
 expect(await screen.findByRole('alert')).toHaveTextContent('Indisponível');fireEvent.click(screen.getByRole('button',{name:'Tentar novamente'}));
 await screen.findByRole('button',{name:/José Saramago/});expect(screen.getByLabelText('Autor')).toHaveValue('Autor digitado');
});
