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

it.each(['plain','ruled','parchment'] as const)("aligns text, wrapping and Enter with the paper grid on %s paper",paper=>{
 vi.spyOn(HTMLCanvasElement.prototype,'getContext').mockReturnValue({measureText:(value:string)=>({width:value.length*10})} as CanvasRenderingContext2D);
 let output:Element[]=[];
 function Harness(){const [page,setPage]=useState({...blankPage(),paper});return <PageCanvas page={page} tool="text" color="#112233" width={3} selected={null} onSelect={()=>{}} onSource={()=>{}} onChange={elements=>{output=elements;setPage({...page,elements});}} textStyle={{font:'sans',size:22,color:'#112233',bold:false,italic:false,underline:false,align:'left'}}/>;}
 const view=render(<Harness/>),svg=view.container.querySelector('svg')!;vi.spyOn(svg,'getBoundingClientRect').mockReturnValue({left:0,top:0,width:800,height:1100} as DOMRect);
 const event=new Event('pointerdown',{bubbles:true,cancelable:true});Object.assign(event,{button:0,pointerType:'mouse',pointerId:1,clientX:70,clientY:72});act(()=>svg.dispatchEvent(event));
 expect(output[0]).toMatchObject({type:'text',flow:'ruled',y:50});
 const editor=screen.getByRole('textbox',{name:'Texto da página'});expect((editor as HTMLElement).style.lineHeight).toBe('32px');
 fireEvent.change(editor,{target:{value:'A'.repeat(100)+'\nPróxima linha'}});fireEvent.blur(editor);
 const spans=[...view.container.querySelectorAll('text tspan')];expect(spans.length).toBeGreaterThan(2);expect(spans[0].getAttribute('y')).toBe('72');expect(spans[1].getAttribute('y')).toBe('104');expect(spans.at(-1)?.textContent).toBe('Próxima linha');
});

it('keeps a moved ruled text box inside the sheet',()=>{
 vi.spyOn(HTMLCanvasElement.prototype,'getContext').mockReturnValue({measureText:(value:string)=>({width:value.length*10})} as CanvasRenderingContext2D);
 let output:Element[]=[];
 const text={id:'text',type:'text' as const,flow:'ruled' as const,x:62,y:50,width:698,height:1050,text:'Uma linha\nOutra linha\nMais uma',size:22,color:'#112233',font:'sans' as const,bold:false,italic:false,underline:false,align:'left' as const};
 function App(){const [page,setPage]=useState({...blankPage(),elements:[text] as Element[]});return <PageCanvas page={page} tool="select" color="#112233" width={3} selected="text" onSelect={()=>{}} onSource={()=>{}} onChange={elements=>{output=elements;setPage({...page,elements});}} textStyle={{font:'sans',size:22,color:'#112233',bold:false,italic:false,underline:false,align:'left'}}/>;}
 const view=render(<App/>),svg=view.container.querySelector('svg')!;Object.defineProperty(svg,'setPointerCapture',{value:vi.fn()});vi.spyOn(svg,'getBoundingClientRect').mockReturnValue({left:0,top:0,width:800,height:1100} as DOMRect);
 const pointer=(node:globalThis.Element,type:string,y:number)=>{const e=new Event(type,{bubbles:true,cancelable:true});Object.assign(e,{pointerId:1,pointerType:'mouse',button:0,clientX:70,clientY:y});act(()=>node.dispatchEvent(e));};
 pointer(view.container.querySelector('[data-element-id="text"] rect')!,'pointerdown',60);pointer(svg,'pointermove',1020);pointer(svg,'pointerup',1020);
 const moved=output[0];expect(moved).toMatchObject({y:1010,height:90});expect([...view.container.querySelectorAll('text tspan')].map(e=>e.getAttribute('y'))).toEqual(['1032','1064']);
});

