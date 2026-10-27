import { Check } from "lucide-react";
import { SCENES, validScene, type SceneId } from "../lib/scenery";
import { useSettings } from "../lib/settings";

/** The SVG viewport crops each landscape without stretching panoramic art. */
export function Scenery({ scene, className = "" }: { scene: SceneId; className?: string }) {
  const selected = SCENES.find(option => option.id === validScene(scene))!;
  return <svg aria-hidden="true" className={`mb-scenery ${className}`} viewBox="0 0 768 341.333" preserveAspectRatio="xMidYMid slice">
    <image href="/scenery/landscapes.webp" x={-selected.column * 768} y={-selected.row * 341.333} width="1536" height="1024" />
  </svg>;
}
export function ScenePicker() {
  const [settings, update] = useSettings();
  return <section id="profile-scenery" className="mb-scene-section" aria-labelledby="scene-heading">
    <h2 id="scene-heading">Escolha seu cenário</h2>
    <p>Personalize seu espaço de leitura. Sua escolha fica salva neste aparelho.</p>
    <div className="mb-scene-grid">{SCENES.map(scene => <button key={scene.id} onClick={() => update({ scene: scene.id })} aria-pressed={settings.scene === scene.id} className="mb-scene-option">
      <Scenery scene={scene.id} />
      <span className="mb-scene-name">{scene.name}</span>
      {settings.scene === scene.id && <span className="mb-scene-selected"><Check size={15} /> Selecionado</span>}
    </button>)}</div>
  </section>;
}
