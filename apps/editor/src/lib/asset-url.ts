import { defaultGuideImageUrl } from "./defaultScene";

export function normalizeAssetPath(path: string) {
  return path.replace(/^\.?\//, "");
}

export function getFileAssetPath(file: File) {
  return normalizeAssetPath(file.webkitRelativePath || file.name);
}

export function resolveAssetUrl(
  path: string,
  assetUrls: Map<string, string>,
  fallbackUrl = "",
) {
  const normalized = normalizeAssetPath(path);
  if (!normalized) {
    return fallbackUrl;
  }

  const cached = assetUrls.get(normalized);
  if (cached) {
    return cached;
  }

  if (normalized === defaultGuideImageUrl.replace(/^\.?\//, "")) {
    return defaultGuideImageUrl;
  }

  if (isDirectUrl(path)) {
    return path;
  }

  return fallbackUrl;
}

function isDirectUrl(path: string) {
  return /^(?:[a-z][a-z0-9+.-]*:|\/\/)/i.test(path);
}
