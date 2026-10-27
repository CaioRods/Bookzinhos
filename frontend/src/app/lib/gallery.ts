export const clampGalleryIndex = (index: number, total: number) =>
  Math.min(Math.max(0, index), Math.max(0, total - 1));

export const clampGalleryZoom = (zoom: number) =>
  Math.min(4, Math.max(1, zoom));

export const doubleClickGalleryZoom = (zoom: number) =>
  zoom > 1 ? 1 : 2;

export function gallerySwipeIndex(
  distanceX: number,
  index: number,
  total: number,
) {
  if (Math.abs(distanceX) < 64) return index;
  return clampGalleryIndex(index + (distanceX < 0 ? 1 : -1), total);
}
