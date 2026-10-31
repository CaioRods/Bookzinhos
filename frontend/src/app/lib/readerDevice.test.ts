// @vitest-environment jsdom
import { beforeEach, expect, it } from "vitest";
import { loadReaderPresets,saveReaderPresets,hasSeenReaderTutorial,rememberReaderTutorial } from "./readerDevice";
beforeEach(()=>{localStorage.clear();localStorage.setItem("books-username","Ana");});
it("keeps separate one/two-page presets scoped to the current account on this device",()=>{saveReaderPresets({single:{zoom:1.3,x:.1,y:-.2},double:{zoom:.8,x:0,y:.1}});expect(loadReaderPresets().single.zoom).toBe(1.3);localStorage.setItem("books-username","Outra");expect(loadReaderPresets().single.zoom).toBe(1);expect(loadReaderPresets().double.zoom).toBe(1);localStorage.setItem("books-username","ANA");expect(loadReaderPresets().double.zoom).toBe(.8);});
it("remembers tutorial dismissal per account without repeating on another book",()=>{expect(hasSeenReaderTutorial()).toBe(false);rememberReaderTutorial();expect(hasSeenReaderTutorial()).toBe(true);localStorage.setItem("books-username","Outra");expect(hasSeenReaderTutorial()).toBe(false);});
