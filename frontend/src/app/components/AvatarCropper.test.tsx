// @vitest-environment jsdom
import { act, cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, expect, it, vi } from "vitest";
import { AvatarCropper, cropAvatar } from "./AvatarCropper";
import { imageCropRect } from "../lib/imageCrop";
afterEach(() => { cleanup(); vi.restoreAllMocks(); vi.unstubAllGlobals(); });

it("keeps the displayed aperture and exported crop identical when the editor shrinks", async () => {
  let stageWidth = 320;
  let resize = () => {};
  vi.spyOn(HTMLElement.prototype,"getBoundingClientRect").mockImplementation(() => ({width:stageWidth,height:stageWidth,x:0,y:0,left:0,top:0,right:stageWidth,bottom:stageWidth,toJSON(){}}));
  vi.stubGlobal("ResizeObserver",class {constructor(callback:()=>void){resize=callback;}observe(){}disconnect(){}});
  const onChange = vi.fn();
  const {container} = render(<AvatarCropper source="blob:test-avatar" onChange={onChange}/>);
  const img = container.querySelector("img")!;
  Object.defineProperties(img,{naturalWidth:{value:2400},naturalHeight:{value:1600}});
  fireEvent.load(img);
  fireEvent.change(screen.getByRole("slider"),{target:{value:"1.55"}});
  const source = {width:2400,height:1600};
  const crop = onChange.mock.calls.at(-1)![0];
  const expected = imageCropRect(source,{width:240,height:240},crop);
  for(const width of [320,240,180]) {
    act(()=>{stageWidth=width;resize();});
    const scale = parseFloat(img.style.width)/source.width;
    const match = img.style.transform.match(/translate3d\(([-\d.]+)px, ([-\d.]+)px/)!;
    expect((width*.125-Number(match[1]))/scale).toBeCloseTo(expected.left,8);
    expect((width*.125-Number(match[2]))/scale).toBeCloseTo(expected.top,8);
    expect(width*.75/scale).toBeCloseTo(expected.width,8);
  }
  const draw = vi.fn();
  vi.stubGlobal("Image",class {naturalWidth=2400;naturalHeight=1600;src="";async decode(){}});
  vi.spyOn(HTMLCanvasElement.prototype,"getContext").mockReturnValue({drawImage:draw} as unknown as CanvasRenderingContext2D);
  vi.spyOn(HTMLCanvasElement.prototype,"toBlob").mockImplementation(callback=>callback(new Blob(["test"],{type:"image/webp"})));
  await cropAvatar("blob:test-avatar",crop.x,crop.y,crop.zoom);
  expect(draw.mock.calls[0].slice(1,5)).toEqual([expected.left,expected.top,expected.width,expected.height]);
});
