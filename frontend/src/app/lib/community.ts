import { API_BASE_URL } from "./config";
import { getUsername } from "./session";
export type Reaction = "heart" | "panda" | "sad" | "moved";
export interface SocialComment {
  id: string;
  parent_id: string | null;
  username: string;
  avatar: string;
  content: string;
  created_at: number;
  reactions: Partial<Record<Reaction, number>>;
  myReaction: Reaction | null;
}
export interface SocialPost extends Omit<SocialComment, "parent_id"> {
  images: string[];
  book_id: string | null;
  book: {
    id: string;
    title: string;
    author: string;
    cover_image_path: string | null;
  } | null;
  comments: SocialComment[];
  repostCount: number;
  repostedByMe: boolean;
  repostedBy?: string[];
}
export interface Series {
  id: string;
  name: string;
}
export async function communityApi<T>(
  path: string,
  method = "GET",
  body?: unknown,
): Promise<T> {
  const response = await fetch(API_BASE_URL + path, {
    method,
    headers: {
      "x-user-id": getUsername() || "anonymous",
      ...(body instanceof FormData
        ? {}
        : { "Content-Type": "application/json" }),
    },
    body:
      body === undefined
        ? undefined
        : body instanceof FormData
          ? body
          : JSON.stringify(body),
  });
  const data = await response.json().catch(() => null);
  if (!response.ok)
    throw new Error(
      data?.error ||
        (response.status === 404
          ? "A API publicada ainda não tem este recurso."
          : "Não foi possível concluir."),
    );
  return data;
}
