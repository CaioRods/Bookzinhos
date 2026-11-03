import { PDFDocument, rgb, type PDFFont } from "pdf-lib";
import fontkit from "@pdf-lib/fontkit";
import regular from "../../../assets/epub-fonts/DejaVuSerif.ttf?url";
import bold from "../../../assets/epub-fonts/DejaVuSerif-Bold.ttf?url";
import italic from "../../../assets/epub-fonts/DejaVuSerif-Italic.ttf?url";
import boldItalic from "../../../assets/epub-fonts/DejaVuSerif-BoldItalic.ttf?url";
import sansRegular from "../../../assets/epub-fonts/DejaVuSans.ttf?url";
import sansBold from "../../../assets/epub-fonts/DejaVuSans-Bold.ttf?url";
import sansItalic from "../../../assets/epub-fonts/DejaVuSans-Oblique.ttf?url";
import sansBoldItalic from "../../../assets/epub-fonts/DejaVuSans-BoldOblique.ttf?url";
import monoRegular from "../../../assets/epub-fonts/DejaVuSansMono.ttf?url";
import monoBold from "../../../assets/epub-fonts/DejaVuSansMono-Bold.ttf?url";
import monoItalic from "../../../assets/epub-fonts/DejaVuSansMono-Oblique.ttf?url";
import monoBoldItalic from "../../../assets/epub-fonts/DejaVuSansMono-BoldOblique.ttf?url";
import { coverLayout } from "./coverLayout";
import { notebookIcon } from "./icons";
import { imageData } from "./images";
import { coverInk, PAPER_GRID, textBaseline, textVisibleLines, paperColor, strokePath, wrapText, type Notebook, type NotebookPage } from "./model";
const ink=(hex:string)=>rgb(parseInt(hex.slice(1,3),16)/255,parseInt(hex.slice(3,5),16)/255,parseInt(hex.slice(5,7),16)/255);
export async function exportNotebookPdf(notebook:Notebook,pages:NotebookPage[]|AsyncIterable<NotebookPage>,includeCover:boolean,progress:(n:number)=>void=()=>{},pageCount=Array.isArray(pages)?pages.length:1){
 const pdf=await PDFDocument.create();pdf.registerFontkit(fontkit);pdf.setTitle(notebook.name);pdf.setCreator("Bookzinhos · Anotações");
 const urls={serif:[regular,bold,italic,boldItalic],sans:[sansRegular,sansBold,sansItalic,sansBoldItalic],mono:[monoRegular,monoBold,monoItalic,monoBoldItalic]};
 const requested=new Map<string,Promise<PDFFont>>();
 const fontFor=(family:keyof typeof urls,index:number)=>{const url=urls[family][index];if(!requested.has(url))requested.set(url,(async()=>{const response=await fetch(url);if(!response.ok)throw new Error("As fontes não estão instaladas neste aparelho. Abra o app com conexão para atualizar o modo offline.");return pdf.embedFont(await response.arrayBuffer(),{subset:true});})());return requested.get(url)!;};
 const fonts=await Promise.all([fontFor("serif",0),fontFor("serif",1)]);
 const clean=(value:string,font:PDFFont)=>{const chars=new Set(font.getCharacterSet());return [...value].map(char=>char==="\n"||chars.has(char.codePointAt(0)!)?char:"□").join("");};
 const embed=async(src:string)=>{const image=await imageData(src,undefined,1800,"auto-pdf");return image.src.startsWith("data:image/png")?pdf.embedPng(image.src):pdf.embedJpg(image.src);};
 if(includeCover){
  const scale=800/520,height=720*scale,cover=pdf.addPage([800,height]),layout=coverLayout(notebook.coverLayout,notebook.color);
  cover.drawRectangle({x:0,y:0,width:800,height,color:ink(notebook.color)});if(notebook.image){const image=await embed(notebook.image);cover.drawImage(image,{x:0,y:0,width:800,height});}
  const icon=layout.icon;for(const path of notebookIcon(notebook.icon).paths)cover.drawSvgPath(path,{x:icon.x*scale,y:height-icon.y*scale,scale:icon.size/24*scale,borderColor:ink(icon.color),borderWidth:1.7});
  for(const key of ["title","description"] as const){const item=layout[key],font=await fontFor(key==="title"?"serif":"sans",0),text=clean(key==="title"?notebook.name:notebook.description||"ANOTAÇÕES",font),lines=wrapText(text,item.width,item.size);lines.forEach((line,index)=>cover.drawText(line,{x:item.x*scale,y:height-(item.y+item.size+index*item.size*1.25)*scale,size:item.size*scale,font,color:ink(item.color)}));}
 }

 const images=new Map<string,any>();
 let index=0;
 for await(const source of pages){
  const page=pdf.addPage([800,1100]);page.drawRectangle({x:0,y:0,width:800,height:1100,color:ink(paperColor(source.paper))});
  if(source.paper==="ruled"){for(let y=PAPER_GRID.first;y<1100;y+=PAPER_GRID.step)page.drawLine({start:{x:0,y:1100-y},end:{x:800,y:1100-y},thickness:.8,color:ink('#a5bfc5'),opacity:.55});page.drawLine({start:{x:62,y:0},end:{x:62,y:1100},thickness:1,color:ink('#c47b76'),opacity:.6});}
  if(source.paper==="parchment")for(let i=0;i<12;i++)page.drawRectangle({x:i*2,y:i*2,width:800-i*4,height:1100-i*4,borderColor:ink('#a47436'),borderWidth:2,opacity:.018});
  for(const element of source.elements){
   if(element.type==="stroke"){page.drawSvgPath(strokePath(element.points),{x:0,y:1100,borderColor:ink(element.color),borderWidth:element.width,borderOpacity:element.opacity});continue;}
   if(element.type==="image"){const digest=await crypto.subtle.digest("SHA-256",new TextEncoder().encode(element.src)),key=Array.from(new Uint8Array(digest)).map(n=>n.toString(16).padStart(2,"0")).join("");let image=images.get(key);if(!image){image=await embed(element.src);images.set(key,image);}page.drawImage(image,{x:element.x,y:1100-element.y-element.height,width:element.width,height:element.height});if(element.source){const label=`${element.source.title} · p. ${element.source.page}`;page.drawText(clean(label,fonts[0]),{x:element.x,y:Math.max(8,1090-element.y-element.height),size:9,font:fonts[0],color:ink('#657b72')});}continue;}
   const font=await fontFor(element.font,(element.bold?1:0)+(element.italic?2:0)),text=clean(element.text,font);const lines=wrapText(text,element.width-8,element.size,s=>font.widthOfTextAtSize(s,element.size));
   lines.slice(0,textVisibleLines(element)).forEach((line,i)=>{const length=font.widthOfTextAtSize(line,element.size),x=element.x+(element.align==="center"?(element.width-length)/2:element.align==="right"?element.width-length-4:4),y=1100-textBaseline(element,i);page.drawText(line,{x,y,size:element.size,font,color:ink(element.color)});if(element.underline)page.drawLine({start:{x,y:y-2},end:{x:x+length,y:y-2},thickness:.8,color:ink(element.color)});});
  }
  progress(++index/Math.max(1,pageCount));await new Promise(resolve=>setTimeout(resolve,0));
 }
 return new Blob([new Uint8Array(await pdf.save())],{type:"application/pdf"});
}
