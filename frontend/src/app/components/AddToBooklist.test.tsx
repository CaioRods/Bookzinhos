// @vitest-environment jsdom
import "@testing-library/jest-dom/vitest";
import { cleanup,fireEvent,render,screen,waitFor } from "@testing-library/react";
import { afterEach,expect,it,vi } from "vitest";
import { AddToBooklist } from "./AddToBooklist";
import type { Book } from "../lib/types";
const { save }=vi.hoisted(()=>({save:vi.fn(async (id,bookId)=>({id,name:"Nova",bookIds:["other",bookId]}))}));
vi.mock("../lib/booklists",()=>({fetchBooklists:async()=>[{id:"already",name:"Já está",bookIds:["book"]},{id:"new",name:"Nova",bookIds:["other"]}],addBookToBooklist:save}));
vi.mock("./FolderArtwork",()=>({FolderArtwork:({list}:{list:{name:string}})=><span>{list.name}</span>}));
afterEach(cleanup);
it("blocks existing membership and appends a book once while preserving list order",async()=>{render(<AddToBooklist book={{id:"book",title:"Livro"} as Book} onClose={()=>{}}/>);const blocked=await screen.findByRole("button",{name:"Já está: livro já adicionado"});expect(blocked).toBeDisabled();fireEvent.click(screen.getByRole("button",{name:"Adicionar a Nova"}));await waitFor(()=>expect(save).toHaveBeenCalledWith("new","book"));expect(await screen.findByRole("button",{name:"Nova: livro já adicionado"})).toBeDisabled();});
