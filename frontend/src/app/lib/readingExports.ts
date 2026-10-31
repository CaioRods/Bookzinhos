import type { Book, Note } from './types';
export function calendarIcs(title: string, start: Date, minutes: number, description = '', uid: string = crypto.randomUUID(), now = new Date()) {
  if (!title.trim() || !Number.isFinite(start.getTime()) || !Number.isInteger(minutes) || minutes < 1 || minutes > 1440) throw new Error('Informe título, data válida e duração entre 1 e 1440 minutos.');
  const stamp = (date: Date) => date.toISOString().replace(/[-:]/g, '').replace(/\.\d{3}Z$/, 'Z');
  const escape = (value: string) => value.replace(/\\/g, '\\\\').replace(/\r\n|\r|\n/g, '\\n').replace(/;/g, '\\;').replace(/,/g, '\\,');
  const fold = (line: string) => { let result = '', size = 0; for (const char of line) { const bytes = new TextEncoder().encode(char).length; if (size + bytes > 75) { result += '\r\n '; size = 1; } result += char; size += bytes; } return result; };
  return ['BEGIN:VCALENDAR','VERSION:2.0','PRODID:-//myBooks//Leitura//PT','CALSCALE:GREGORIAN','BEGIN:VEVENT',`UID:${escape(uid)}@mybooks`,`DTSTAMP:${stamp(now)}`,`DTSTART:${stamp(start)}`,`DTEND:${stamp(new Date(start.getTime()+minutes*60000))}`,`SUMMARY:${escape(title)}`,`DESCRIPTION:${escape(description)}`,'END:VEVENT','END:VCALENDAR'].map(fold).join('\r\n')+'\r\n';
}
export const markdownText = (value: string) => value.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/([\\`*_{}\[\]()#+.!|~-])/g, '\\$1').replace(/\r\n|\r|\n/g, '  \n');
export function readingMarkdown(title: string, books: Pick<Book,'id'|'title'|'author'|'isPublic'|'description'>[], origin: string, descriptions = false, notes: Note[] = [], username = '', includeNotes = false) {
  const lines = [`# ${markdownText(title)}`, ''];
  for (const book of books) {
    lines.push(`## ${markdownText(book.title)}`, `Autor: ${markdownText(book.author)}`, '');
    if (book.isPublic) lines.push(`[Abrir no myBooks](${origin}/book/${encodeURIComponent(book.id).replace(/[()]/g, c => '%' + c.charCodeAt(0).toString(16))})`, '');
    if (descriptions) lines.push(markdownText(book.description || ''), '');
    if (includeNotes && username) for (const note of notes.filter(n => n.bookId === book.id && n.username?.toLowerCase() === username.toLowerCase())) lines.push(`### Anotação · ${markdownText(note.date || '')}`, `Nota pessoal: ${note.rating}/5`, markdownText(note.feedback || ''), '');
  }
  return lines.join('\n');
}
export async function shareReading(data: ShareData): Promise<'shared'|'copied'|'cancelled'> {
  if (navigator.share) { try { await navigator.share(data); return 'shared'; } catch (error) { if ((error as Error).name === 'AbortError') return 'cancelled'; if ((error as Error).name !== 'NotSupportedError') throw error; } }
  if (!data.url) throw new Error('Link indisponível.');
  await navigator.clipboard.writeText(data.url); return 'copied';
}
export function downloadReading(content: string, name: string, extension: 'ics'|'md') {
  const url=URL.createObjectURL(new Blob([content],{type:extension==='ics'?'text/calendar;charset=utf-8':'text/markdown;charset=utf-8'}));
  const anchor=document.createElement('a'); anchor.href=url; anchor.download=(name.replace(/[\\/:*?"<>|\u0000-\u001f]/g,' ').trim()||'leitura')+'.'+extension; document.body.append(anchor); anchor.click(); anchor.remove(); setTimeout(()=>URL.revokeObjectURL(url),4000);
}
