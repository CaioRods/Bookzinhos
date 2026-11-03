import { Award } from "lucide-react";
import { useId, useState } from "react";
import type { ReaderBadge } from "../lib/types";

export function BadgeGallery({ badges }: { badges: ReaderBadge[] }) {
  const [expanded, setExpanded] = useState(false);
  const galleryId = useId();
  const visible = expanded ? badges : badges.slice(0, 2);
  return <section className="mb-badge-gallery"><header><h2>Selos conquistados</h2><span>{badges.length}</span></header>{badges.length ? <div id={galleryId}>{visible.map((badge) => <article key={badge.code} aria-label={`${badge.name}: ${badge.description}`}><Award aria-hidden="true" /><strong>{badge.name}</strong><small>{badge.description}</small></article>)}</div> : <p>As próximas conquistas aparecerão aqui.</p>}{badges.length > 2 && <button type="button" className="mb-badge-toggle mb-btn mb-btn-ghost mb-btn-sm" aria-expanded={expanded} aria-controls={galleryId} onClick={() => setExpanded(value => !value)}>{expanded ? "Ver menos" : `Ver mais ${badges.length - 2} ${badges.length - 2 === 1 ? "selo" : "selos"}`}</button>}</section>;
}
