import { forwardRef, useEffect, useImperativeHandle, useRef, type PointerEvent } from "react";
import {
  BackSide,
  DoubleSide,
  Mesh,
  MeshBasicMaterial,
  NoToneMapping,
  PerspectiveCamera,
  PlaneGeometry,
  Scene,
  SphereGeometry,
  Texture,
  TextureLoader,
  SRGBColorSpace,
  WebGLRenderer,
} from "three";
import {
  computeLayerRenderSize,
  computeLayerWorldPosition,
  panoramaFrontRotationY,
} from "../lib/projection-math";
import { getRenderableLayers } from "../lib/projection-renderer";
import type { StoryboardLayer, StoryboardScene } from "../lib/types";

export type ThreePreviewHandle = {
  enterVr: () => Promise<boolean>;
};

type Props = {
  sceneData: StoryboardScene;
  activeLayerId: string;
  guideVisible: boolean;
};

type LayerRenderItem = {
  mesh: Mesh;
  material: MeshBasicMaterial;
  imageUrl: string;
  texture?: Texture;
};

const textureLoader = new TextureLoader();

export const ThreePreview = forwardRef<ThreePreviewHandle, Props>(function ThreePreview(
  { sceneData, activeLayerId, guideVisible },
  ref,
) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const rendererRef = useRef<WebGLRenderer | null>(null);
  const sceneRef = useRef<Scene | null>(null);
  const cameraRef = useRef<PerspectiveCamera | null>(null);
  const backgroundRef = useRef<Mesh | null>(null);
  const guideRef = useRef<Mesh | null>(null);
  const layerObjectsRef = useRef<Map<string, LayerRenderItem>>(new Map());
  const sceneDataRef = useRef(sceneData);
  const activeLayerIdRef = useRef(activeLayerId);
  const guideVisibleRef = useRef(guideVisible);
  const dragStateRef = useRef({
    dragging: false,
    pointerId: -1,
    yaw: 0,
    pitch: 0,
  });

  useImperativeHandle(ref, () => ({
    async enterVr() {
      const renderer = rendererRef.current;
      const xr = (navigator as Navigator & { xr?: WebXRSystemLike }).xr;
      const secure = window.isSecureContext;
      if (!renderer || !xr) {
        window.alert(
          `WebXR が利用できません。\nsecureContext=${secure}\nnavigator.xr=${Boolean(xr)}`,
        );
        return false;
      }

      try {
        const supported = await xr.isSessionSupported?.("immersive-vr");
        if (supported === false) {
          window.alert(`immersive-vr が未対応です。\nsecureContext=${secure}`);
          return false;
        }
        const session = await xr.requestSession("immersive-vr", {
          optionalFeatures: ["local-floor", "bounded-floor"],
        });
        renderer.xr.enabled = true;
        await renderer.xr.setSession(session as never);
        return true;
      } catch (error) {
        console.error(error);
        const message = error instanceof Error ? `${error.name}: ${error.message}` : String(error);
        window.alert(`VR セッションを開始できませんでした。\n${message}`);
        return false;
      }
    },
  }));

  useEffect(() => {
    sceneDataRef.current = sceneData;
  }, [sceneData]);

  useEffect(() => {
    activeLayerIdRef.current = activeLayerId;
  }, [activeLayerId]);

  useEffect(() => {
    guideVisibleRef.current = guideVisible;
    const guide = guideRef.current;
    if (guide) {
      guide.visible = guideVisible;
    }
  }, [guideVisible]);

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
    camera.position.set(0, 0, 6);
    cameraRef.current = camera;

    const createDome = () => {
      const geometry = new SphereGeometry(1, 64, 64);
      const material = new MeshBasicMaterial({ color: 0x1b2238, side: BackSide });
      const mesh = new Mesh(geometry, material);
      scene.add(mesh);
      return mesh;
    };

    backgroundRef.current = createDome();

    const guideGeometry = new SphereGeometry(0.995, 64, 64);
    const guideMaterial = new MeshBasicMaterial({
      color: 0xffffff,
      side: BackSide,
      transparent: true,
      opacity: 0.28,
    });
    const guideMesh = new Mesh(guideGeometry, guideMaterial);
    guideMesh.visible = guideVisibleRef.current;
    scene.add(guideMesh);
    guideRef.current = guideMesh;

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
      const currentData = sceneDataRef.current;
      if (!currentScene || !currentCamera) {
        return;
      }

      const visibleRadius = Math.max(0.1, currentData.dome.radius);
      const domeScale = currentData.dome.scale;
      const domeTranslate = currentData.dome.translate;

      const backgroundMesh = backgroundRef.current;
      if (backgroundMesh) {
        backgroundMesh.scale.set(
          -domeScale[0] * visibleRadius,
          domeScale[1] * visibleRadius,
          domeScale[2] * visibleRadius,
        );
        backgroundMesh.position.set(...domeTranslate);
        backgroundMesh.rotation.y = panoramaFrontRotationY;
        backgroundMesh.renderOrder = 0;
      }

      const guideMeshCurrent = guideRef.current;
      if (guideMeshCurrent) {
        guideMeshCurrent.scale.set(
          -domeScale[0] * visibleRadius,
          domeScale[1] * visibleRadius,
          domeScale[2] * visibleRadius,
        );
        guideMeshCurrent.position.set(...domeTranslate);
        guideMeshCurrent.rotation.y = panoramaFrontRotationY;
        guideMeshCurrent.renderOrder = 0;
      }

      currentCamera.position.set(
        currentData.camera.position[0],
        currentData.camera.position[1],
        currentData.camera.position[2],
      );
      currentCamera.rotation.order = "YXZ";
      currentCamera.rotation.y = -dragStateRef.current.yaw;
      currentCamera.rotation.x = dragStateRef.current.pitch;
      currentCamera.rotation.z = 0;

      syncLayers(currentScene, currentData.layers, layerObjectsRef.current);

      layerObjectsRef.current.forEach((item) => {
        item.mesh.visible = false;
      });

      const sortedLayers = getRenderableLayers(currentData.layers);

      sortedLayers.forEach((layer, order) => {
        const item = layerObjectsRef.current.get(layer.id);
        if (!item) {
          return;
        }

        const radius = Math.max(0.1, visibleRadius - layer.distance);
        const [x, y, z] = computeLayerWorldPosition(layer.latitude, layer.longitude, radius);
        item.mesh.position.set(x + domeTranslate[0], y + domeTranslate[1], z + domeTranslate[2]);
        item.mesh.lookAt(currentCamera.position);
        item.mesh.rotateZ(-(layer.rotation * Math.PI) / 180);
        const size = computeLayerRenderSize(layer);
        const aspect = Math.max(0.1, layer.imageAspect ?? 1);
        item.mesh.scale.set(size * aspect, size, 1);
        item.mesh.visible = layer.visible;
        item.mesh.renderOrder = order + 1;
        item.material.color.set(layer.id === activeLayerIdRef.current ? 0xd9e4ff : 0xffffff);
      });

      renderer.render(currentScene, currentCamera);
    });

    return () => {
      resizeObserver.disconnect();
      renderer.setAnimationLoop(null);
      renderer.dispose();
      domRemove(container, renderer.domElement);
      scene.traverse((object: any) => {
        if (object instanceof Mesh) {
          object.geometry.dispose();
          if (Array.isArray(object.material)) {
            object.material.forEach((material: MeshBasicMaterial) => material.dispose());
          } else {
            object.material.dispose();
          }
        }
      });
      layerObjectsRef.current.clear();
    };
  }, []);

  const handlePointerDown = (event: PointerEvent<HTMLDivElement>) => {
    event.currentTarget.setPointerCapture(event.pointerId);
    dragStateRef.current.dragging = true;
    dragStateRef.current.pointerId = event.pointerId;
  };

  const handlePointerMove = (event: PointerEvent<HTMLDivElement>) => {
    if (!dragStateRef.current.dragging || dragStateRef.current.pointerId !== event.pointerId) {
      return;
    }

    dragStateRef.current.yaw -= event.movementX * 0.005;
    dragStateRef.current.pitch = clamp(
      dragStateRef.current.pitch + event.movementY * 0.005,
      -Math.PI / 2 + 0.05,
      Math.PI / 2 - 0.05,
    );
  };

  const endDrag = (event: PointerEvent<HTMLDivElement>) => {
    if (dragStateRef.current.pointerId !== event.pointerId) {
      return;
    }
    dragStateRef.current.dragging = false;
    dragStateRef.current.pointerId = -1;
  };

  useEffect(() => {
    const background = backgroundRef.current;
    if (!background) {
      return;
    }

    const material = background.material as MeshBasicMaterial;
    applySphereTexture(material, sceneData.backgroundImageUrl, 0x1b2238);
  }, [sceneData.backgroundImageUrl]);

  useEffect(() => {
    const guide = guideRef.current;
    if (!guide) {
      return;
    }

    const material = guide.material as MeshBasicMaterial;
    applySphereTexture(material, sceneData.guideImageUrl, 0xffffff, 0.28);
  }, [sceneData.guideImageUrl]);

  useEffect(() => {
    const scene = sceneRef.current;
    if (!scene) {
      return;
    }

    syncLayers(scene, sceneData.layers, layerObjectsRef.current);
  }, [sceneData.layers]);

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

