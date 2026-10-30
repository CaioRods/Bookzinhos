import {
  createContext,
  useContext,
  useEffect,
  useState,
  type Dispatch,
  type ReactNode,
  type SetStateAction,
} from "react";
import type { SceneTheme } from "./appearance";
const Context = createContext<{
  scene: SceneTheme | null;
  setScene: Dispatch<SetStateAction<SceneTheme | null>>;
}>({ scene: null, setScene: () => {} });
export function ProfileSceneProvider({ children }: { children: ReactNode }) {
  const [scene, setScene] = useState<SceneTheme | null>(null);
  return (
    <Context.Provider value={{ scene, setScene }}>{children}</Context.Provider>
  );
}
export const useProfileScene = () => useContext(Context);
/** A public profile temporarily previews its owner's scene without changing the visitor's preference. */
export function usePublicProfileScene(scene: SceneTheme | null) {
  const { setScene } = useProfileScene();
  useEffect(() => {
    setScene(scene);
    return () => setScene(null);
  }, [scene, setScene]);
}
