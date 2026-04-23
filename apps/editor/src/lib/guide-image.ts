import { defaultGuideImageUrl } from "./defaultScene";

export function resolveGuideImageUrl(value: string | undefined) {
  return value && value.trim() ? value : defaultGuideImageUrl;
}
