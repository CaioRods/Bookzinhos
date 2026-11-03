import {useLayoutEffect,useRef,useState,type ReactNode,type PointerEvent} from "react";
import {Crosshair} from "lucide-react";
type Camera={zoom:number;x:number;y:number};
type Touch={x:number;y:number};
const clampZoom=(zoom:number)=>Math.max(.35,Math.min(3,zoom));
export function NotebookCamera({hand,children}:{hand:boolean;children:ReactNode}){
 const viewport=useRef<HTMLDivElement>(null),[width,setWidth]=useState(800),[camera,setCamera]=useState<Camera>({zoom:1,x:0,y:0});
 const latest=useRef(camera);latest.current=camera;
 const drag=useRef<{id:number;x:number;y:number;camera:Camera}|null>(null);
 const touches=useRef(new Map<number,Touch>());
 const pinch=useRef<{distance:number;anchor:Touch;camera:Camera}|null>(null);
 const pinching=useRef(false);
 const trackpadGesture=useRef<{zoom:number;scale:number;anchor:Touch}|null>(null);
 const setZoom=(zoom:number,anchor={x:0,y:0})=>{setCamera(current=>{const next=clampZoom(zoom),ratio=next/current.zoom;return {zoom:next,x:anchor.x-(anchor.x-current.x)*ratio,y:anchor.y-(anchor.y-current.y)*ratio};});};
 const pair=()=>{const [a,b]=[...touches.current.values()];if(!a||!b)return null;const bounds=viewport.current!.getBoundingClientRect();return {distance:Math.max(1,Math.hypot(b.x-a.x,b.y-a.y)),anchor:{x:(a.x+b.x)/2-bounds.left-bounds.width/2,y:(a.y+b.y)/2-bounds.top-6}};};
 useLayoutEffect(()=>{
  const element=viewport.current;if(!element)return;
  const measure=()=>setWidth(Math.max(180,element.clientWidth-16));measure();
  const observer=new ResizeObserver(measure);observer.observe(element);
  const wheel=(event:WheelEvent)=>{event.preventDefault();if(trackpadGesture.current&&(event.ctrlKey||event.metaKey))return;const bounds=element.getBoundingClientRect(),unit=event.deltaMode===1?16:event.deltaMode===2?element.clientHeight:1;if(event.ctrlKey||event.metaKey)setZoom(latest.current.zoom*Math.exp(-event.deltaY*unit*.0025),{x:event.clientX-bounds.left-bounds.width/2,y:event.clientY-bounds.top-6});else setCamera(current=>({...current,x:current.x-event.deltaX*unit,y:current.y-event.deltaY*unit}));};
  // Safari emits GestureEvents for a trackpad pinch; Chromium uses ctrl+wheel.
  const gestureStart=(event:Event)=>{
   const gesture=event as Event&{scale?:number;clientX?:number;clientY?:number};event.preventDefault();
   const bounds=element.getBoundingClientRect();
   trackpadGesture.current={zoom:latest.current.zoom,scale:gesture.scale&&gesture.scale>0?gesture.scale:1,anchor:{x:(gesture.clientX??bounds.left+bounds.width/2)-bounds.left-bounds.width/2,y:(gesture.clientY??bounds.top+bounds.height/2)-bounds.top-6}};
  };
  const gestureChange=(event:Event)=>{
   event.preventDefault();const origin=trackpadGesture.current,scale=(event as Event&{scale?:number}).scale;
   if(origin&&scale&&Number.isFinite(scale)&&scale>0)setZoom(origin.zoom*scale/origin.scale,origin.anchor);
  };
  const gestureEnd=(event:Event)=>{event.preventDefault();trackpadGesture.current=null;};
  element.addEventListener("wheel",wheel,{passive:false});
  element.addEventListener("gesturestart",gestureStart,{passive:false});element.addEventListener("gesturechange",gestureChange,{passive:false});element.addEventListener("gestureend",gestureEnd,{passive:false});
  return()=>{observer.disconnect();element.removeEventListener("wheel",wheel);element.removeEventListener("gesturestart",gestureStart);element.removeEventListener("gesturechange",gestureChange);element.removeEventListener("gestureend",gestureEnd);};
 },[]);
 const down=(event:PointerEvent<HTMLDivElement>)=>{
  if(event.pointerType==="touch"){
   touches.current.set(event.pointerId,{x:event.clientX,y:event.clientY});
   if(touches.current.size>=2){
    event.preventDefault();event.stopPropagation();
    if(!pinching.current){event.currentTarget.dispatchEvent(new Event("nb:pinch-start"));drag.current=null;pinching.current=true;pinch.current={...pair()!,camera:latest.current};}
    for(const id of touches.current.keys())event.currentTarget.setPointerCapture(id);
    return;
   }
  }
  if(drag.current||(!hand&&event.button!==1))return;
  event.preventDefault();event.stopPropagation();event.currentTarget.setPointerCapture(event.pointerId);
  drag.current={id:event.pointerId,x:event.clientX,y:event.clientY,camera:latest.current};
 };
 const move=(event:PointerEvent<HTMLDivElement>)=>{
  if(event.pointerType==="touch"&&touches.current.has(event.pointerId))touches.current.set(event.pointerId,{x:event.clientX,y:event.clientY});
  if(pinching.current){
   event.preventDefault();event.stopPropagation();const current=pair(),origin=pinch.current;
   if(current&&origin){const zoom=clampZoom(origin.camera.zoom*current.distance/origin.distance),ratio=zoom/origin.camera.zoom;setCamera({zoom,x:current.anchor.x-(origin.anchor.x-origin.camera.x)*ratio,y:current.anchor.y-(origin.anchor.y-origin.camera.y)*ratio});}
   return;
  }
  const origin=drag.current;if(!origin||origin.id!==event.pointerId)return;
  event.preventDefault();event.stopPropagation();setCamera({...origin.camera,x:origin.camera.x+event.clientX-origin.x,y:origin.camera.y+event.clientY-origin.y});
 };
 const end=(event:PointerEvent<HTMLDivElement>)=>{
  touches.current.delete(event.pointerId);
  if(pinching.current){event.stopPropagation();if(!touches.current.size){pinch.current=null;pinching.current=false;}}
  if(drag.current?.id===event.pointerId)drag.current=null;
 };
 return <div className="nb-camera"><div className="nb-camera-controls"><label>Zoom <select aria-label="Zoom da folha" value={Math.round(camera.zoom*100)} onChange={event=>setZoom(Number(event.target.value)/100)}>{[...new Set([35,50,75,100,125,150,200,300,Math.round(camera.zoom*100)])].sort((a,b)=>a-b).map(n=><option key={n} value={n}>{n}%</option>)}</select></label><button className="mb-btn mb-btn-ghost mb-btn-sm" aria-label="Centralizar folha" onClick={()=>setCamera({zoom:1,x:0,y:0})}><Crosshair size={15}/></button></div><div ref={viewport} className={`nb-sheet-scroll nb-camera-viewport ${hand?"is-hand":""}`} data-camera-zoom={camera.zoom} data-camera-x={camera.x} data-camera-y={camera.y} style={{touchAction:"none"}} onPointerDownCapture={down} onPointerMoveCapture={move} onPointerUpCapture={end} onPointerCancelCapture={end} onLostPointerCapture={event=>{if(event.target===event.currentTarget)end(event);}}><div className="nb-sheet-size nb-camera-paper" style={{width,transform:`translate(calc(-50% + ${camera.x}px), ${camera.y}px) scale(${camera.zoom})`}}>{children}</div></div></div>;
}
