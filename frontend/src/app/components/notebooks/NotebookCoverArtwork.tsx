import type { Notebook } from "../../lib/notebooks/model";
import { fontFamily,wrapText } from "../../lib/notebooks/model";
import { coverLayout,type CoverLayout } from "../../lib/notebooks/coverLayout";
import { notebookIcon } from "../../lib/notebooks/icons";
import { imageCropRect } from "../../lib/imageCrop";
import type { ImageCrop } from "../../lib/appearance";
import type { PointerEvent } from "react";
export function NotebookCoverArtwork({notebook,onItem,selected,preview}:{preview?:{src:string;width:number;height:number;crop:ImageCrop};notebook:Notebook;onItem?:(key:keyof CoverLayout,event:PointerEvent<SVGGElement>)=>void;selected?:keyof CoverLayout}){
 const rect=preview?imageCropRect(preview,{width:520,height:720},preview.crop):null;
 const layout=coverLayout(notebook.coverLayout,notebook.color);
 return <svg className="nb-cover-artwork" viewBox="0 0 520 720" aria-hidden={!onItem} role={onItem?"group":undefined} aria-label={onItem?"Posicionar elementos da capa":undefined}>
 <rect width="520" height="720" fill={notebook.color}/>{preview&&rect?<svg width="520" height="720" viewBox={`${rect.left} ${rect.top} ${rect.width} ${rect.height}`} preserveAspectRatio="none"><image href={preview.src} width={preview.width} height={preview.height}/></svg>:notebook.image&&<image href={notebook.image} width="520" height="720" preserveAspectRatio="none"/>}
 {(["title","description","icon"] as const).map(key=>{const item=layout[key],lines=key==="icon"?[]:wrapText(key==="title"?notebook.name||"Meu caderno":notebook.description||"ANOTAÇÕES",item.width,item.size);return <g key={key} data-cover-item={key} onPointerDown={event=>onItem?.(key,event)} style={{cursor:onItem?"move":undefined,touchAction:onItem?"none":undefined}}>
 {key==="icon"?<g transform={`translate(${item.x} ${item.y}) scale(${item.size/24})`} fill="none" stroke={item.color} strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round">{notebookIcon(notebook.icon).paths.map((d,i)=><path key={i} d={d}/>)}</g>:<text fill={item.color} fontSize={item.size} fontFamily={fontFamily(key==="title"?"serif":"sans")}><tspan x={item.x} y={item.y+item.size}>{lines[0]}</tspan>{lines.slice(1).map((line,i)=><tspan key={i} x={item.x} dy={item.size*1.25}>{line}</tspan>)}</text>}
 {onItem&&<rect x={item.x} y={item.y} width={key==="icon"?item.size:item.width} height={key==="icon"?item.size:Math.max(item.size*1.3,lines.length*item.size*1.25)} fill="transparent" stroke={selected===key?"#7baca3":"transparent"} strokeWidth="2" strokeDasharray="6 5"/>}
 </g>;})}</svg>;
}