const existingText={id:'existing',type:'text' as const,flow:'ruled' as const,x:62,y:50,width:698,height:1050,text:'Primeiro parágrafo\nSegundo parágrafo\nTexto completo da seleção.',size:22,color:'#112233',font:'sans' as const,bold:false,italic:false,underline:false,align:'left' as const};
function existingTextEditor(tool:'select'|'text'='select',readOnly=false){
 vi.spyOn(HTMLCanvasElement.prototype,'getContext').mockReturnValue({measureText:(value:string)=>({width:value.length*10})} as CanvasRenderingContext2D);
 let saved:Element[]=[];
 function App(){const [page,setPage]=useState({...blankPage(),elements:[existingText] as Element[]}),[selected,select]=useState<string|null>(null);return <PageCanvas page={page} tool={tool} readOnly={readOnly} color="#112233" width={3} selected={selected} onSelect={select} onSource={()=>{}} onChange={elements=>{saved=elements;setPage({...page,elements});}} textStyle={{font:'sans',size:22,color:'#112233',bold:false,italic:false,underline:false,align:'left'}}/>;}
 const view=render(<App/>),svg=view.container.querySelector('svg')!;Object.defineProperty(svg,'setPointerCapture',{value:vi.fn()});vi.spyOn(svg,'getBoundingClientRect').mockReturnValue({left:0,top:0,width:800,height:1100} as DOMRect);
 const target=view.container.querySelector('[data-element-id="existing"] rect')!;
 const pointer=(type:string,pointerType='touch',y=72)=>{const event=new Event(type,{bubbles:true,cancelable:true});Object.assign(event,{pointerId:1,pointerType,button:0,clientX:80,clientY:y});act(()=>target.dispatchEvent(event));return event;};
 return {view,svg,target,pointer,saved:()=>saved};
}
it.each(['select','text'] as const)('opens the full text block on a completed mobile tap with %s, preserving other paragraphs',tool=>{
 const app=existingTextEditor(tool);expect(app.pointer('pointerdown').defaultPrevented).toBe(false);expect(screen.queryByRole('textbox',{name:'Texto da página'})).toBeNull();app.pointer('pointerup');fireEvent.click(app.target);
 const editor=screen.getByRole('textbox',{name:'Texto da página'});expect(editor).toHaveValue(existingText.text);expect(editor).toHaveFocus();
 fireEvent.change(editor,{target:{value:existingText.text.replace('Segundo','Parágrafo editado')}});expect(app.saved()).toHaveLength(1);expect(app.saved()[0]).toMatchObject({id:'existing',text:'Primeiro parágrafo\nParágrafo editado parágrafo\nTexto completo da seleção.'});
});
it.each(['select','text'] as const)('requires desktop double click to edit existing text with %s',tool=>{
 const app=existingTextEditor(tool);app.pointer('pointerdown','mouse');app.pointer('pointerup','mouse');expect(screen.queryByRole('textbox',{name:'Texto da página'})).toBeNull();fireEvent.doubleClick(app.target);expect(screen.getByRole('textbox',{name:'Texto da página'})).toHaveValue(existingText.text);
});
it('does not open the editor after a mobile drag or canceled touch',()=>{
 const app=existingTextEditor();app.pointer('pointerdown');app.pointer('pointermove','touch',200);app.pointer('pointerup','touch',200);expect(screen.queryByRole('textbox',{name:'Texto da página'})).toBeNull();app.pointer('pointerdown');app.pointer('pointercancel');expect(screen.queryByRole('textbox',{name:'Texto da página'})).toBeNull();
});
it('does not edit text in a read-only shared notebook',()=>{const app=existingTextEditor('select',true);app.pointer('pointerdown');app.pointer('pointerup');fireEvent.doubleClick(app.target);expect(screen.queryByRole('textbox',{name:'Texto da página'})).toBeNull();});
it('keeps a mobile text tap active when capture transfers from a child to the SVG sheet',()=>{
 const app=existingTextEditor();app.pointer('pointerdown');app.pointer('lostpointercapture');app.pointer('pointerup');fireEvent.click(app.target);expect(screen.getByRole('textbox',{name:'Texto da página'})).toHaveValue(existingText.text);
});
it('edits text when native pointer capture retargets the desktop double-click to the SVG',()=>{
 const app=existingTextEditor();app.pointer('pointerdown','mouse');app.pointer('pointerup','mouse');fireEvent.doubleClick(app.svg,{clientX:80,clientY:72});expect(screen.getByRole('textbox',{name:'Texto da página'})).toHaveValue(existingText.text);
});
