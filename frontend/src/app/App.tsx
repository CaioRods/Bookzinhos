import { ThemeCatalogProvider } from "./lib/themeCatalog";
import { RouterProvider } from "react-router";
import { router } from "./routes";

export default function App() {
  return <ThemeCatalogProvider><RouterProvider router={router} /></ThemeCatalogProvider>;
}