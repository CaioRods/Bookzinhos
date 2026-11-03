import { readFileSync } from "node:fs";import path from "node:path";import { afterEach,expect,it,vi } from "vitest";import { PDFDocument,PDFName,PDFDict,PDFArray,PDFRawStream,decodePDFRawStream } from "pdf-lib";
import { exportNotebookPdf } from "./exportPdf";import { blankPage,type Notebook } from "./model";
afterEach(()=>vi.unstubAllGlobals());
it("exports Unicode text and handwriting as a real PDF with vector content and an optional cover",async()=>{
 vi.stubGlobal("fetch",vi.fn(async(url:string)=>{const file=path.basename(String(url).split('?')[0]);const data=readFileSync(path.resolve('src/assets/epub-fonts',file));return new Response(data,{status:200});}));
 const book:Notebook={id:'one',name:'Memórias e coração',description:'',color:'#567b70',image:'',icon:'✦',revision:'r1',updatedAt:1};const page=blankPage();page.elements=[{id:'pen',type:'stroke',points:[[60,80],[120,260],[200,300]],width:3,color:'#112233',opacity:1},{id:'text',type:'text',x:60,y:150,width:600,height:300,text:'Um pensamento com ação, emoção e memória.',size:22,color:'#112233',font:'sans',bold:true,italic:false,underline:false,align:'left'}];
 async function* leaves(){yield page;}
 const blob=await exportNotebookPdf(book,leaves(),true,()=>{},1),document=await PDFDocument.load(await blob.arrayBuffer());expect(document.getPageCount()).toBe(2);expect(document.getTitle()).toBe(book.name);const resources=document.getPages()[1].node.Resources()!;expect(resources.lookup(PDFName.of('Font'),PDFDict).keys().length).toBeGreaterThan(0);const images=resources.lookupMaybe(PDFName.of('XObject'),PDFDict);expect(images?.keys().length||0).toBe(0);
});

it.each(['plain','ruled','parchment'] as const)('exports text baselines on the same hidden grid for %s paper',async paper=>{
 vi.stubGlobal('fetch',vi.fn(async(url:string)=>new Response(readFileSync(path.resolve('src/assets/epub-fonts',path.basename(String(url).split('?')[0]))),{status:200})));
 const book:Notebook={id:'one',name:'Pauta',description:'',color:'#567b70',image:'',icon:'book',revision:'r1',updatedAt:1};const page=blankPage();page.paper=paper;
 page.elements=[{id:'text',type:'text',flow:'ruled',x:62,y:50,width:698,height:1050,text:'Primeira linha\nSegunda linha',size:22,color:'#112233',font:'sans',bold:false,italic:false,underline:false,align:'left'}];
 const blob=await exportNotebookPdf(book,[page],false),pdf=await PDFDocument.load(await blob.arrayBuffer()),streams=pdf.getPage(0).node.Contents() as PDFArray;
 const content=Array.from({length:streams.size()},(_,i)=>new TextDecoder().decode(decodePDFRawStream(streams.lookup(i,PDFRawStream)).decode())).join('');
 expect(content).toContain('1 0 0 1 66 1036 Tm');expect(content).toContain('1 0 0 1 66 1004 Tm');
});
