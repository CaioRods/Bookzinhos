import { useCropSurfaceSize } from "./useCropSurfaceSize";
export interface ProfileBannerSize { width: number; height: number }
/** Uses the same surface measurement as sidebar and book-banner previews. */
export function useProfileBannerSize(enabled: boolean) {
  return useCropSurfaceSize("profile", enabled);
}
