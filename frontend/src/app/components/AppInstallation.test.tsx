// @vitest-environment jsdom
import "@testing-library/jest-dom/vitest";
import { act, cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, expect, it, vi } from "vitest";
import { AppInstallation } from "./AppInstallation";
afterEach(cleanup);
it("provides Chrome installation instructions when no native prompt is available",()=>{render(<AppInstallation/>);fireEvent.click(screen.getByRole("button",{name:"Instalar myBooks"}));expect(screen.getByText(/Instalar página como app/)).toBeInTheDocument();});
it("retains the browser prompt before Settings mounts, installs on click and reflects appinstalled",async()=>{const prompt=vi.fn(async()=>{});const event=new Event("beforeinstallprompt",{cancelable:true});Object.assign(event,{prompt,userChoice:Promise.resolve({outcome:"accepted"})});act(()=>window.dispatchEvent(event));expect(event.defaultPrevented).toBe(true);render(<AppInstallation/>);fireEvent.click(screen.getByRole("button",{name:"Instalar myBooks"}));await waitFor(()=>expect(prompt).toHaveBeenCalledOnce());act(()=>window.dispatchEvent(new Event("appinstalled")));expect(screen.getByRole("button",{name:"myBooks instalado"})).toBeDisabled();});
