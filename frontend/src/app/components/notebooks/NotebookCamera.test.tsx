// @vitest-environment jsdom
import {act,cleanup,render,screen} from '@testing-library/react';
import {afterEach,beforeEach,expect,it,vi} from 'vitest';
import {useState} from 'react';
import {PageCanvas} from './PageCanvas';
import {blankPage,type Element as NotebookElement} from '../../lib/notebooks/model';
import {NotebookCamera} from './NotebookCamera';
beforeEach(()=>{vi.stubGlobal('ResizeObserver',class{observe(){} disconnect(){}});Object.defineProperty(HTMLElement.prototype,'setPointerCapture',{configurable:true,value:vi.fn()});});
afterEach(()=>{cleanup();vi.restoreAllMocks();vi.unstubAllGlobals();});
function pointer(node:Element,type:string,id:number,x:number,y:number){const event=new Event(type,{bubbles:true,cancelable:true});Object.assign(event,{pointerId:id,pointerType:'touch',button:0,clientX:x,clientY:y});act(()=>node.dispatchEvent(event));}
function setup(){const view=render(<NotebookCamera hand={false}><svg><rect width="800" height="1100"/></svg></NotebookCamera>);const viewport=view.container.querySelector('.nb-camera-viewport')!;vi.spyOn(viewport,'getBoundingClientRect').mockReturnValue({left:0,top:0,width:400,height:400} as DOMRect);return {viewport,paper:view.container.querySelector('rect')!};}
it('zooms around the two-finger midpoint without selecting the hand tool and keeps panning as the midpoint moves',()=>{
 const {viewport,paper}=setup();pointer(paper,'pointerdown',1,100,100);pointer(paper,'pointerdown',2,200,100);pointer(viewport,'pointermove',2,300,100);
 expect(Number(viewport.getAttribute('data-camera-zoom'))).toBe(2);expect(Number(viewport.getAttribute('data-camera-x'))).toBe(100);expect(Number(viewport.getAttribute('data-camera-y'))).toBe(-94);
 pointer(viewport,'pointerup',1,100,100);pointer(viewport,'pointermove',2,350,100);expect(Number(viewport.getAttribute('data-camera-zoom'))).toBe(2);pointer(viewport,'pointerup',2,350,100);
});
it('clamps pinch zoom and clears canceled fingers so a new pinch works',()=>{
 const {viewport,paper}=setup();pointer(paper,'pointerdown',1,100,100);pointer(paper,'pointerdown',2,200,100);pointer(viewport,'pointermove',2,1000,100);expect(Number(viewport.getAttribute('data-camera-zoom'))).toBe(3);
 pointer(viewport,'pointercancel',1,100,100);pointer(viewport,'pointercancel',2,1000,100);pointer(paper,'pointerdown',3,100,100);pointer(paper,'pointerdown',4,200,100);pointer(viewport,'pointermove',4,101,100);expect(Number(viewport.getAttribute('data-camera-zoom'))).toBe(.35);
});

it('does not insert a text box during pinch, then accepts a single-finger text tap',()=>{
 vi.spyOn(HTMLCanvasElement.prototype,'getContext').mockReturnValue({measureText:(value:string)=>({width:value.length*10})} as CanvasRenderingContext2D);
 let output:NotebookElement[]=[];
 function App(){const [page,setPage]=useState(blankPage());return <NotebookCamera hand={false}><PageCanvas page={page} tool="text" color="#112233" width={3} selected={null} onSelect={()=>{}} onSource={()=>{}} onChange={elements=>{output=elements;setPage({...page,elements});}} textStyle={{font:'sans',size:22,color:'#112233',bold:false,italic:false,underline:false,align:'left'}}/></NotebookCamera>;}
 const view=render(<App/>),viewport=view.container.querySelector('.nb-camera-viewport')!,svg=view.container.querySelector('svg.nb-sheet')!;
 vi.spyOn(svg,'getBoundingClientRect').mockReturnValue({left:0,top:0,width:800,height:1100} as DOMRect);vi.spyOn(viewport,'getBoundingClientRect').mockReturnValue({left:0,top:0,width:400,height:400} as DOMRect);
 pointer(svg,'pointerdown',1,100,100);expect(output).toHaveLength(0);pointer(svg,'pointerdown',2,200,100);pointer(viewport,'pointermove',2,300,100);pointer(viewport,'pointerup',1,100,100);pointer(viewport,'pointerup',2,300,100);expect(output).toHaveLength(0);
 pointer(svg,'pointerdown',3,70,72);pointer(svg,'pointerup',3,70,72);expect(output).toHaveLength(1);expect(output[0]).toMatchObject({type:'text',flow:'ruled',y:50});
});
