import { Award } from "lucide-react";
import type { ReaderBadge } from "../lib/types";

export function BadgeGallery({ badges }: { badges: ReaderBadge[] }) {
  return <section className="mb-badge-gallery"><header><h2>Selos conquistados</h2><span>{badges.length}</span></header>{badges.length ? <div>{badges.map((badge) => <article key={badge.code} aria-label={`${badge.name}: ${badge.description}`}><Award aria-hidden="true" /><strong>{badge.name}</strong><small>{badge.description}</small></article>)}</div> : <p>As próximas conquistas aparecerão aqui.</p>}</section>;
}
