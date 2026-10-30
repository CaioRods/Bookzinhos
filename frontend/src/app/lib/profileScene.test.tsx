// @vitest-environment jsdom
import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, expect, it } from "vitest";
import {
  ProfileSceneProvider,
  useProfileScene,
  usePublicProfileScene,
} from "./profileScene";
import { NO_THEME } from "./themeCatalog";
function Observer() {
  const { scene } = useProfileScene();
  return <span>{scene?.id || "viewer"}</span>;
}
afterEach(cleanup);
it("restores the viewer scenery when leaving a public profile without changing their preference", () => {
  localStorage.setItem("mybooks-settings", JSON.stringify({ scene: "golden" }));
  // Keep the preview object stable, just as the fetched profile data is stable.
  const scene = { ...NO_THEME, id: "forest" };
  function StablePreview() {
    usePublicProfileScene(scene);
    return null;
  }
  const view = render(
    <ProfileSceneProvider>
      <Observer />
      <StablePreview />
    </ProfileSceneProvider>,
  );
  expect(screen.getByText("forest")).toBeTruthy();
  view.rerender(
    <ProfileSceneProvider>
      <Observer />
    </ProfileSceneProvider>,
  );
  expect(screen.getByText("viewer")).toBeTruthy();
  expect(
    JSON.parse(localStorage.getItem("mybooks-settings") || "{}").scene,
  ).toBe("golden");
});
