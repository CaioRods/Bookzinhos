export const clampGalleryIndex = (index: number, total: number) =>
  Math.min(Math.max(0, index), Math.max(0, total - 1));

export const clampGalleryZoom = (zoom: number) =>
  Math.min(4, Math.max(1, zoom));
