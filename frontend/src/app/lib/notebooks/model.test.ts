import { expect,it } from "vitest";import { blankPage,strokePath,strokeHit,wrapText } from "./model";
it("retains precise vector coordinates and makes a single pen dot visible",()=>{expect(strokePath([[1.25,3.44],[7,9]])).toBe("M1.3 3.4 L7.0 9.0");expect(strokePath([[1,2]])).toContain("l.1 .1");});
it("wraps long lines and preserves explicit newlines",()=>{expect(wrapText("abcdef\ngh",3,1,s=>s.length)).toEqual(["abc","def","gh"]);expect(blankPage().elements).toEqual([]);});

it("erases a line between sparsely sampled pointer points",()=>{const stroke={id:"line",type:"stroke" as const,points:[[10,10],[300,10]] as [number,number][],color:"#112233",width:3,opacity:1};expect(strokeHit(stroke,[150,15],8)).toBe(true);expect(strokeHit(stroke,[150,90],8)).toBe(false);});
