// @vitest-environment jsdom
import { beforeEach, expect, it, vi } from "vitest";
const { installed, calls, install } = vi.hoisted(() => ({ installed:new Set<string>(), calls:[] as string[], install:vi.fn() }));
vi.mock("./device",()=>({account:()=>"ana",isOffline:()=>false,DEVICE_EVENT:"mybooks:device",deviceChanged:()=>{},cancelInstall:vi.fn(),installedBook:async(id:string)=>installed.has(id)?{id}:null,installBook:install}));
import { installBooklist } from "./batch";
beforeEach(()=>{installed.clear();calls.length=0;install.mockReset();});
it("installs sequentially in selection order and skips installed books",async()=>{installed.add("already");let running=0,max=0;install.mockImplementation(async(id:string)=>{calls.push(id);running++;max=Math.max(max,running);await Promise.resolve();installed.add(id);running--;});await installBooklist("sequence",["second","already","first"]);expect(calls).toEqual(["second","first"]);expect(max).toBe(1);});
it("continues after an unavailable book without marking it installed",async()=>{install.mockImplementation(async(id:string)=>{calls.push(id);if(id==="broken")throw new Error("removed");installed.add(id);});await installBooklist("failure",["first","broken","last"]);expect(calls).toEqual(["first","broken","last"]);expect(installed.has("broken")).toBe(false);expect(installed.has("last")).toBe(true);});
