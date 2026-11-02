import { memo, type CSSProperties } from "react";
import { accentVariables, type SceneTheme } from "../lib/appearance";
import type { Size } from "../lib/avatarCrop";
import { CropArtwork } from "./CropArtwork";

/** A lightweight page silhouette; artwork keeps the real destination's source rectangle. */
export const ThemeProfilePreview = memo(function ThemeProfilePreview({ theme, profileSize, sidebarSize }: {
  theme: SceneTheme; profileSize: Size; sidebarSize: Size;
}) {
  const colors = accentVariables(theme.mainColor, document.documentElement.classList.contains("dark"));
  return <span className="mb-theme-profile-preview" aria-hidden="true" style={{ ...colors, aspectRatio: `${sidebarSize.width * .75} / ${sidebarSize.height * .18}` } as CSSProperties}>
    <span className="mb-theme-preview-sidebar">
      <span className="mb-theme-preview-brand"><i/> <b/></span>
      <span className="mb-theme-preview-sidebar-art" style={{ aspectRatio: `${sidebarSize.width}/${sidebarSize.height}` }}>
        <CropArtwork theme={theme} crop={theme.sidebar} surface="sidebar" opacity={theme.sidebarOpacity} referenceSize={sidebarSize} lazy/>
      </span>
      <span className="mb-theme-preview-nav"><i/><i/><i/><i/><i/></span>
    </span>
    <span className="mb-theme-preview-main">
      <span className="mb-theme-preview-topbar"><i/><b/></span>
      <span className="mb-theme-preview-hero" style={{ aspectRatio: `${profileSize.width}/${profileSize.height}` }}>
        <CropArtwork theme={theme} crop={theme.profile} surface="profile" referenceSize={profileSize} lazy/>
        <span className="mb-theme-preview-identity"><i/><span><b/><b/></span></span>
      </span>
      <span className="mb-theme-preview-stats"><i/><i/><i/></span>
      <span className="mb-theme-preview-panels"><span><b/><i/><i/><i/></span><span><b/><i/><i/><i/></span></span>
    </span>
  </span>;
});
