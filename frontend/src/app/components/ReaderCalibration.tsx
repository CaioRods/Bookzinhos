import { useDialogFocus } from "../lib/useDialogFocus";
import { useEffect, useRef, useState, type ReactNode } from "react";
import { Check, RotateCcw, X } from "lucide-react";
import { defaultPreset, sanitizePreset, type PagePreset, type ReaderPresets } from "../lib/readerDevice";
export function ReaderCalibration({ presets, render, onCancel, onSave }: { presets: ReaderPresets; render: (mode: "single"|"double", preset: PagePreset) => ReactNode; onCancel:()=>void; onSave:(value:ReaderPresets)=>void }) {
  const [mode,setMode]=useState<"single"|"double">("single"),[draft,setDraft]=useState<ReaderPresets>(()=>structuredClone(presets));
  const dialog=useRef<HTMLDivElement>(null);
  useDialogFocus(dialog, { onClose: onCancel });
  const surface=useRef<HTMLDivElement>(null), current=useRef({mode,draft});current.current={mode,draft};
  const set=(value:PagePreset)=>setDraft(previous=>({...previous,[current.current.mode]:sanitizePreset(value)}));
  useEffect(()=>{
    const element=surface.current;if(!element)return;
    let start:{x:number;y:number;distance:number;preset:PagePreset}|null=null;
    const geometry=(touches:TouchList)=>{const points=Array.from(touches);return{x:points.reduce((n,p)=>n+p.clientX,0)/points.length,y:points.reduce((n,p)=>n+p.clientY,0)/points.length,distance:points.length>1?Math.hypot(points[0].clientX-points[1].clientX,points[0].clientY-points[1].clientY):0};};
    const begin=(event:TouchEvent)=>{if(!event.touches.length)return;event.preventDefault();start={...geometry(event.touches),preset:{...current.current.draft[current.current.mode]}};};
    const move=(event:TouchEvent)=>{if(!start||!event.touches.length)return;event.preventDefault();const point=geometry(event.touches),bounds=element.getBoundingClientRect();set({zoom:start.preset.zoom*(start.distance&&point.distance?point.distance/start.distance:1),x:start.preset.x+(point.x-start.x)/Math.max(bounds.width,1),y:start.preset.y+(point.y-start.y)/Math.max(bounds.height,1)});};
    const end=(event:TouchEvent)=>{start=null;if(event.touches.length)begin(event);};
    element.addEventListener("touchstart",begin,{passive:false});element.addEventListener("touchmove",move,{passive:false});element.addEventListener("touchend",end,{passive:false});const cancel=()=>{start=null;};element.addEventListener("touchcancel",cancel);
    return()=>{element.removeEventListener("touchstart",begin);element.removeEventListener("touchmove",move);element.removeEventListener("touchend",end);element.removeEventListener("touchcancel",cancel);};
  },[]);
  return <div ref={dialog} tabIndex={-1} className="mb-reader-calibration" role="dialog" aria-modal="true" aria-label="Ajustar páginas neste dispositivo">
    <header><div><small>SEU ENCAIXE DE LEITURA</small><h2>{mode==="single"?"1. Uma página":"2. Duas páginas"}</h2><p>Arraste para posicionar. Use dois dedos para ampliar ou reduzir.</p></div><button aria-label="Cancelar ajustes" onClick={onCancel}><X size={21}/></button></header>
    <div className="mb-calibration-preview" ref={surface} key="preview" data-calibration-mode={mode}>{render(mode,draft[mode])}<span className="mb-calibration-crosshair"/></div>
    <footer><div className="mb-calibration-controls"><button className="mb-btn mb-btn-outline" onClick={()=>set(defaultPreset())}><RotateCcw size={15}/> Centralizar</button><label>Zoom<input aria-label="Zoom do preset" type="range" min={.5} max={3} step={.01} value={draft[mode].zoom} onChange={event=>set({...draft[mode],zoom:Number(event.target.value)})}/><output>{Math.round(draft[mode].zoom*100)}%</output></label></div><div className="mb-calibration-actions"><button className="mb-btn mb-btn-ghost" onClick={mode==="double"?()=>setMode("single"):onCancel}>{mode==="double"?"Voltar à primeira etapa":"Cancelar"}</button><button className="mb-btn mb-btn-primary" onClick={()=>mode==="single"?setMode("double"):onSave(draft)}><Check size={16}/>{mode==="single"?"Confirmar uma página":"Salvar os dois presets"}</button></div><small>Somente sua conta neste dispositivo. Você volta à mesma página ao confirmar.</small></footer>
  </div>;
}
