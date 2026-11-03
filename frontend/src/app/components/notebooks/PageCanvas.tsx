import { memo, useEffect, useRef, useState, type PointerEvent } from "react";
import { eraseElements } from "../../lib/notebooks/erase";
import { fontFamily, PAPER_GRID, ruledTextBox, snapTextY, textBaseline, textLineHeight, textVisibleLines, paperColor, strokePath, strokeHit, uid, wrapText, type Element, type ImageElement, type NotebookPage, type Point, type Stroke, type TextElement } from "../../lib/notebooks/model";
export type Tool = "hand" | "select" | "text" | "pen" | "marker" | "eraser";
export const PageArtwork = memo(function PageArtwork({page}:{page:NotebookPage}) {
  return <>{page.elements.map(element=><ElementArtwork key={element.id} element={element}/>)}</>;
});
const ElementArtwork=memo(function ElementArtwork({element:e}:{element:Element}) {
  const [,fontsReady]=useState(0);
  useEffect(()=>{if(e.type!=="text"||!document.fonts)return;let active=true;document.fonts.load(`${e.italic?"italic ":""}${e.bold?"bold ":""}${e.size}px ${fontFamily(e.font).split(",")[0]}`).then(()=>{if(active)fontsReady(n=>n+1);}).catch(()=>{});return()=>{active=false;};},[e.type,e.type==="text"?e.font:null,e.type==="text"?e.bold:null,e.type==="text"?e.italic:null]);
  if(e.type==="stroke")return <path d={strokePath(e.points)} fill="none" stroke={e.color} strokeWidth={e.width} strokeOpacity={e.opacity} strokeLinecap="round" strokeLinejoin="round"/>;
  if(e.type==="image")return <image href={e.src} x={e.x} y={e.y} width={e.width} height={e.height} preserveAspectRatio="none"/>;
  const canvas=document.createElement("canvas"),context=canvas.getContext("2d");if(context)context.font=`${e.italic?"italic ":""}${e.bold?"bold ":""}${e.size}px ${fontFamily(e.font)}`;
  const lines=wrapText(e.text,e.width-8,e.size,context?s=>context.measureText(s).width:undefined);
  return <text letterSpacing={e.flow==="ruled"?0:undefined} fill={e.color} fontSize={e.size} fontFamily={fontFamily(e.font)} fontWeight={e.bold?700:400} fontStyle={e.italic?"italic":undefined} textDecoration={e.underline?"underline":undefined} textAnchor={e.align==="center"?"middle":e.align==="right"?"end":"start"}>{lines.slice(0,textVisibleLines(e)).map((line,i)=><tspan key={i} x={e.x+(e.align==="center"?e.width/2:e.align==="right"?e.width-4:4)} y={textBaseline(e,i)}>{line||" "}</tspan>)}</text>;
});
function editorBaseline(element:TextElement) {
 const context=document.createElement("canvas").getContext("2d");
 if(!context)return element.size;
 context.font=`${element.italic?"italic ":""}${element.bold?"bold ":""}${element.size}px ${fontFamily(element.font)}`;
 const metrics=context.measureText("Mg"),ascent=metrics.fontBoundingBoxAscent??element.size*.93,descent=metrics.fontBoundingBoxDescent??element.size*.24;
 return (textLineHeight(element)-ascent-descent)/2+ascent;
}
export function PaperArtwork({paper}:{paper:NotebookPage["paper"]}) {
  return <><rect width="800" height="1100" fill={paperColor(paper)}/>{paper==="ruled"&&<><path d={Array.from({length:32},(_,i)=>`M0 ${PAPER_GRID.first+i*PAPER_GRID.step} H800`).join(" ")} stroke="#a5bfc5" strokeWidth=".8" opacity=".55"/><path d="M62 0 V1100" stroke="#c47b76" strokeWidth="1" opacity=".6"/></>}{paper==="parchment"&&<><defs><radialGradient id="paper-age"><stop offset="55%" stopColor="#e8d197" stopOpacity="0"/><stop offset="100%" stopColor="#a47436" stopOpacity=".32"/></radialGradient></defs><rect width="800" height="1100" fill="url(#paper-age)"/><rect x="18" y="18" width="764" height="1064" rx="4" fill="none" stroke="#a67d3d" strokeWidth="1" opacity=".25"/></>}</>;
}
export function PageCanvas({page,tool,color,width,selected,onSelect,onChange,onSource,readOnly=false,textStyle}:{page:NotebookPage;tool:Tool;color:string;width:number;selected:string|null;onSelect:(id:string|null)=>void;onChange:(elements:Element[],record?:boolean)=>void;onSource:(image:ImageElement)=>void;readOnly?:boolean;textStyle:Omit<TextElement,"id"|"type"|"x"|"y"|"width"|"height"|"text">}) {
  const svg=useRef<SVGSVGElement>(null),draft=useRef<SVGPathElement>(null);
  const animation=useRef(0);
  useEffect(()=>()=>{clearTimeout(hold.current);cancelAnimationFrame(animation.current);},[]);
  const active=useRef<{pointerType:string;id:number;point:Point;points:Point[];original:Element[];target?:Element;resize?:boolean;draw?:Stroke;recorded?:boolean;lastErase?:Point;lastRaw?:Point}|null>(null);
  const pendingText=useRef<{id:number;point:Point}|null>(null);
  const changeRef=useRef(onChange);changeRef.current=onChange;
  const [editing,setEditing]=useState<string|null>(null);
  const hold=useRef<ReturnType<typeof setTimeout>|undefined>(undefined);
  const latest=useRef(page);latest.current=page;
  const position=(event:PointerEvent):Point=>{const bounds=svg.current!.getBoundingClientRect();return [Math.max(0,Math.min(800,(event.clientX-bounds.left)/bounds.width*800)),Math.max(0,Math.min(1100,(event.clientY-bounds.top)/bounds.height*1100))];};
  useEffect(()=>{
    const viewport=svg.current?.closest(".nb-camera-viewport");
    const cancel=()=>{pendingText.current=null;const gesture=active.current;active.current=null;clearTimeout(hold.current);cancelAnimationFrame(animation.current);animation.current=0;draft.current?.setAttribute("d","");if(gesture?.recorded)changeRef.current(gesture.original,false);};
    viewport?.addEventListener("nb:pinch-start",cancel);
    return()=>viewport?.removeEventListener("nb:pinch-start",cancel);
  },[]);
  const insertText=(point:Point)=>{const element:TextElement={id:uid(),type:"text",text:"",...textStyle,...ruledTextBox(point,textStyle.size)};onChange([...latest.current.elements,element]);onSelect(element.id);setEditing(element.id);};
  const erase=(point:Point)=>{const gesture=active.current;if(!gesture)return;const next=eraseElements(latest.current.elements,gesture.lastErase||point,point,Math.max(width,8));gesture.lastErase=point;if(next!==latest.current.elements){onChange(next,!gesture.recorded);gesture.recorded=true;}};
  const down=(event:PointerEvent)=>{
    if(tool==="hand")return;
    if(active.current && event.pointerType==="pen" && active.current.pointerType!=="pen"){active.current=null;draft.current?.setAttribute("d","");}
    if(active.current||event.button!==0)return;
    const point=position(event);
    const targetId=(event.target as SVGElement).closest("[data-element-id]")?.getAttribute("data-element-id");
    const target=page.elements.find(e=>e.id===targetId);
    if(readOnly){if(target?.type==="image"&&target.source)hold.current=setTimeout(()=>onSource(target),650);return;}
    if(tool==="text") {
      if((event.target as SVGElement).closest("foreignObject"))return;
      event.preventDefault();
      if(target?.type==="text"){onSelect(target.id);setEditing(target.id);return;}
      if(event.pointerType==="touch")pendingText.current={id:event.pointerId,point};else insertText(point);
      return;
    }
    if(tool==="select") {onSelect(target?.id||null);if(!target||target.type==="stroke")return;if((event.target as SVGElement).closest("foreignObject"))return;if(target.type==="image"&&target.source)hold.current=setTimeout(()=>{active.current=null;onSource(target);},650);}
    event.currentTarget.setPointerCapture(event.pointerId);
    const stroke:Stroke={id:uid(),type:"stroke",points:[point],color,width:tool==="marker"?Math.min(60,Math.max(12,width*4)):width,opacity:tool==="marker"?.3:1};
    active.current={pointerType:event.pointerType,id:event.pointerId,point,points:[point],original:page.elements,target,resize:(event.target as SVGElement).getAttribute("data-resize")==="true",draw:tool==="pen"||tool==="marker"?stroke:undefined};
    if(active.current.draw&&draft.current){draft.current.setAttribute("d",strokePath([point]));draft.current.setAttribute("stroke",color);draft.current.setAttribute("stroke-width",String(stroke.width));draft.current.setAttribute("opacity",String(stroke.opacity));}
    if(tool==="eraser")erase(point);
  };
  const move=(event:PointerEvent)=>{
    const gesture=active.current;
    if(!gesture||gesture.id!==event.pointerId){clearTimeout(hold.current);return;}
    const point=position(event),dx=point[0]-gesture.point[0],dy=point[1]-gesture.point[1];
    if(Math.hypot(dx,dy)>6)clearTimeout(hold.current);
    if(gesture.draw){
      const events=event.nativeEvent.getCoalescedEvents?.()||[event.nativeEvent];
      for(const e of events){const bounds=svg.current!.getBoundingClientRect();const p:Point=[Math.max(0,Math.min(800,(e.clientX-bounds.left)/bounds.width*800)),Math.max(0,Math.min(1100,(e.clientY-bounds.top)/bounds.height*1100))];const last=gesture.points[gesture.points.length-1];gesture.lastRaw=p;if(Math.hypot(p[0]-last[0],p[1]-last[1])>.8)gesture.points.push([last[0]+(p[0]-last[0])*.72,last[1]+(p[1]-last[1])*.72]);}
      if(!animation.current)animation.current=requestAnimationFrame(()=>{animation.current=0;if(active.current?.draw)draft.current?.setAttribute("d",strokePath(active.current.points));});return;
    }
    if(tool==="eraser"){erase(point);return;}
    const target=gesture.target;if(!target||target.type==="stroke")return;
    onChange(gesture.original.map(e=>{
      if(e.id!==target.id)return e;
      if(gesture.resize)return {...target,width:Math.max(40,Math.min(800-target.x,target.width+dx)),height:Math.max(40,Math.min(1100-target.y,target.height+dy))};
      const y=target.type==="text"&&target.flow==="ruled"?snapTextY(target.y+dy,target.size):Math.max(0,Math.min(1100-target.height,target.y+dy));
      return {...target,x:Math.max(0,Math.min(800-target.width,target.x+dx)),y,...(target.type==="text"&&target.flow==="ruled"?{height:Math.min(target.height,1100-y)}:{})};
    }),!gesture.recorded);gesture.recorded=true;
  };
  const up=(event:PointerEvent)=>{const pending=pendingText.current;if(pending?.id===event.pointerId){pendingText.current=null;if(event.type==="pointerup")insertText(pending.point);}if(event.type==="pointercancel"){active.current=null;draft.current?.setAttribute("d","");return;}if(active.current&&event.pointerId!==active.current.id)return;cancelAnimationFrame(animation.current);animation.current=0;clearTimeout(hold.current);const gesture=active.current;active.current=null;if(gesture?.draw){if(gesture.lastRaw)gesture.points.push(gesture.lastRaw);onChange([...latest.current.elements,{...gesture.draw,points:gesture.points}]);draft.current?.setAttribute("d","");}};
  const selectedElement=page.elements.find(e=>e.id===selected);
  return <svg ref={svg} className={`nb-sheet is-${page.paper}`} viewBox="0 0 800 1100" role="group" aria-label={`Folha: ${page.title}`} style={{touchAction:"none"}} onPointerDown={down} onPointerMove={move} onPointerUp={up} onPointerCancel={up} onLostPointerCapture={up}>
    <PaperArtwork paper={page.paper}/>
    {!readOnly&&(tool==="text"||editing)&&<g className="nb-writing-guides" aria-hidden="true" pointerEvents="none"><path d={Array.from({length:32},(_,i)=>`M${PAPER_GRID.left} ${PAPER_GRID.first+i*PAPER_GRID.step} H${PAPER_GRID.right}`).join(" ")} fill="none" stroke="#518b85" strokeWidth="1" strokeDasharray="4 6" opacity={page.paper==="ruled"?.18:.25}/></g>}
    {page.elements.map(e=><g key={e.id} data-element-id={e.id} onDoubleClick={()=>{if(!readOnly&&tool==="select"&&e.type==="text")setEditing(e.id);}} style={{touchAction:e.id===editing?"auto":!readOnly&&tool==="select"?"none":undefined,pointerEvents:e.id===editing||tool==="select"||readOnly||(tool==="text"&&e.type==="text")?"auto":"none",cursor:readOnly&&e.type==="image"&&e.source?"pointer":tool==="select"?"move":undefined}}>{e.id!==editing&&<ElementArtwork element={e}/>} {e.type==="text"&&<rect x={e.x} y={e.y} width={e.width} height={e.height} fill="transparent"/>}{!readOnly&&e.id===editing&&e.type==="text"&&<foreignObject x={e.x} y={e.flow==="ruled"?textBaseline(e,0)-editorBaseline(e):e.y} width={e.width} height={e.height}><textarea autoFocus aria-label="Texto da página" className="nb-text-edit" value={e.text} style={{lineHeight:`${textLineHeight(e)}px`,...(e.flow==="ruled"?{padding:"0 4px",border:0,outline:"1px dashed #518b85",background:"transparent",letterSpacing:0,whiteSpace:"pre-wrap",overflowWrap:"break-word"}:{}),fontFamily:fontFamily(e.font),fontSize:e.size,color:e.color,fontWeight:e.bold?700:400,fontStyle:e.italic?"italic":"normal",textDecoration:e.underline?"underline":"none",textAlign:e.align}} onPointerDown={event=>event.stopPropagation()} onChange={event=>onChange(page.elements.map(item=>item.id===e.id?{...e,text:event.target.value,height:e.flow==="ruled"?1100-e.y:Math.min(1100-e.y,Math.max(e.height,event.target.scrollHeight+6))}:item))} onBlur={()=>setEditing(null)}/></foreignObject>}</g>)}
    {!readOnly&&selectedElement&&selectedElement.type!=="stroke"&&tool==="select"&&<g data-element-id={selectedElement.id} style={{touchAction:"none"}}><rect x={selectedElement.x} y={selectedElement.y} width={selectedElement.width} height={selectedElement.height} fill="none" stroke="#518b85" strokeWidth="2" strokeDasharray="5 5" pointerEvents="none"/><rect data-resize="true" x={selectedElement.x+selectedElement.width-10} y={selectedElement.y+selectedElement.height-10} width="20" height="20" rx="4" fill="#518b85" style={{cursor:"nwse-resize"}}/></g>}
    <path ref={draft} fill="none" strokeLinecap="round" strokeLinejoin="round" pointerEvents="none"/>
  </svg>;
}
