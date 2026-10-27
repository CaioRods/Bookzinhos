export const SCENES = [
  { id: "lilac", name: "Montanhas de Lilás", column: 0, row: 0 },
  { id: "golden", name: "Vale Dourado", column: 1, row: 0 },
  { id: "forest", name: "Floresta Verdejante", column: 0, row: 1 },
  { id: "coast", name: "Costa do Oceano", column: 1, row: 1 },
  { id: "spring", name: "Primavera Serena", column: 0, row: 2 },
  { id: "night", name: "Noite Estrelada", column: 1, row: 2 },
] as const;
export type SceneId = typeof SCENES[number]["id"];
export const DEFAULT_SCENE: SceneId = "lilac";
export function validScene(value: unknown): SceneId {
  return SCENES.some(scene => scene.id === value) ? value as SceneId : DEFAULT_SCENE;
}
