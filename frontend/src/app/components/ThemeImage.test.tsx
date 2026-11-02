// @vitest-environment jsdom
import { act, cleanup, render } from "@testing-library/react";
import { afterEach, expect, it, vi } from "vitest";
import { ThemeImage } from "./ThemeImage";
import type { SceneTheme } from "../lib/appearance";
import { imageCropRect } from "../lib/imageCrop";
afterEach(() => {cleanup();vi.unstubAllGlobals();});
it("renders a known destination rectangle directly without a resize observer for each thumbnail", () => {
  const observe = vi.fn();
  vi.stubGlobal("ResizeObserver", class {observe=observe;disconnect() {}});
  const crop = {x:0,y:50,zoom:1.37};
  const theme = {imageUrl:"https://example.com/image.png",width:2400,height:1600} as SceneTheme;
  const reference = {width:247,height:607.5};
  const {container,rerender} = render(<ThemeImage theme={theme} crop={crop} referenceSize={reference}/>);
  const rect = imageCropRect(theme,reference,crop);
  expect(container.querySelector("svg")?.getAttribute("viewBox")).toBe(`${rect.left} ${rect.top} ${rect.width} ${rect.height}`);
  rerender(<ThemeImage theme={theme} crop={crop} referenceSize={reference}/>);
  expect(observe).not.toHaveBeenCalled();
});

it("loads catalog artwork only when the card approaches the visible area", () => {
  let reveal!: IntersectionObserverCallback;
  const observe=vi.fn(),unobserve=vi.fn(),disconnect=vi.fn();
  vi.stubGlobal("IntersectionObserver",class {constructor(callback:IntersectionObserverCallback){reveal=callback;}observe=observe;unobserve=unobserve;disconnect=disconnect;});
  const theme = {imageUrl:"https://example.com/image.png",width:2400,height:1600} as SceneTheme;
  const {container}=render(<ThemeImage theme={theme} crop={{x:50,y:50,zoom:1}} referenceSize={{width:1000,height:420}} lazy/>);
  expect(container.querySelector("image")).toBeNull();
  expect(observe).toHaveBeenCalledOnce();
  const target = container.querySelector("svg")!, bounds = target.getBoundingClientRect();
  act(()=>reveal([{target,isIntersecting:true,boundingClientRect:bounds,intersectionRect:bounds,rootBounds:null,intersectionRatio:1,time:0}],{} as IntersectionObserver));
  expect(container.querySelector("image")?.getAttribute("href")).toBe(theme.imageUrl);
  expect(unobserve).toHaveBeenCalled();
  expect(disconnect).toHaveBeenCalled();
});
