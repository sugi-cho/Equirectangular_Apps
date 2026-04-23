import { readFileAsDataUrl } from "../../../shared/src/media";

export async function loadImageMetadata(file: File) {
  const url = await readFileAsDataUrl(file);
  const image = new Image();
  image.decoding = "async";
  image.src = url;
  await image.decode();
  return {
    url,
    height: image.naturalHeight,
    aspect: image.naturalWidth / image.naturalHeight,
  };
}

export async function loadSingleImageFile(
  file: File,
  onSuccess: (image: { url: string; height: number; aspect: number }) => void,
  errorMessage: string,
) {
  try {
    const image = await loadImageMetadata(file);
    onSuccess(image);
  } catch (error) {
    console.error(error);
    window.alert(errorMessage);
  }
}
