import { createRoot } from "react-dom/client";
import App from "./app/App";
import "./styles/index.css";
import "@fontsource-variable/plus-jakarta-sans/wght.css";
import "@fontsource/literata/latin-400.css";
import "@fontsource/literata/latin-600.css";
import "@fontsource/literata/latin-700.css";

createRoot(document.getElementById("root")!).render(<App />);

if ("serviceWorker" in navigator && location.protocol === "https:") {
  window.addEventListener("load", () => {
    navigator.serviceWorker.register("/image-cache-sw.js").catch(() => {
      /* O app continua normalmente quando o navegador bloqueia service workers. */
    });
  });
}
