import {
  BackSide,
  CanvasTexture,
  ClampToEdgeWrapping,
  DataTexture,
  HalfFloatType,
  LinearFilter,
  NoColorSpace,
  RedFormat,
  RGFormat,
  SRGBColorSpace,
  ShaderMaterial,
  type Side,
  UnsignedByteType,
  Vector2,
} from "three";

export type StMapManifest = {
  version: number;
  revision: string;
  source: {
    fileName: string;
    width: number;
    height: number;
  };
  crop: {
    x: number;
    y: number;
    width: number;
    height: number;
  };
  cropUv: {
    x: number;
    y: number;
    width: number;
    height: number;
  };
  format: {
    channels: "rg";
    encoding: "float16";
  };
  files: {
    pixels: string;
    mask: string;
  };
};

export type StMapBundle = {
  manifest: StMapManifest;
  pixelsTexture: DataTexture;
  maskTexture: DataTexture;
};

const STMAP_BASE_URL = "/stmap/current/";
const STMAP_MANIFEST_URL = `${STMAP_BASE_URL}stmap.json`;

type CreateStMapOverlayMaterialOptions = {
  side?: Side;
};

export function createStMapOverlayMaterial(options: CreateStMapOverlayMaterialOptions = {}) {
  return new ShaderMaterial({
    side: options.side ?? BackSide,
    transparent: true,
    depthTest: false,
    depthWrite: false,
    toneMapped: false,
    uniforms: {
      sourceTexture: { value: null },
      pixelsTexture: { value: null },
      maskTexture: { value: null },
      cropRectUv: { value: new Vector2(0, 0) },
      cropSizeUv: { value: new Vector2(1, 1) },
      sourceRectOffset: { value: new Vector2(0, 0) },
      sourceRectSize: { value: new Vector2(1, 1) },
    },
    vertexShader: `
      varying vec2 vUv;
      void main() {
        vUv = uv;
        gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
      }
    `,
    fragmentShader: `
      precision highp float;

      varying vec2 vUv;
      uniform sampler2D sourceTexture;
      uniform sampler2D pixelsTexture;
      uniform sampler2D maskTexture;
      uniform vec2 cropRectUv;
      uniform vec2 cropSizeUv;
      uniform vec2 sourceRectOffset;
      uniform vec2 sourceRectSize;

      void main() {
        vec2 local = vUv - cropRectUv;
        if (local.x < 0.0 || local.y < 0.0 || local.x >= cropSizeUv.x || local.y >= cropSizeUv.y) {
          discard;
        }

        vec2 sampleUv = local / cropSizeUv;
        if (texture2D(maskTexture, sampleUv).r < 0.5) {
          discard;
        }
        vec2 sourceUv = texture2D(pixelsTexture, sampleUv).rg;
        vec2 logicalUv = (sourceUv - sourceRectOffset) / sourceRectSize;
        if (logicalUv.x < 0.0 || logicalUv.y < 0.0 || logicalUv.x > 1.0 || logicalUv.y > 1.0) {
          discard;
        }
        gl_FragColor = texture2D(sourceTexture, logicalUv);
        #include <colorspace_fragment>
      }
    `,
  });
}

export function createStretchedImageTexture(
  image: CanvasImageSource,
  sourceWidth: number,
  sourceHeight: number,
) {
  const canvas = document.createElement("canvas");
  canvas.width = 2048;
  canvas.height = 1024;
  const context = canvas.getContext("2d");
  if (!context) {
    throw new Error("Failed to create 2D canvas context for STMap source.");
  }

  context.clearRect(0, 0, canvas.width, canvas.height);
  // STMap preview と同じく、元メディアは UV 全体に合わせて引き延ばす。
  context.drawImage(image, 0, 0, canvas.width, canvas.height);

  const texture = new CanvasTexture(canvas);
  texture.needsUpdate = true;
  texture.minFilter = LinearFilter;
  texture.magFilter = LinearFilter;
  texture.wrapS = ClampToEdgeWrapping;
  texture.wrapT = ClampToEdgeWrapping;
  texture.colorSpace = SRGBColorSpace;
  return texture;
}

export async function loadCurrentStMap() {
  const manifest = await fetchJson<StMapManifest>(STMAP_MANIFEST_URL);
  const pixelBytes = await fetchBinary(`${STMAP_BASE_URL}${manifest.files.pixels}`);
  const maskBytes = await fetchBinary(`${STMAP_BASE_URL}${manifest.files.mask}`);

  const pixelsTexture = makeHalfFloatTexture(
    new Uint16Array(pixelBytes.buffer, pixelBytes.byteOffset, pixelBytes.byteLength / 2),
    manifest.crop.width,
    manifest.crop.height,
  );
  const maskTexture = makeMaskTexture(maskBytes, manifest.crop.width, manifest.crop.height);

  return {
    manifest,
    pixelsTexture,
    maskTexture,
  } satisfies StMapBundle;
}

export function disposeStMapBundle(bundle: StMapBundle | null | undefined) {
  bundle?.pixelsTexture.dispose();
  bundle?.maskTexture.dispose();
}

function makeHalfFloatTexture(data: Uint16Array, width: number, height: number) {
  const texture = new DataTexture(data, width, height, RGFormat, HalfFloatType);
  texture.needsUpdate = true;
  texture.minFilter = LinearFilter;
  texture.magFilter = LinearFilter;
  texture.wrapS = ClampToEdgeWrapping;
  texture.wrapT = ClampToEdgeWrapping;
  texture.flipY = true;
  texture.colorSpace = NoColorSpace;
  return texture;
}

function makeMaskTexture(data: Uint8Array, width: number, height: number) {
  const texture = new DataTexture(data, width, height, RedFormat, UnsignedByteType);
  texture.needsUpdate = true;
  texture.minFilter = LinearFilter;
  texture.magFilter = LinearFilter;
  texture.wrapS = ClampToEdgeWrapping;
  texture.wrapT = ClampToEdgeWrapping;
  texture.flipY = true;
  texture.colorSpace = NoColorSpace;
  return texture;
}

async function fetchJson<T>(url: string) {
  const response = await fetch(url, { cache: "no-store" });
  if (!response.ok) {
    throw new Error(`Failed to load ${url}: ${response.status}`);
  }
  return (await response.json()) as T;
}

async function fetchBinary(url: string) {
  const response = await fetch(url, { cache: "no-store" });
  if (!response.ok) {
    throw new Error(`Failed to load ${url}: ${response.status}`);
  }
  return new Uint8Array(await response.arrayBuffer());
}
