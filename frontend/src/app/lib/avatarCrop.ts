export type Size = { width: number; height: number };
export type Transform = { x: number; y: number; scale: number };
export type SourceRect = { left: number; top: number; width: number; height: number };

const finite = (value: number, fallback: number) => Number.isFinite(value) ? value : fallback;

export function fitAvatar(source: Size, viewport: Size, zoom = 1): Transform {
  const safeZoom = Math.max(1, finite(zoom, 1));
  const scale = Math.max(viewport.width / source.width, viewport.height / source.height) * safeZoom;
  return {
    x: (viewport.width - source.width * scale) / 2,
    y: (viewport.height - source.height * scale) / 2,
    scale,
  };
}

export function clampAvatarTransform(
  transform: Transform,
  source: Size,
  viewport: Size,
): Transform {
  const minimum = Math.max(viewport.width / source.width, viewport.height / source.height);
  const scale = Math.max(minimum, finite(transform.scale, minimum));
  const minX = viewport.width - source.width * scale;
  const minY = viewport.height - source.height * scale;
  return {
    x: Math.min(0, Math.max(minX, finite(transform.x, minX / 2))),
    y: Math.min(0, Math.max(minY, finite(transform.y, minY / 2))),
    scale,
  };
}

export function avatarSourceRect(
  transform: Transform,
  source: Size,
  viewport: Size,
): SourceRect {
  const safe = clampAvatarTransform(transform, source, viewport);
  return {
    left: -safe.x / safe.scale,
    top: -safe.y / safe.scale,
    width: viewport.width / safe.scale,
    height: viewport.height / safe.scale,
  };
}

export function cropToTransform(
  crop: { x: number; y: number; zoom: number },
  source: Size,
  viewport: Size,
): Transform {
  const base = fitAvatar(source, viewport, crop.zoom);
  const overflowX = Math.max(0, source.width * base.scale - viewport.width);
  const overflowY = Math.max(0, source.height * base.scale - viewport.height);
  return clampAvatarTransform({
    x: -overflowX * Math.max(0, Math.min(100, crop.x)) / 100,
    y: -overflowY * Math.max(0, Math.min(100, crop.y)) / 100,
    scale: base.scale,
  }, source, viewport);
}
