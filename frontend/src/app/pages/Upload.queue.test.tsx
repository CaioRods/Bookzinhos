// @vitest-environment jsdom
import "@testing-library/jest-dom/vitest";
import React from "react";
import { act, cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { MemoryRouter } from "react-router";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
const mocks = vi.hoisted(() => ({ prepare: vi.fn(), upload: vi.fn(), progress: vi.fn() }));
vi.mock("../lib/prepareBook", () => ({ prepareBook: mocks.prepare }));
vi.mock("../lib/api", () => ({ uploadBook: mocks.upload, saveProgress: mocks.progress }));
vi.mock("../components/SeriesField", () => ({ SeriesField: () => null }));
vi.mock("../components/BookMetadataLookup", () => ({ BookMetadataLookup: () => null }));
vi.mock("../components/AuthorField", () => ({ AuthorField: ({value,onChange}:any) => <label>Autor<input value={value} onChange={event=>onChange(event.target.value)} /></label> }));
import { Upload } from "./Upload";
beforeEach(() => {
  vi.clearAllMocks();
  mocks.prepare.mockImplementation(async file => ({file,cover:null,pageCount:5,title:file.name.replace(/\.(pdf|epub)$/,''),author:'Autora',description:'',genres:['Fantasia']}));
  mocks.upload.mockImplementation(async data => ({id:`created-${mocks.upload.mock.calls.length}`,title:data.title}));
  mocks.progress.mockResolvedValue({});
});
afterEach(cleanup);
function setup(files = [new File(['one'],'Primeiro.pdf'),new File(['two'],'Segundo.pdf')]) {
  const view=render(<MemoryRouter><Upload /></MemoryRouter>);
  const input=view.container.querySelector('input[type=file]')!;
  expect(input).toHaveAttribute('multiple'); fireEvent.change(input,{target:{files}}); return view;
}
const publish=()=>screen.getByRole('button',{name:'Confirmar, publicar e ir ao próximo'});
it('prepares sequentially, shows real progress and resets the next draft only after confirmed publication',async()=>{
  let finish!: (book:unknown)=>void;
  mocks.upload.mockImplementationOnce(()=>new Promise(resolve=>{finish=resolve;}));
  setup();await waitFor(()=>expect(screen.getByLabelText('Título')).toHaveValue('Primeiro'));
  fireEvent.change(screen.getByLabelText('Sinopse'),{target:{value:'Sinopse somente do primeiro'}});
  fireEvent.click(screen.getByRole('button',{name:'Romance'}));
  const button = publish(); fireEvent.click(button);fireEvent.click(button);
  expect(mocks.upload).toHaveBeenCalledOnce();expect(mocks.prepare).toHaveBeenCalledOnce();
  expect(screen.getByRole('dialog')).toHaveTextContent('Publicando livro 1 de 2');
  expect(screen.getByRole('dialog')).toHaveTextContent('0 de 2 adicionados');
  await act(async()=>finish({id:'first',title:'Primeiro'}));
  await waitFor(()=>expect(screen.getByLabelText('Título')).toHaveValue('Segundo'));
  expect(screen.getByLabelText('Sinopse')).toHaveValue('');
  expect(screen.getByRole('button',{name:'Romance'})).toHaveAttribute('aria-pressed','false');
  expect(mocks.prepare).toHaveBeenCalledTimes(2);
  fireEvent.click(publish());await screen.findByText('2 livros adicionados ao acervo');
  expect(mocks.upload).toHaveBeenCalledTimes(2);expect(mocks.progress).toHaveBeenCalledTimes(2);
});
it('retains the current form on failure and reuses its request ID when retried',async()=>{
  mocks.upload.mockRejectedValueOnce(new Error('Falha de rede'));
  setup();await waitFor(()=>expect(screen.getByLabelText('Título')).toHaveValue('Primeiro'));
  fireEvent.click(publish());expect(await screen.findByRole('alert')).toHaveTextContent('Falha de rede');
  expect(screen.getByLabelText('Título')).toHaveValue('Primeiro');expect(mocks.prepare).toHaveBeenCalledOnce();
  fireEvent.click(publish());await waitFor(()=>expect(screen.getByLabelText('Título')).toHaveValue('Segundo'));
  expect(mocks.upload.mock.calls[0][0].uploadRequestId).toBe(mocks.upload.mock.calls[1][0].uploadRequestId);
});
it('does not publish twice when saving initial progress fails',async()=>{
  mocks.progress.mockRejectedValueOnce(new Error('Progress unavailable'));
  setup();await waitFor(()=>expect(screen.getByLabelText('Título')).toHaveValue('Primeiro'));fireEvent.click(publish());
  await waitFor(()=>expect(screen.getByLabelText('Título')).toHaveValue('Segundo'));
  expect(screen.getByText(/foi publicado, mas não foi possível marcar/)).toBeInTheDocument();
  expect(mocks.upload).toHaveBeenCalledOnce();
});
it('allows skipping a failed conversion and counts only the successfully added book',async()=>{
  mocks.prepare.mockRejectedValueOnce(new Error('EPUB inválido'));
  setup([new File(['bad'],'Falhou.epub'),new File(['ok'],'Segundo.pdf')]);
  expect(await screen.findByRole('alert')).toHaveTextContent('EPUB inválido');fireEvent.click(screen.getByRole('button',{name:'Pular livro'}));
  await waitFor(()=>expect(screen.getByLabelText('Título')).toHaveValue('Segundo'));fireEvent.click(publish());
  await screen.findByText('1 livro adicionado ao acervo');expect(mocks.upload).toHaveBeenCalledOnce();
});
it('automatically fills synopsis even with embedded genres and fetches Open Library details', async()=>{
  const metadata={id:'/works/OL123W',source:'openlibrary',sourceUrl:'https://openlibrary.org/works/OL123W',title:'Primeiro',authors:['Autora'],description:'',genres:[],publisher:'',publishedYear:'',pageCount:null,isbn:null};
  const fetcher=vi.fn(async (url:unknown)=>({ok:true,json:async()=>String(url).includes('/openlibrary/OL123W') ? {description:'Sinopse completa encontrada',genres:['Romance']} : String(url).includes('source=google') ? [] : [metadata]}));
  vi.stubGlobal('fetch',fetcher);
  try {
    setup();
    await waitFor(()=>expect(screen.getByLabelText('Sinopse')).toHaveValue('Sinopse completa encontrada'));
    expect(screen.getByRole('button',{name:'Fantasia'})).toHaveAttribute('aria-pressed','true');
    expect(fetcher.mock.calls.some(([url])=>String(url).includes('/openlibrary/OL123W'))).toBe(true);
  } finally {vi.unstubAllGlobals();}
});
it('fills missing genres from the fallback and preserves a synopsis typed during lookup',async()=>{
  let resolveGoogle!:(value:unknown)=>void;
  vi.stubGlobal('fetch',vi.fn(async(url:unknown)=>({ok:true,json:async()=>String(url).includes('source=google') ? (String(url).includes('author=Autora') ? await new Promise(resolve=>{resolveGoogle=resolve;}) : []) : String(url).includes('/openlibrary/OL456W') ? {description:'Sinopse externa',genres:['Romance']} : [{id:'/works/OL456W',source:'openlibrary',title:'Primeiro',authors:['Autora'],description:'',genres:[]}]})));
  mocks.prepare.mockImplementation(async file=>({file,cover:null,pageCount:5,title:'Primeiro',author:'Autora',description:'',genres:[]}));
  try {
    setup();await waitFor(()=>expect(resolveGoogle).toBeTypeOf('function'));
    fireEvent.change(screen.getByLabelText('Sinopse'),{target:{value:'Minha sinopse'}});
    await act(async()=>resolveGoogle([]));
    await waitFor(()=>expect(screen.getByRole('button',{name:'Romance'})).toHaveAttribute('aria-pressed','true'));
    expect(screen.getByLabelText('Sinopse')).toHaveValue('Minha sinopse');
  } finally {vi.unstubAllGlobals();}
});
it('fills the reported title when a catalog edition has a series subtitle and inverted author',async()=>{
  mocks.prepare.mockImplementation(async file=>({file,cover:null,pageCount:5,title:'Os Garotos Corvos',author:'Maggie Stiefvater',description:'',genres:[]}));
  vi.stubGlobal('fetch',vi.fn(async()=>({ok:true,json:async()=>[{id:'edition-test',source:'google',title:'Os garotos corvos - A saga dos corvos',authors:['Stiefvater, Maggie'],description:'Descrição de teste da edição',genres:['Fantasia','Young adult']}]})));
  try {setup();await waitFor(()=>expect(screen.getByLabelText('Sinopse')).toHaveValue('Descrição de teste da edição'));
    expect(screen.getByRole('button',{name:'Fantasia'})).toHaveAttribute('aria-pressed','true');
    expect(screen.getByRole('button',{name:'Young adult'})).toHaveAttribute('aria-pressed','true');
  }finally{vi.unstubAllGlobals();}
});
it('shows an unavailable server route rather than claiming that the book was not found',async()=>{
  vi.stubGlobal('fetch',vi.fn(async()=>({ok:false,status:404,json:async()=>({})})));
  try {setup();await screen.findByText(/É necessário atualizar também o servidor/);
    expect(screen.getByRole('button',{name:'Tentar preenchimento automático novamente'})).toBeEnabled();
  }finally{vi.unstubAllGlobals();}
});
