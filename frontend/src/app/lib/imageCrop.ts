import type { ImageCrop } from "./appearance";
import { avatarSourceRect, cropToTransform, type Size } from "./avatarCrop";

/** One source rectangle for the editor, rendered artwork and exported avatars. */
export function imageCropRect(source: Size, viewport: Size, crop: ImageCrop) {
  return avatarSourceRect(cropToTransform(crop, source, viewport), source, viewport);
}

export function moveImageCrop(source: Size, viewport: Size, initial: ImageCrop, dx: number, dy: number): ImageCrop {
  const transform = cropToTransform(initial, source, viewport);
  const travelX = Math.max(0, source.width * transform.scale - viewport.width);
  const travelY = Math.max(0, source.height * transform.scale - viewport.height);
  const clamp = (value: number) => Math.max(0, Math.min(100, value));
  return { ...initial, x: travelX > .001 ? clamp(initial.x - dx / travelX * 100) : initial.x, y: travelY > .001 ? clamp(initial.y - dy / travelY * 100) : initial.y };
}
