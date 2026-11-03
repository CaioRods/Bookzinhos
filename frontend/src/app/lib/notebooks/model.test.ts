import { expect,it } from "vitest";import { blankPage,strokePath,strokeHit,wrapText } from "./model";
it("retains precise vector coordinates and makes a single pen dot visible",()=>{expect(strokePath([[1.25,3.44],[7,9]])).toBe("M1.3 3.4 L7.0 9.0");expect(strokePath([[1,2]])).toContain("l.1 .1");});
it("wraps long lines and preserves explicit newlines",()=>{expect(wrapText("abcdef\ngh",3,1,s=>s.length)).toEqual(["abc","def","gh"]);expect(blankPage().elements).toEqual([]);});

it("erases a line between sparsely sampled pointer points",()=>{const stroke={id:"line",type:"stroke" as const,points:[[10,10],[300,10]] as [number,number][],color:"#112233",width:3,opacity:1};expect(strokeHit(stroke,[150,15],8)).toBe(true);expect(strokeHit(stroke,[150,90],8)).toBe(false);});

it("snaps new text to the same paper baselines and retains a 32px rhythm",async()=>{
 const model=await import('./model');const box=model.ruledTextBox([70,120],22);
 expect(box).toMatchObject({x:66,y:114,width:694,flow:'ruled'});
 const text={...box,id:'text',type:'text' as const,text:'a',size:22,color:'#112233',font:'sans' as const,bold:false,italic:false,underline:false,align:'left' as const};
 expect(model.textBaseline(text,0)).toBe(136);expect(model.textBaseline(text,1)).toBe(168);expect(model.textLineHeight(text)).toBe(32);
 expect(model.textLineHeight({...text,size:48})).toBe(64);
 expect(model.textLineHeight({...text,flow:undefined})).toBeCloseTo(30.8);
});

it('keeps large fonts inside the sheet while preserving the baseline grid',async()=>{
 const {ruledTextBox}=await import('./model');const box=ruledTextBox([70,72],96);
 expect(box.y).toBe(8);expect(box.y+96).toBe(104);
});
