import type { DragEvent, PointerEvent, WheelEvent } from "react";
import { estimateLayerPreviewSize, screenPointToLatitudeLongitude } from "../lib/geometry";
import type { StoryboardLayer } from "../lib/types";

type Props = {
  guideImageUrl: string;
  backgroundImageUrl: string;
  layers: StoryboardLayer[];
  activeLayerId: string;
  onSelectLayer: (id: string) => void;
  onUpdateLayer: (id: string, patch: Partial<StoryboardLayer>) => void;
  onDropImageFile?: (file: File) => void;
  interactive?: boolean;
};

export function EquirectangularEditor({
  guideImageUrl,
  backgroundImageUrl,
  layers,
  activeLayerId,
  onSelectLayer,
  onUpdateLayer,
  onDropImageFile,
  interactive = true,
}: Props) {
  const handleLayerPointerDown = (
    event: PointerEvent<HTMLButtonElement>,
    layerId: string,
  ) => {
    if (!interactive) {
      return;
    }

    event.preventDefault();
    event.stopPropagation();
    event.currentTarget.setPointerCapture(event.pointerId);
    onSelectLayer(layerId);
  };

  const handleLayerPointerMove = (
    event: PointerEvent<HTMLButtonElement>,
    layerId: string,
  ) => {
    if (!interactive || !event.buttons) {
      return;
    }

    const target = event.currentTarget.closest(".viewport-stage");
    if (!(target instanceof HTMLDivElement)) {
      return;
    }

    const rect = target.getBoundingClientRect();
    const { latitude, longitude } = screenPointToLatitudeLongitude(
      event.clientX - rect.left,
      event.clientY - rect.top,
      rect.width,
      rect.height,
    );
    onUpdateLayer(layerId, { latitude, longitude });
  };

  const handleLayerWheel = (event: WheelEvent<HTMLButtonElement>, layerId: string) => {
    if (!interactive || layerId !== activeLayerId) {
      return;
    }

    event.preventDefault();
    event.stopPropagation();
    const step = event.deltaY > 0 ? 0.1 : -0.1;
    const layer = layers.find((entry) => entry.id === layerId);
    if (!layer) {
      return;
    }

    onUpdateLayer(layerId, {
      distance: Math.max(0.1, Math.round((layer.distance + step) * 10) / 10),
    });
  };

  const handleDrop = (event: DragEvent<HTMLDivElement>) => {
    if (!interactive || !onDropImageFile) {
      return;
    }

    event.preventDefault();
    event.stopPropagation();

    const files = Array.from(event.dataTransfer.files);
    if (files.length !== 1) {
      return;
    }

    const [file] = files;
    if (!file || !file.type.startsWith("image/")) {
      return;
    }

    onDropImageFile(file);
  };

  return (
    <div
      className="viewport-stage"
      onDragOver={interactive ? (event) => event.preventDefault() : undefined}
      onDrop={handleDrop}
    >
      {backgroundImageUrl ? (
        <img className="stage-image background-image" src={backgroundImageUrl} alt="" />
      ) : null}
      {guideImageUrl ? (
        <img className="stage-image guide-image" src={guideImageUrl} alt="" />
      ) : null}

      {layers.map((layer) => {
        const size = estimateLayerPreviewSize(layer);
        const aspect = Math.max(0.1, layer.imageAspect ?? 1);
        const left = `${((layer.longitude + 180) / 360) * 100}%`;
        const top = `${((90 - layer.latitude) / 180) * 100}%`;
        return (
          <button
            key={layer.id}
            type="button"
            className={`layer-pin ${layer.id === activeLayerId ? "active" : ""}`}
            style={{
              left,
              top,
              width: `${size * aspect}px`,
              height: `${size}px`,
              opacity: layer.visible ? 1 : 0.25,
              transform: `translate(-50%, -50%) rotate(${layer.rotation}deg)`,
            }}
            draggable={false}
            onPointerDown={(event) => handleLayerPointerDown(event, layer.id)}
            onPointerMove={(event) => handleLayerPointerMove(event, layer.id)}
            onPointerUp={interactive ? (event) => event.currentTarget.releasePointerCapture(event.pointerId) : undefined}
            onDragStart={(event) => event.preventDefault()}
            onWheel={(event) => handleLayerWheel(event, layer.id)}
            title={layer.name}
          >
            {layer.imageUrl ? (
              <img src={layer.imageUrl} alt={layer.name} draggable={false} />
            ) : (
              <span>{layer.name}</span>
            )}
          </button>
        );
      })}
    </div>
  );
}
