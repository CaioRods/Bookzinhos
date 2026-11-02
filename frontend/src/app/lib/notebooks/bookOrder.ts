import type { Book,ReadingProgress } from "../types";
export function orderExcerptBooks(books:Book[],progress:ReadingProgress[]){
 const dates=new Map<string,number>();
 for(const item of progress)if(item.status!=="ler-depois"&&item.lastReadAt>0)dates.set(item.bookId,Math.max(item.lastReadAt,dates.get(item.bookId)||0));
 return [...books].sort((a,b)=>(dates.get(b.id)||b.lastReadAt||0)-(dates.get(a.id)||a.lastReadAt||0)||a.title.localeCompare(b.title,"pt-BR"));
}
