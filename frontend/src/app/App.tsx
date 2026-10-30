import { ProfileSceneProvider } from "./lib/profileScene";
import { ThemeCatalogProvider } from "./lib/themeCatalog";
import { RouterProvider } from "react-router";
import { router } from "./routes";

export default function App() {
  return <ThemeCatalogProvider><ProfileSceneProvider><RouterProvider router={router} /></ProfileSceneProvider></ThemeCatalogProvider>;
}