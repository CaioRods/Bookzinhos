import { describe, expect, it } from "vitest";
import { prepareSocialImage, SOCIAL_IMAGE_MAX_BYTES } from "./socialImage";

describe("prepareSocialImage", () => {
  it("keeps the original file untouched so its resolution is preserved", async () => {
    const original = new File([new Uint8Array(2_383_992)], "coroacao.png", {
      type: "image/png",
    });

    const prepared = await prepareSocialImage(original);

    expect(prepared).toBe(original);
    expect(prepared.name).toBe("coroacao.png");
    expect(prepared.size).toBe(2_383_992);
    expect(prepared.type).toBe("image/png");
  });

  it("accepts original images up to 12 MB", () => {
    expect(SOCIAL_IMAGE_MAX_BYTES).toBe(12 * 1024 * 1024);
  });
});
