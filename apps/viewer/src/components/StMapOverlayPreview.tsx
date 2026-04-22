import { useEffect, useRef } from "react";
import {
  DoubleSide,
  Mesh,
  OrthographicCamera,
  PlaneGeometry,
  Scene,
  SRGBColorSpace,
  Texture,
  TextureLoader,
  VideoTexture,
  WebGLRenderer,
} from "three";
import {
  createStretchedImageTexture,
  createStMapOverlayMaterial,
  disposeStMapBundle,
  loadCurrentStMap,
  type StMapBundle,
} from "../lib/stmap";

type Props = {
  sourceKind: "none" | "image" | "video";
  sourceUrl: string;
  videoElement: HTMLVideoElement | null;
  onStatus?: (message: string) => void;
};

const textureLoader = new TextureLoader();

export function StMapOverlayPreview({ sourceKind, sourceUrl, videoElement, onStatus }: Props) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const rendererRef = useRef<WebGLRenderer | null>(null);
  const sceneRef = useRef<Scene | null>(null);
  const cameraRef = useRef<OrthographicCamera | null>(null);
  const textureRef = useRef<Texture | null>(null);
  const overlayMaterialRef = useRef<ReturnType<typeof createStMapOverlayMaterial> | null>(null);
  const overlayMeshRef = useRef<Mesh | null>(null);
  const stMapBundleRef = useRef<StMapBundle | null>(null);
  const currentRevisionRef = useRef("");
  const visibleRef = useRef(false);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) {
      return;
    }

    const renderer = new WebGLRenderer({ canvas, antialias: true, alpha: true });
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    renderer.outputColorSpace = SRGBColorSpace;
    renderer.setClearColor(0x000000, 0);
    rendererRef.current = renderer;

    const scene = new Scene();
    sceneRef.current = scene;

    const camera = new OrthographicCamera(-1, 1, 1, -1, 0.1, 10);
    camera.position.z = 1;
    cameraRef.current = camera;

    const overlayMaterial = createStMapOverlayMaterial({ side: DoubleSide });
    overlayMaterialRef.current = overlayMaterial;
    const mesh = new Mesh(new PlaneGeometry(2, 2), overlayMaterial);
    mesh.visible = false;
    scene.add(mesh);
    overlayMeshRef.current = mesh;

    const resize = () => {
      const width = canvas.clientWidth;
      const height = canvas.clientHeight;
      if (width > 0 && height > 0) {
        renderer.setSize(width, height, false);
      }
    };

    const resizeObserver = new ResizeObserver(resize);
    resizeObserver.observe(canvas);
    resize();

    renderer.setAnimationLoop(() => {
      if (!sceneRef.current || !cameraRef.current) {
        return;
      }
      renderer.render(sceneRef.current, cameraRef.current);
    });

    return () => {
      resizeObserver.disconnect();
      renderer.setAnimationLoop(null);
      renderer.dispose();
      overlayMaterial.dispose();
      mesh.geometry.dispose();
      textureRef.current?.dispose();
      disposeStMapBundle(stMapBundleRef.current);
      stMapBundleRef.current = null;
      currentRevisionRef.current = "";
    };
  }, []);

  useEffect(() => {
    const overlayMaterial = overlayMaterialRef.current;
    const overlayMesh = overlayMeshRef.current;
    if (!overlayMaterial || !overlayMesh) {
      return;
    }

    textureRef.current?.dispose();
    textureRef.current = null;
    overlayMaterial.uniforms.sourceTexture.value = null;
    visibleRef.current = sourceKind !== "none" && Boolean(sourceUrl);

    if (sourceKind === "image" && sourceUrl) {
      const texture = textureLoader.load(sourceUrl, () => {
        const image = texture.image as { naturalWidth?: number; naturalHeight?: number; width?: number; height?: number };
        const containedTexture = createStretchedImageTexture(
          texture.image,
          image.naturalWidth ?? image.width ?? 1,
          image.naturalHeight ?? image.height ?? 1,
        );
        texture.dispose();
        textureRef.current?.dispose();
        textureRef.current = containedTexture;
        overlayMaterial.uniforms.sourceTexture.value = containedTexture;
        overlayMesh.visible = Boolean(stMapBundleRef.current);
        onStatus?.("2D Overlay Media ready.");
      });
      texture.colorSpace = SRGBColorSpace;
      return;
    }

    if (sourceKind === "video" && videoElement) {
      const texture = new VideoTexture(videoElement);
      texture.colorSpace = SRGBColorSpace;
      textureRef.current = texture;
      overlayMaterial.uniforms.sourceTexture.value = texture;
      overlayMesh.visible = Boolean(stMapBundleRef.current);
      onStatus?.("2D Overlay Media ready.");
      return;
    }

    overlayMesh.visible = false;
  }, [sourceKind, sourceUrl, videoElement, onStatus]);

  useEffect(() => {
    let cancelled = false;
    let timer: number | null = null;

    const refresh = async () => {
      try {
        const next = await loadCurrentStMap();
        if (cancelled) {
          disposeStMapBundle(next);
          return;
        }
        if (next.manifest.revision === currentRevisionRef.current) {
          disposeStMapBundle(next);
          return;
        }

        currentRevisionRef.current = next.manifest.revision;
        const previous = stMapBundleRef.current;
        stMapBundleRef.current = next;
        disposeStMapBundle(previous);

        const overlayMaterial = overlayMaterialRef.current;
        const overlayMesh = overlayMeshRef.current;
        if (overlayMaterial) {
          overlayMaterial.uniforms.pixelsTexture.value = next.pixelsTexture;
          overlayMaterial.uniforms.maskTexture.value = next.maskTexture;
          overlayMaterial.uniforms.cropRectUv.value.set(
            next.manifest.cropUv.x,
            1 - next.manifest.cropUv.y - next.manifest.cropUv.height,
          );
          overlayMaterial.uniforms.cropSizeUv.value.set(next.manifest.cropUv.width, next.manifest.cropUv.height);
        }
        if (overlayMesh) {
          overlayMesh.visible = visibleRef.current;
        }
      } catch (error) {
        if (!cancelled) {
          console.error(error);
        }
      }
    };

    void refresh();
    timer = window.setInterval(() => {
      void refresh();
    }, 5000);

    return () => {
      cancelled = true;
      if (timer !== null) {
        window.clearInterval(timer);
      }
    };
  }, []);

  return <canvas ref={canvasRef} className="overlay-canvas" aria-hidden="true" />;
}
