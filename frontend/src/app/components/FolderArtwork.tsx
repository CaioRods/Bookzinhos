import { useId, type CSSProperties } from "react";
import { Heart, Sparkles, Bookmark, Castle, Coffee, Zap, BookOpen, Moon, Flower2, Library } from "lucide-react";
import type { Booklist } from "../lib/booklists";
import type { SceneTheme } from "../lib/appearance";
import { ThemeImage } from "./ThemeImage";
export const BOOKLIST_ICONS = { heart: Heart, sparkles: Sparkles, bookmark: Bookmark, castle: Castle, coffee: Coffee, zap: Zap, book: BookOpen, moon: Moon, flower: Flower2, library: Library };
export function FolderArtwork({ list }: { list: Booklist }) {
  const artId = useId().replace(/:/g, "");
  const Icon = BOOKLIST_ICONS[list.icon as keyof typeof BOOKLIST_ICONS] || Heart;
  const theme: SceneTheme = { id: list.id, name: list.name, scope: "personal", imageUrl: list.imageUrl, width: list.imageWidth, height: list.imageHeight, mainColor: list.color, profile: list.crop, sidebar: list.crop, sidebarOpacity: 1 };
  return <div className={`mb-folder-art ${list.imageUrl ? "has-image" : ""}`} style={{ "--folder-color": list.color } as CSSProperties}>
    {list.imageUrl && <ThemeImage theme={theme} crop={list.crop}/>}
    <div className="mb-folder-glow"/><svg className="mb-folder-shape" viewBox="0 0 280 300" aria-hidden="true"><defs>
      <linearGradient id={`${artId}-back`} x1="0" y1="0" x2="1" y2="1"><stop stopColor={list.imageUrl ? "#ffffff" : list.color} stopOpacity={list.imageUrl ? .16 : .85}/><stop offset="1" stopColor={list.imageUrl ? "#ffffff" : list.color} stopOpacity={list.imageUrl ? .04 : .5}/></linearGradient>
      <linearGradient id={`${artId}-glass`} x1="0" y1="0" x2="1" y2=".35"><stop stopColor="#ffffff" stopOpacity={list.imageUrl ? .15 : .55}/><stop offset=".2" stopColor={list.imageUrl ? "#ffffff" : list.color} stopOpacity={list.imageUrl ? .05 : .5}/><stop offset=".75" stopColor={list.imageUrl ? "#ffffff" : list.color} stopOpacity={list.imageUrl ? .01 : .7}/><stop offset="1" stopColor="#ffffff" stopOpacity={list.imageUrl ? .13 : .65}/></linearGradient>
    </defs><path className="mb-folder-back" style={{fill:`url(#${artId}-back)`}} d="M12 56Q12 27 39 27H86Q98 27 107 39L126 62Q132 69 146 69H241Q269 69 269 96V251Q269 278 242 278H39Q12 278 12 251Z"/><rect className="mb-folder-paper" x="20" y="77" width="239" height="203" rx="24"/><rect className="mb-folder-front" style={{fill:`url(#${artId}-glass)`}} x="16" y="91" width="251" height="194" rx="25"/></svg>
    <div className="mb-folder-copy"><strong>{list.name || "Minha Booklist"}</strong><span>{list.bookIds.length} {list.bookIds.length === 1 ? "livro" : "livros"}</span><Icon size={29} fill="currentColor" strokeWidth={1.2}/></div>
  </div>;
}
