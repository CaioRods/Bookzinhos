// @vitest-environment jsdom
import '@testing-library/jest-dom/vitest';
import React,{useState} from 'react';import {render,screen,fireEvent,cleanup,within} from '@testing-library/react';import {afterEach,expect,it,vi} from 'vitest';
import type {SceneTheme} from '../lib/appearance';
vi.mock('../lib/useProfileBannerSize',()=>({useProfileBannerSize:()=>({width:1136,height:420})}));
vi.mock('./ThemeImage',()=>({sourceSize:()=>({width:2400,height:1600}),ThemeImage:()=>null}));
import {CropEditor} from './CropEditor';
afterEach(cleanup);
function Editor(){const [crop,setCrop]=useState({x:50,y:50,zoom:1});return <CropEditor theme={{} as SceneTheme} value={crop} onChange={setCrop} label="Recorte do perfil"/>;}
it('supports fine numeric positioning, 0.01 zoom and fine keyboard adjustments',()=>{
 render(<Editor/>);const x=screen.getByRole('spinbutton',{name:'Recorte do perfil: Horizontal exato'});
 fireEvent.change(x,{target:{value:'63.25'}});expect(x).toHaveValue(63.25);
 fireEvent.keyDown(screen.getByRole('img',{name:'Prévia interativa: Recorte do perfil'}),{key:'ArrowRight',altKey:true});expect(x).toHaveValue(63.35);
 const zoom=screen.getByRole('slider',{name:'Recorte do perfil: Zoom'});expect(zoom).toHaveAttribute('step','0.01');fireEvent.change(zoom,{target:{value:'1.37'}});expect(screen.getByRole('spinbutton',{name:'Recorte do perfil: Zoom exato'})).toHaveValue(1.37);
});
it('keeps adjustments when entering and leaving the enlarged editor and can reset the framing',()=>{
 render(<Editor/>);fireEvent.click(screen.getByRole('button',{name:'Ampliar área de ajuste'}));const dialog=screen.getByRole('dialog',{name:'Ajustar recorte do perfil'});
 fireEvent.change(within(dialog).getByRole('spinbutton',{name:'Recorte do perfil: Vertical exato'}),{target:{value:'72.6'}});fireEvent.click(within(dialog).getByRole('button',{name:'Concluir ajuste'}));
 expect(screen.getByRole('spinbutton',{name:'Recorte do perfil: Vertical exato'})).toHaveValue(72.6);
 fireEvent.click(screen.getByRole('button',{name:'Centralizar e redefinir zoom'}));expect(screen.getByRole('spinbutton',{name:'Recorte do perfil: Vertical exato'})).toHaveValue(50);
});
