import { createRoot } from "react-dom/client";
import App from "./app/App";
import "./styles/index.css";

createRoot(document.getElementById("root")!).render(<App />);

if ("serviceWorker" in navigator && location.protocol === "https:") {
  window.addEventListener("load", () => {
    navigator.serviceWorker.register("/image-cache-sw.js").catch(() => {
      /* O app continua normalmente quando o navegador bloqueia service workers. */
    });
  });
}
