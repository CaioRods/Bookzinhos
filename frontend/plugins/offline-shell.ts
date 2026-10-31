import type { Plugin } from "vite";
import { createHash } from "node:crypto";
export function offlineShell(): Plugin {
  return {
    name: "mybooks-offline-shell",
    generateBundle(_options, bundle) {
      const files = ["/", "/index.html", "/manifest.json", "/theme-bootstrap.js", "/logo.svg", "/icon-192.png", "/icon-512.png", "/scenery/landscapes.webp", "/scenery/golden-branches.webp", ...Object.keys(bundle).filter(file => /\.(js|mjs|css|woff2?)$/.test(file)).map(file => "/" + file)];
      const version = createHash("sha256").update(JSON.stringify(Object.keys(bundle))).update(String(bundle["index.html"]?.type === "asset" ? bundle["index.html"].source : "")).digest("hex").slice(0, 16);
      this.emitFile({ type: "asset", fileName: "precache.js", source: `self.MYBOOKS_SHELL=${JSON.stringify({ version, files })};` });
    },
  };
}
