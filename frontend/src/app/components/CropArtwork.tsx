import type { ImageCrop, SceneTheme } from "../lib/appearance";
import type { CropSurface } from "../lib/useCropSurfaceSize";
import type { Size } from "../lib/avatarCrop";
import { ThemeImage } from "./ThemeImage";

/** The finished image layer is shared by previews and their real destinations. */
export function CropArtwork({ theme, crop, surface, opacity = 1, blur = 0, referenceSize }: {
  theme: SceneTheme; crop: ImageCrop; surface: CropSurface; opacity?: number; blur?: number; referenceSize?: Size;
}) {
  const kind = surface === "book" ? "banner" : surface;
  return <div className={`mb-crop-artwork is-${kind}`}>
    <div className="mb-crop-image-layer" style={{ opacity, filter: blur ? `blur(${blur}px)` : undefined }}>
      <ThemeImage theme={theme} crop={crop} referenceSize={referenceSize}/>
    </div>
    {(kind === "profile" || kind === "banner") && <span className={`mb-crop-shade is-${kind}`} />}
  </div>;
}
