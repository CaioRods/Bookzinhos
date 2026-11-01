// @vitest-environment jsdom
import '@testing-library/jest-dom/vitest';
import React from 'react';
import {cleanup,fireEvent,render,screen} from '@testing-library/react';
import {afterEach,expect,it,vi} from 'vitest';
import type {Book} from '../lib/types';
vi.mock('./BookCard',()=>({BookCard:({book}:any)=><div>{book.title}</div>}));
import {BookGrid} from './BookGrid';
afterEach(cleanup);
it('limits the initial catalog DOM and expands it on demand without hiding filtered results',()=>{
 const books=Array.from({length:145},(_,i)=>({id:String(i),title:`Book ${i}`} as Book));
 const view=render(<BookGrid books={books}/>);
 expect(screen.getByText('Book 59')).toBeInTheDocument();expect(screen.queryByText('Book 60')).toBeNull();
 fireEvent.click(screen.getByRole('button',{name:'Mostrar mais livros (85)'}));expect(screen.getByText('Book 119')).toBeInTheDocument();
 view.rerender(<BookGrid books={[books[144]]}/>);expect(screen.getByText('Book 144')).toBeInTheDocument();expect(screen.queryByRole('button')).toBeNull();
});
