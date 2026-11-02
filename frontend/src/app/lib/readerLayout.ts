export type ReaderLayout = "scroll" | "single" | "double";
/** Rotation never replaces the saved manual preference or continuous scrolling. */
export function resolveReaderLayout(manual: ReaderLayout, automatic: boolean, mobilePdf: boolean, width: number, height: number): ReaderLayout {
  if (!automatic || !mobilePdf || manual === "scroll") return manual;
  return width > height ? "double" : "single";
}
