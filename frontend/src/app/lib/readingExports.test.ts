import { describe, it, expect, vi, afterEach } from 'vitest';
import ICAL from 'ical.js';
import { calendarIcs, readingMarkdown, shareReading } from './readingExports';
import type { Note } from './types';
afterEach(()=>vi.unstubAllGlobals());
describe('calendar export',()=>{
 it('round trips escaped Unicode with an independent RFC parser and folds by bytes',()=>{
  const title='Leitura, coração; \\ páginas\n'+ '📚 Olá '.repeat(40);
  const start=new Date('2026-11-01T09:30:00-03:00');
  const content=calendarIcs(title,start,45,'Linha 1\nLinha 2','test',new Date('2026-01-01T00:00:00Z'));
  for(const line of content.split('\r\n'))expect(new TextEncoder().encode(line).length).toBeLessThanOrEqual(75);
  const event=new ICAL.Event(new ICAL.Component(ICAL.parse(content)).getFirstSubcomponent('vevent')!);
  expect(event.summary).toBe(title);expect(event.description).toBe('Linha 1\nLinha 2');
  expect(event.startDate.toJSDate().toISOString()).toBe('2026-11-01T12:30:00.000Z');
  expect(event.endDate.toJSDate().getTime()-event.startDate.toJSDate().getTime()).toBe(45*60000);
 });
 it('rejects invalid input and event injection remains text',()=>{
  for(const duration of [0,-1,1441,NaN,1.5])expect(()=>calendarIcs('x',new Date(),duration)).toThrow();
  expect(()=>calendarIcs('x',new Date('invalid'),30)).toThrow();
  expect(()=>calendarIcs('',new Date(),30)).toThrow();
  const component=new ICAL.Component(ICAL.parse(calendarIcs('a\nEND:VEVENT\nBEGIN:VEVENT',new Date(),30)));
  expect(component.getAllSubcomponents('vevent')).toHaveLength(1);
 });
});
it('Markdown excludes private notes by default, filters ownership and escapes markup',()=>{
 const books=[{id:'a',title:'<script> *x*',author:'A',description:'secret synopsis',isPublic:false}];
 const notes=[{bookId:'a',username:'Ana',feedback:'my note',rating:5,date:'Hoje'},{bookId:'a',username:'Other',feedback:'other secret'},{bookId:'b',username:'Ana',feedback:'wrong book'},{bookId:'a',feedback:'unknown owner'}] as Note[];
 const base=readingMarkdown('Lista',books,'https://mybooks.test',false,notes,'Ana');
 expect(base).not.toContain('my note');expect(base).not.toContain('/book/');expect(base).not.toContain('secret synopsis');expect(base).toContain('&lt;script&gt;');
 const selected=readingMarkdown('Lista',books,'https://mybooks.test',true,notes,'ana',true);
 expect(selected).toContain('my note');expect(selected).not.toContain('other secret');expect(selected).not.toContain('wrong book');expect(selected).not.toContain('unknown owner');
});
it('native sharing cancels quietly and unsupported devices copy links',async()=>{
 const writeText=vi.fn().mockResolvedValue(undefined);
 vi.stubGlobal('navigator',{share:vi.fn().mockRejectedValue(new DOMException('cancel','AbortError')),clipboard:{writeText}});
 expect(await shareReading({url:'https://mybooks.test/book/a'})).toBe('cancelled');expect(writeText).not.toHaveBeenCalled();
 vi.stubGlobal('navigator',{clipboard:{writeText}});
 expect(await shareReading({url:'https://mybooks.test/book/a'})).toBe('copied');expect(writeText).toHaveBeenCalledWith('https://mybooks.test/book/a');
});

it('builds personalized share links with encoded IDs and a stable title slug',async()=>{
 const {publicBookShareUrl}=await import('./readingExports');
 expect(publicBookShareUrl('https://mybooks.test',{id:'id/1',title:'O Príncipe Cruel!'})).toBe('https://mybooks.test/share/book/id%2F1/o-principe-cruel');
 expect(publicBookShareUrl('http://localhost:5173',{id:'a',title:'📚'})).toBe('http://localhost:3001/share/book/a/livro');
});
