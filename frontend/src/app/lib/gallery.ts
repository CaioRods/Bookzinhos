export const clampGalleryZoom = (zoom: number) =>
  Math.min(4, Math.max(1, zoom));

export const doubleClickGalleryZoom = (zoom: number) =>
  zoom > 1 ? 1 : 2;
