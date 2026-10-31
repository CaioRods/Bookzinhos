// @vitest-environment jsdom
import React from 'react';
import { it, expect, vi, afterEach } from 'vitest';
import { render, screen, fireEvent, cleanup } from '@testing-library/react';
import { ReadingActions } from './ReadingActions';
import type { Book, Note } from '../lib/types';
vi.mock('../lib/session',()=>({getUsername:()=> 'Ana'}));
vi.mock('./Ui',()=>({toast:vi.fn(),Modal:({open,children,footer,title}:any)=>open?<div role="dialog"><h2>{title}</h2>{children}{footer}</div>:null}));
afterEach(cleanup);
const book={id:'a',title:'Meu livro',author:'Autor',description:'Sinopse',isPublic:true} as Book;
it('exports a reviewed Markdown file and private notes require opt-in',()=>{
 const create=vi.fn(()=> 'blob:test');Object.defineProperty(URL,'createObjectURL',{value:create,configurable:true});Object.defineProperty(URL,'revokeObjectURL',{value:vi.fn(),configurable:true});
 vi.spyOn(HTMLAnchorElement.prototype,'click').mockImplementation(()=>{});
 render(<ReadingActions title={book.title} books={[book]} notes={[{bookId:'a',username:'Ana',feedback:'Anotação privada',rating:4,date:'Hoje'} as Note]}/>);
 fireEvent.click(screen.getByText('Exportar Markdown'));
 expect(screen.getByLabelText('Prévia Markdown').textContent).not.toContain('Anotação privada');
 fireEvent.click(screen.getByLabelText('Incluir minhas anotações e notas pessoais'));
 expect(screen.getByLabelText('Prévia Markdown').textContent).toContain('Anotação privada');
 fireEvent.click(screen.getByText('Baixar .md'));expect(create).toHaveBeenCalled();
});
it('calendar validates before download and private books have no external share',()=>{
 render(<ReadingActions title={book.title} books={[book]} shareBook={{...book,isPublic:false}}/>);
 expect(screen.queryByText('Compartilhar link')).toBeNull();
 fireEvent.click(screen.getByText('Agendar leitura'));fireEvent.click(screen.getByText('Baixar .ics'));
 expect(screen.getByRole('alert').textContent).toContain('data');
 fireEvent.change(screen.getByLabelText('Data e horário'),{target:{value:'2026-11-02T10:00'}});
 fireEvent.click(screen.getByText('Baixar .ics'));expect(screen.queryByRole('alert')).toBeNull();
});
