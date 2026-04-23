export function normalizeAssetPath(path: string) {
  return path.replace(/^\.?\//, "");
}
