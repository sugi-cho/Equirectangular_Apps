import { forwardRef, useEffect, useImperativeHandle, useRef, type PointerEvent } from "react";
import {
  BackSide,
  Mesh,
  MeshBasicMaterial,
  NoToneMapping,
  PerspectiveCamera,
  Scene,
  SphereGeometry,
  Texture,
  TextureLoader,
  SRGBColorSpace,
  VideoTexture,
  WebGLRenderer,
} from "three";
import { panoramaFrontRotationY } from "../../../shared/src/projection-math";
import {
  createStretchedImageTexture,
  createStMapOverlayMaterial,
  disposeStMapBundle,
  loadCurrentStMap,
  type StMapBundle,
} from "../lib/stmap";

export type ThreeViewerHandle = {
  enterVr: () => Promise<boolean>;
};

type Props = {
  sourceKind: "none" | "image" | "video";
  sourceUrl: string;
  videoElement: HTMLVideoElement | null;
  stmapSourceKind: "none" | "image" | "video";
  stmapSourceUrl: string;
  stmapVideoElement: HTMLVideoElement | null;
  sphereRadius: number;
  onStatus: (message: string) => void;
};

const textureLoader = new TextureLoader();

export const ThreeViewer = forwardRef<ThreeViewerHandle, Props>(function ThreeViewer(
  {
    sourceKind,
    sourceUrl,
    videoElement,
    stmapSourceKind,
    stmapSourceUrl,
    stmapVideoElement,
    sphereRadius,
    onStatus,
  },
  ref,
) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const rendererRef = useRef<WebGLRenderer | null>(null);
  const sceneRef = useRef<Scene | null>(null);
  const cameraRef = useRef<PerspectiveCamera | null>(null);
  const sphereRef = useRef<Mesh | null>(null);
  const overlaySphereRef = useRef<Mesh | null>(null);
  const textureRef = useRef<Texture | null>(null);
  const overlayTextureRef = useRef<Texture | null>(null);
  const overlayMaterialRef = useRef<ReturnType<typeof createStMapOverlayMaterial> | null>(null);
  const stMapBundleRef = useRef<StMapBundle | null>(null);
  const dragRef = useRef({ active: false, pointerId: -1, yaw: 0, pitch: 0 });

  useImperativeHandle(ref, () => ({
    async enterVr() {
      const renderer = rendererRef.current;
      const xr = (navigator as Navigator & { xr?: WebXRSystemLike }).xr;
      if (!renderer || !xr) {
        onStatus("WebXR is not available in this browser.");
        return false;
      }

      try {
        const supported = await xr.isSessionSupported?.("immersive-vr");
        if (supported === false) {
          onStatus("immersive-vr is not supported.");
          return false;
        }
        const session = await xr.requestSession("immersive-vr", {
          optionalFeatures: ["local-floor", "bounded-floor"],
        });
        renderer.xr.enabled = true;
        await renderer.xr.setSession(session as never);
        onStatus("VR session started.");
        return true;
      } catch (error) {
        console.error(error);
        onStatus(`VR session failed: ${error instanceof Error ? error.message : String(error)}`);
        return false;
      }
    },
  }));

  useEffect(() => {
    const container = containerRef.current;
    if (!container) {
      return;
    }

    const renderer = new WebGLRenderer({ antialias: true, alpha: true });
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    renderer.setSize(container.clientWidth, container.clientHeight);
    renderer.outputColorSpace = SRGBColorSpace;
    renderer.toneMapping = NoToneMapping;
    renderer.xr.enabled = true;
    renderer.domElement.style.width = "100%";
    renderer.domElement.style.height = "100%";
    container.appendChild(renderer.domElement);
    rendererRef.current = renderer;

    const scene = new Scene();
    sceneRef.current = scene;

    const camera = new PerspectiveCamera(70, container.clientWidth / container.clientHeight, 0.1, 5000);
    camera.position.set(0, 0, 0.1);
    cameraRef.current = camera;

    const sphere = new Mesh(
      new SphereGeometry(500, 64, 64),
      new MeshBasicMaterial({ color: 0x1b2238, side: BackSide }),
    );
    scene.add(sphere);
    sphereRef.current = sphere;

    const overlayMaterial = createStMapOverlayMaterial();
    overlayMaterialRef.current = overlayMaterial;
    const overlaySphere = new Mesh(
      new SphereGeometry(500, 64, 64),
      overlayMaterial,
    );
    overlaySphere.renderOrder = 1;
    overlaySphere.visible = false;
    scene.add(overlaySphere);
    overlaySphereRef.current = overlaySphere;

    const resizeObserver = new ResizeObserver(() => {
      const width = container.clientWidth;
      const height = container.clientHeight;
      renderer.setSize(width, height);
      camera.aspect = width / height;
      camera.updateProjectionMatrix();
    });
    resizeObserver.observe(container);

    renderer.setAnimationLoop(() => {
      const currentScene = sceneRef.current;
      const currentCamera = cameraRef.current;
      const currentSphere = sphereRef.current;
      if (!currentScene || !currentCamera || !currentSphere) {
        return;
      }

      currentCamera.rotation.order = "YXZ";
      currentCamera.rotation.y = -dragRef.current.yaw;
      currentCamera.rotation.x = dragRef.current.pitch;
      currentCamera.rotation.z = 0;
      const scale = Math.max(0.01, sphereRadius / 500);
      currentSphere.scale.set(-scale, scale, scale);
      currentSphere.rotation.y = panoramaFrontRotationY;
      if (overlaySphereRef.current) {
        overlaySphereRef.current.scale.set(-scale, scale, scale);
        overlaySphereRef.current.rotation.y = panoramaFrontRotationY;
      }

      renderer.render(currentScene, currentCamera);
    });

    return () => {
      resizeObserver.disconnect();
      renderer.setAnimationLoop(null);
      renderer.dispose();
      container.removeChild(renderer.domElement);
      overlayMaterial.dispose();
      overlaySphere.geometry.dispose();
      sphere.geometry.dispose();
      (sphere.material as MeshBasicMaterial).dispose();
      overlayTextureRef.current?.dispose();
    };
  }, []);

  useEffect(() => {
    const sphere = sphereRef.current;
    if (!sphere) {
      return;
    }
    const material = sphere.material as MeshBasicMaterial;
    material.map?.dispose();
    material.map = null;
    textureRef.current?.dispose();
    textureRef.current = null;

    if (sourceKind === "image" && sourceUrl) {
      const texture = textureLoader.load(sourceUrl);
      texture.colorSpace = SRGBColorSpace;
      textureRef.current = texture;
      material.color.set(0xffffff);
      material.map = texture;
      material.needsUpdate = true;
      onStatus("Image ready.");
      return;
    }

    if (sourceKind === "video" && videoElement) {
      const texture = new VideoTexture(videoElement);
      texture.colorSpace = SRGBColorSpace;
      textureRef.current = texture;
      material.color.set(0xffffff);
      material.map = texture;
      material.needsUpdate = true;
      onStatus("Video ready.");
      return;
    }

    onStatus("Open an image or video to preview.");
  }, [sourceKind, sourceUrl, videoElement, onStatus]);

  useEffect(() => {
    const overlayMaterial = overlayMaterialRef.current;
    const overlaySphere = overlaySphereRef.current;
    if (!overlayMaterial || !overlaySphere) {
      return;
    }

    overlayTextureRef.current?.dispose();
    overlayTextureRef.current = null;
    overlayMaterial.uniforms.sourceTexture.value = null;

    if (stmapSourceKind === "image" && stmapSourceUrl) {
      const texture = textureLoader.load(stmapSourceUrl, () => {
        const image = texture.image as { naturalWidth?: number; naturalHeight?: number; width?: number; height?: number };
        const containedTexture = createStretchedImageTexture(
          texture.image,
          image.naturalWidth ?? image.width ?? 1,
          image.naturalHeight ?? image.height ?? 1,
        );
        texture.dispose();
        overlayTextureRef.current?.dispose();
        overlayTextureRef.current = containedTexture;
        overlayMaterial.uniforms.sourceTexture.value = containedTexture;
        overlaySphere.visible = Boolean(stMapBundleRef.current);
        onStatus("変換用メディア ready.");
      });
      texture.colorSpace = SRGBColorSpace;
      return;
    }

    if (stmapSourceKind === "video" && stmapVideoElement) {
      const texture = new VideoTexture(stmapVideoElement);
      texture.colorSpace = SRGBColorSpace;
      overlayTextureRef.current = texture;
      overlayMaterial.uniforms.sourceTexture.value = texture;
      overlaySphere.visible = Boolean(stMapBundleRef.current);
      onStatus("変換用メディア ready.");
      return;
    }

    overlaySphere.visible = false;
  }, [stmapSourceKind, stmapSourceUrl, stmapVideoElement, onStatus]);

  useEffect(() => {
    let cancelled = false;
    let pollTimer: number | null = null;
    let currentRevision = "";

    const refreshStMap = async () => {
      try {
        const next = await loadCurrentStMap();
        if (cancelled) {
          disposeStMapBundle(next);
          return;
        }
        if (next.manifest.revision === currentRevision) {
          disposeStMapBundle(next);
          return;
        }
        currentRevision = next.manifest.revision;

        const previous = stMapBundleRef.current;
        stMapBundleRef.current = next;
        disposeStMapBundle(previous);

        const overlayMaterial = overlayMaterialRef.current;
        if (overlayMaterial) {
          overlayMaterial.uniforms.pixelsTexture.value = next.pixelsTexture;
          overlayMaterial.uniforms.maskTexture.value = next.maskTexture;
          overlayMaterial.uniforms.cropRectUv.value.set(
            next.manifest.cropUv.x,
            1 - next.manifest.cropUv.y - next.manifest.cropUv.height,
          );
          overlayMaterial.uniforms.cropSizeUv.value.set(next.manifest.cropUv.width, next.manifest.cropUv.height);
        }
        if (overlaySphereRef.current) {
          overlaySphereRef.current.visible = Boolean(overlayTextureRef.current);
        }
      } catch (error) {
        if (!cancelled) {
          console.error(error);
        }
      }
    };

    void refreshStMap();
    pollTimer = window.setInterval(() => {
      void refreshStMap();
    }, 5000);

    return () => {
      cancelled = true;
      if (pollTimer !== null) {
        window.clearInterval(pollTimer);
      }
      disposeStMapBundle(stMapBundleRef.current);
      stMapBundleRef.current = null;
    };
  }, []);

  const handlePointerDown = (event: PointerEvent<HTMLDivElement>) => {
    event.currentTarget.setPointerCapture(event.pointerId);
    dragRef.current.active = true;
    dragRef.current.pointerId = event.pointerId;
  };

  const handlePointerMove = (event: PointerEvent<HTMLDivElement>) => {
    if (!dragRef.current.active || dragRef.current.pointerId !== event.pointerId) {
      return;
    }

    dragRef.current.yaw -= event.movementX * 0.005;
    dragRef.current.pitch = clamp(dragRef.current.pitch + event.movementY * 0.005, -1.45, 1.45);
  };

  const endDrag = (event: PointerEvent<HTMLDivElement>) => {
    if (dragRef.current.pointerId !== event.pointerId) {
      return;
    }
    dragRef.current.active = false;
    dragRef.current.pointerId = -1;
  };

  return (
    <div
      className="three-preview"
      ref={containerRef}
      onPointerDown={handlePointerDown}
      onPointerMove={handlePointerMove}
      onPointerUp={endDrag}
      onPointerCancel={endDrag}
      onPointerLeave={endDrag}
    />
  );
});

function clamp(value: number, min: number, max: number) {
  return Math.min(max, Math.max(min, value));
}

type WebXRSystemLike = {
  isSessionSupported?: (mode: "immersive-vr") => Promise<boolean>;
  requestSession: (
    mode: "immersive-vr",
    options?: { optionalFeatures?: string[] },
  ) => Promise<unknown>;
};
