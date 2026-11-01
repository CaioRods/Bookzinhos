import {expect,it} from 'vitest';
import {spineWidth} from './Book3D';
import type {Book} from '../lib/types';
it('makes longer books thicker while keeping unknown page counts consistent',()=>{
 const width=(pages?:number,id='a')=>spineWidth({id,pageCount:pages} as Book);
 expect(width(100)).toBeLessThan(width(300));expect(width(300)).toBeLessThan(width(600));expect(width(600)).toBeLessThan(width(1000));
 expect(width(undefined,'a')).toBe(width(undefined,'different-id'));expect(width(0)).toBe(width(undefined));
 expect(width(Infinity)).toBe(width(undefined));expect(width(200000)).toBeLessThanOrEqual(112);
});