function syncLayers(
  scene: Scene,
  layers: StoryboardLayer[],
  items: Map<string, LayerRenderItem>,
) {
  const nextIds = new Set(layers.map((layer) => layer.id));

  for (const [id, item] of items.entries()) {
    if (!nextIds.has(id)) {
      scene.remove(item.mesh);
      item.mesh.geometry.dispose();
      item.material.map?.dispose();
      item.material.dispose();
      items.delete(id);
    }
  }

  layers.forEach((layer) => {
    const existing = items.get(layer.id);
    if (existing) {
      if (existing.imageUrl !== layer.imageUrl) {
        applyLayerTexture(existing.material, layer.imageUrl);
        existing.imageUrl = layer.imageUrl;
      }
      return;
    }

    const geometry = new PlaneGeometry(1, 1);
    const material = new MeshBasicMaterial({
      color: 0xffffff,
      side: DoubleSide,
      transparent: true,
      depthTest: false,
      depthWrite: false,
    });
    const mesh = new Mesh(geometry, material);
    scene.add(mesh);
    applyLayerTexture(material, layer.imageUrl);
    items.set(layer.id, { mesh, material, imageUrl: layer.imageUrl });
  });
}

function applyLayerTexture(material: MeshBasicMaterial, imageUrl: string) {
  material.side = DoubleSide;
  material.transparent = true;
  material.depthTest = false;
  material.depthWrite = false;
  material.color.set(0xffffff);

  if (!imageUrl) {
    material.map?.dispose();
    material.map = null;
    material.needsUpdate = true;
    return;
  }

  const texture = textureLoader.load(imageUrl);
  texture.colorSpace = SRGBColorSpace;
  material.map?.dispose();
  material.map = texture;
  material.needsUpdate = true;
}

function applySphereTexture(
  material: MeshBasicMaterial,
  imageUrl: string,
  fallbackColor: number,
  opacity?: number,
) {
  material.color.set(imageUrl ? 0xffffff : fallbackColor);
  material.side = BackSide;
  if (opacity !== undefined) {
    material.opacity = opacity;
    material.transparent = opacity < 1;
  }

  if (!imageUrl) {
    material.map?.dispose();
    material.map = null;
    material.needsUpdate = true;
    return;
  }

  const texture = textureLoader.load(imageUrl);
  texture.colorSpace = SRGBColorSpace;
  material.map?.dispose();
  material.map = texture;
  material.needsUpdate = true;
}

function clamp(value: number, min: number, max: number) {
  return Math.min(max, Math.max(min, value));
}

function domRemove(parent: HTMLElement, child: HTMLElement) {
  if (parent.contains(child)) {
    parent.removeChild(child);
  }
}

type WebXRSystemLike = {
  isSessionSupported?: (mode: "immersive-vr") => Promise<boolean>;
  requestSession: (
    mode: "immersive-vr",
    options?: { optionalFeatures?: string[] },
  ) => Promise<unknown>;
};
