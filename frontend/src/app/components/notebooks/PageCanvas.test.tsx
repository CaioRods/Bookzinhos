// @vitest-environment jsdom
import "@testing-library/jest-dom/vitest";
import { useState } from "react";import { act,cleanup,fireEvent,render,screen } from "@testing-library/react";import { afterEach,expect,it,vi } from "vitest";
import { PageCanvas } from "./PageCanvas";import { blankPage,type Element } from "../../lib/notebooks/model";
afterEach(()=>{cleanup();vi.restoreAllMocks();});
it("keeps the text editor focused after inserting a text box and saves edits as structured text",()=>{
 vi.spyOn(HTMLCanvasElement.prototype,"getContext").mockReturnValue({measureText:(value:string)=>({width:value.length*10})} as CanvasRenderingContext2D);
 let output:Element[]=[];
 function Harness(){const [page,setPage]=useState(blankPage());return <PageCanvas page={page} tool="text" color="#112233" width={3} selected={null} onSelect={()=>{}} onSource={()=>{}} onChange={elements=>{output=elements;setPage({...page,elements});}} textStyle={{font:"sans",size:22,color:"#112233",bold:false,italic:false,underline:false,align:"left"}}/>;}
 const view=render(<Harness/>);const svg=view.container.querySelector("svg")!;vi.spyOn(svg,"getBoundingClientRect").mockReturnValue({left:0,top:0,width:800,height:1100} as DOMRect);
 const event=new Event("pointerdown",{bubbles:true,cancelable:true});Object.assign(event,{button:0,pointerType:"mouse",pointerId:1,clientX:70,clientY:120});act(()=>svg.dispatchEvent(event));expect(event.defaultPrevented).toBe(true);
 const editor=screen.getByRole("textbox",{name:"Texto da página"});fireEvent.change(editor,{target:{value:"Uma ideia sem HTML"}});expect(output[0]).toMatchObject({type:"text",text:"Uma ideia sem HTML"});expect(editor).toHaveFocus();
});
