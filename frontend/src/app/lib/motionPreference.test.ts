// @vitest-environment jsdom
import { beforeEach, expect, it } from "vitest";
import { saveSession } from "./session";
import { loadSettings, saveSettings } from "./settings";
beforeEach(()=>{localStorage.clear();delete document.documentElement.dataset.reduceMotion;});
it("starts new password/Google accounts with animation disabled even on a previously animated device",()=>{localStorage.setItem("mybooks-settings",JSON.stringify({reduceMotion:false}));saveSession({username:"Nova",animationsDefaultOff:true});expect(loadSettings().reduceMotion).toBe(true);expect(document.documentElement.dataset.reduceMotion).toBe("true");});
it("keeps animation preferences of existing accounts unchanged",()=>{localStorage.setItem("mybooks-settings",JSON.stringify({reduceMotion:false}));saveSession({username:"Antiga",animationsDefaultOff:false});expect(loadSettings().reduceMotion).toBe(false);saveSettings({...loadSettings(),reduceMotion:true});saveSession({username:"Antiga",animationsDefaultOff:false});expect(loadSettings().reduceMotion).toBe(true);});
it("lets new users enable animation without resetting it on login or profile refresh",()=>{saveSession({username:"Nova",animationsDefaultOff:true});saveSettings({...loadSettings(),reduceMotion:false});saveSession({username:"Nova",animationsDefaultOff:true});expect(loadSettings().reduceMotion).toBe(false);saveSession({username:"Outra",animationsDefaultOff:true});expect(loadSettings().reduceMotion).toBe(true);saveSession({username:"Nova",animationsDefaultOff:true});expect(loadSettings().reduceMotion).toBe(false);});
