// @vitest-environment jsdom
import {afterEach,expect,it,vi} from 'vitest';
import {getSpineColor} from './coverColor';
afterEach(()=>{vi.unstubAllGlobals();vi.restoreAllMocks();localStorage.clear();});
it('uses the book ID endpoint and caches the real palette when image CORS fails',async()=>{
 class ImageFailure {set src(_url:string){queueMicrotask(()=>this.onerror?.());}onerror?:()=>void;}
 vi.stubGlobal('Image',ImageFailure);
 const palette={base:'#b4191e',shade:'#821216',tint:'#c3474b',ink:'#ffffff'};
 const fetch=vi.spyOn(globalThis,'fetch').mockResolvedValue(Response.json(palette));
 const [a,b]=await Promise.all([getSpineColor('https://covers.test/red.jpg',null,'book-red','book-red'),getSpineColor('https://covers.test/red.jpg',null,'book-red','book-red')]);
 expect(a).toEqual(palette);expect(b).toEqual(palette);expect(fetch).toHaveBeenCalledOnce();
 expect(String(fetch.mock.calls[0][0])).toContain('/books/book-red/cover-palette');expect(fetch.mock.calls[0][1]?.credentials).toBe('include');
 expect(await getSpineColor('https://covers.test/red.jpg',null,'book-red','book-red')).toEqual(palette);expect(fetch).toHaveBeenCalledOnce();
});
