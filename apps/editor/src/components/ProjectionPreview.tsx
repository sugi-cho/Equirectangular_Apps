import { useEffect, useRef } from "react";
import { renderProjection, renderProjectionToBlob } from "../lib/projection-renderer";
import type { StoryboardScene } from "../lib/types";

type Props = {
  scene: StoryboardScene;
};

type SavePickerOptions = {
  suggestedName?: string;
  types?: Array<{
    description?: string;
    accept: Record<string, string[]>;
  }>;
};

type FileHandleLike = {
  createWritable: () => Promise<{
    write: (data: Blob | BufferSource | string) => Promise<void>;
    close: () => Promise<void>;
  }>;
};

export function ProjectionPreview({ scene }: Props) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const renderTokenRef = useRef(0);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) {
      return;
    }

    const token = ++renderTokenRef.current;
    let cancelled = false;

    const scheduleRender = () => {
      void renderProjection(canvas, scene).catch(() => {
        // Ignore transient decode/render errors in the preview pane.
      });
    };

    const resizeObserver = new ResizeObserver(() => {
      if (!cancelled && token === renderTokenRef.current) {
        scheduleRender();
      }
    });
    resizeObserver.observe(canvas);
    scheduleRender();

    return () => {
      cancelled = true;
      renderTokenRef.current += 1;
      resizeObserver.disconnect();
    };
  }, [scene]);

  const handleSavePng = async () => {
    const blob = await renderProjectionToBlob(scene, 3840);
    const picker = (window as Window & {
      showSaveFilePicker?: (options: SavePickerOptions) => Promise<FileHandleLike>;
    }).showSaveFilePicker;

    if (picker) {
      const handle = await picker({
        suggestedName: "rendered-result-4k.png",
        types: [
          {
            description: "PNG image",
            accept: {
              "image/png": [".png"],
            },
          },
        ],
      });
      const writable = await handle.createWritable();
      await writable.write(new Uint8Array(await blob.arrayBuffer()));
      await writable.close();
      return;
    }

    const url = URL.createObjectURL(blob);
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = "rendered-result-4k.png";
    anchor.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="viewport-stage projection-stage">
      <div className="projection-save">
        <button type="button" onClick={handleSavePng}>
          PNG 保存
        </button>
      </div>
      <canvas ref={canvasRef} className="projection-canvas" />
    </div>
  );
}
