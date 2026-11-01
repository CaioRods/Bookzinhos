import {expect,it} from 'vitest';
import {dominantCoverColor,NEUTRAL_COVER_COLOR} from './coverColor';
import {accentVariables,colorToHex} from './appearance';
function image(...areas:[number,number,number,number][]){return new Uint8ClampedArray(areas.flatMap(([count,r,g,b])=>Array.from({length:count},()=>[r,g,b,255]).flat()));}
it('uses the real red accent on an 85% gray cover without inventing pink saturation',()=>{
 expect(dominantCoverColor(image([85,130,130,130],[15,180,25,30])).base).toBe('#b4191e');
});
it('preserves neutral covers and ignores a tiny colored speck',()=>{
 expect(dominantCoverColor(image([100,130,130,130])).base).toBe('#828282');
 expect(dominantCoverColor(image([99,130,130,130],[1,255,0,0])).base).toBe('#828282');
 expect(dominantCoverColor(new Uint8ClampedArray([0,0,0,0]))).toEqual(NEUTRAL_COVER_COLOR);
});
it('groups red across the hue wrap and chooses the most substantial color',()=>{
 expect(dominantCoverColor(image([70,15,60,170],[30,200,30,30])).base).toBe('#0f3caa');
 const red=dominantCoverColor(image([45,190,20,22],[45,190,22,20],[10,120,120,120])).base;
 expect(['#be1416','#be1614']).toContain(red);
});
it('converts all HSL hue sectors correctly for automatic page themes',()=>{
 expect(colorToHex('hsl(120 100% 50%)')).toBe('#00ff00');
 expect(colorToHex('hsl(180 100% 50%)')).toBe('#00ffff');
 expect(colorToHex('hsl(240 100% 50%)')).toBe('#0000ff');
 expect(colorToHex('hsl(360 100% 50%)')).toBe('#ff0000');
 expect(colorToHex('hsl(0 0% 50%)')).toBe('#808080');
});

it('keeps the selected cover pixel unchanged in light and dark book page themes',()=>{
 expect(accentVariables('#c0d0e0',false,true)['--primary']).toBe('#c0d0e0');
 expect(accentVariables('#163b8e',true,true)['--primary']).toBe('#163b8e');
 expect(accentVariables('#c0d0e0',false,true)['--primary-foreground']).toBe('#211526');
});
