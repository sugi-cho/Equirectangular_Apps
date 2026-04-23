import "./styles.css";
import type { ChangeEvent, PointerEvent, ReactNode } from "react";
import { useEffect, useMemo, useRef, useState } from "react";
import { EquirectangularEditor } from "./components/EquirectangularEditor";
import { ProjectionPreview } from "./components/ProjectionPreview";
import {
  ThreePreview,
  type ThreePreviewHandle,
} from "./components/ThreePreview";
import { loadSingleImageFile } from "./lib/image-file";
import { addLayer, deleteLayer, setVec3Value, updateLayer } from "./lib/scene";
import { defaultScene } from "./lib/defaultScene";
import { serializeProject } from "./lib/project-file";
import {
  listRecentProjects,
  loadProjectFromRecent,
  type ProjectFileHandle,
  type RecentProjectEntry,
  upsertRecentProject,
} from "./lib/project-recent";
import type { StoryboardScene } from "./lib/types";

export default function App() {
  const [scene, setScene] = useState<StoryboardScene>(defaultScene);
  const [activeLayerId, setActiveLayerId] = useState(scene.layers[0]?.id ?? "");
  const [projectName, setProjectName] = useState("Untitled");
  const [recentProjects, setRecentProjects] = useState<RecentProjectEntry[]>(
    [],
  );
  const [recentMenuOpen, setRecentMenuOpen] = useState(false);
  const [vrGuideVisible, setVrGuideVisible] = useState(true);
  const [scenePanelOpen, setScenePanelOpen] = useState(true);
  const [layersPanelOpen, setLayersPanelOpen] = useState(true);
  const [inspectorPanelOpen, setInspectorPanelOpen] = useState(true);
  const guideInputRef = useRef<HTMLInputElement | null>(null);
  const backgroundInputRef = useRef<HTMLInputElement | null>(null);
  const openProjectInputRef = useRef<HTMLInputElement | null>(null);
  const layerInputRefs = useRef<Record<string, HTMLInputElement | null>>({});
  const previewRef = useRef<ThreePreviewHandle | null>(null);
  const projectHandleRef = useRef<ProjectFileHandle | null>(null);

  const activeLayer = useMemo(
    () =>
      scene.layers.find((layer) => layer.id === activeLayerId) ??
      scene.layers[0],
    [activeLayerId, scene.layers],
  );

  useEffect(() => {
    let cancelled = false;

    void (async () => {
      try {
        const entries = await listRecentProjects();
        if (cancelled) {
          return;
        }
        setRecentProjects(entries);
        const latest = entries[0];
        if (!latest) {
          return;
        }

        const loadedScene = await loadProjectFromRecent(latest);
        if (cancelled) {
          return;
        }

        projectHandleRef.current = latest.handle ?? null;
        setProjectName(latest.name);
        setScene(loadedScene);
        setActiveLayerId(loadedScene.layers[0]?.id ?? "");
        await syncRecentProjects(
          latest.name,
          serializeProject(loadedScene),
          latest.handle ?? null,
        );
      } catch {
        // Ignore bootstrap errors and keep the default scene.
      }
    })();

    return () => {
      cancelled = true;
    };
  }, []);

  const syncRecentProjects = async (
    name: string,
    snapshot: string,
    handle?: ProjectFileHandle | null,
  ) => {
    await upsertRecentProject({
      name,
      snapshot,
      handle: handle ?? null,
    });
    setRecentProjects(await listRecentProjects());
  };

  const applyScene = async (
    nextScene: StoryboardScene,
    name: string,
    handle?: ProjectFileHandle | null,
  ) => {
    projectHandleRef.current = handle ?? null;
    setProjectName(name);
    setScene(nextScene);
    setActiveLayerId(nextScene.layers[0]?.id ?? "");
    await syncRecentProjects(name, serializeProject(nextScene), handle ?? null);
  };

  const handleGuideFileLoad = (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) {
      return;
    }

    void loadSingleImageFile(
      file,
      (image) => {
        setScene((current) => ({
          ...current,
          guideImageUrl: image.url,
        }));
      },
      "ガイド画像の読み込みに失敗しました。",
    ).finally(() => {
      event.target.value = "";
    });
  };

  const handleBackgroundFileLoad = (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) {
      return;
    }

    void loadSingleImageFile(
      file,
      (image) => {
        setScene((current) => ({
          ...current,
          backgroundImageUrl: image.url,
        }));
      },
      "背景画像の読み込みに失敗しました。",
    ).finally(() => {
      event.target.value = "";
    });
  };

  const handleLayerFileLoad =
    (layerId: string) => async (event: ChangeEvent<HTMLInputElement>) => {
      const file = event.target.files?.[0];
      if (!file) {
        return;
      }
      void loadSingleImageFile(
        file,
        (image) => {
          setScene((current) =>
            updateLayer(current, layerId, {
              imageUrl: image.url,
              imageName: file.name,
              imageAspect: image.aspect,
            }),
          );
        },
        "レイヤー画像の読み込みに失敗しました。",
      ).finally(() => {
        event.target.value = "";
      });
    };

  const handleAddLayer = () => {
    setScene((current) => {
      const next = addLayer(current);
      if (next === current) {
        return current;
      }
      const appended = next.layers[next.layers.length - 1];
      setActiveLayerId(appended.id);
      return next;
    });
  };

  const handleDeleteLayer = (layerId: string) => {
    setScene((current) => {
      const layerIndex = current.layers.findIndex(
        (layer) => layer.id === layerId,
      );
      if (layerIndex < 0) {
        return current;
      }

      const next = deleteLayer(current, layerId);
      if (next === current) {
        return current;
      }

      const nextActiveLayer =
        next.layers[layerIndex] ??
        next.layers[layerIndex - 1] ??
        next.layers[0];
      setActiveLayerId(nextActiveLayer?.id ?? "");
      return next;
    });
  };

  const handleDropImageFile = (file: File) => {
    void loadSingleImageFile(
      file,
      (image) => {
        setScene((current) => {
          const next = addLayer(current);
          if (next === current) {
            return current;
          }

          const appended = next.layers[next.layers.length - 1];
          setActiveLayerId(appended.id);
          return updateLayer(next, appended.id, {
            imageUrl: image.url,
            imageName: file.name,
            imageAspect: image.aspect,
            scale: getDefaultLayerScale(image.height),
          });
        });
      },
      "画像の読み込みに失敗しました。",
    );
  };

  const loadSceneFromFileText = async (
    text: string,
    name: string,
    handle?: ProjectFileHandle | null,
  ) => {
    try {
      const nextScene = await loadProjectFromRecent({
        id: name,
        name,
        snapshot: text,
        handle: handle ?? null,
        lastOpenedAt: Date.now(),
      });
      await applyScene(nextScene, name, handle ?? null);
    } catch (error) {
      console.error(error);
      window.alert("プロジェクトファイルの読み込みに失敗しました。");
    }
  };

  const handleOpenProject = async () => {
    const picker = (
      window as Window & {
        showOpenFilePicker?: (options: {
          multiple?: boolean;
          types?: Array<{
            description?: string;
            accept: Record<string, string[]>;
          }>;
          excludeAcceptAllOption?: boolean;
        }) => Promise<ProjectFileHandle[]>;
      }
    ).showOpenFilePicker;

    if (picker) {
      try {
        const handles = await picker({
          multiple: false,
          excludeAcceptAllOption: true,
          types: [
            {
              description: "Storyboard project",
              accept: {
                "application/json": [".json"],
              },
            },
          ],
        });
        const handle = handles[0];
        if (!handle) {
          return;
        }
        const file = await handle.getFile();
        await loadSceneFromFileText(await file.text(), handle.name, handle);
        return;
      } catch {
        return;
      }
    }

    openProjectInputRef.current?.click();
  };

  const handleOpenProjectFallback = (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) {
      return;
    }
    const input = event.target;

    void (async () => {
      await loadSceneFromFileText(await file.text(), file.name, null);
      input.value = "";
    })();
  };

  const handleSaveProject = async (saveAs = false) => {
    const currentHandle = projectHandleRef.current;
    if (!saveAs && currentHandle && currentHandle.createWritable) {
      try {
        const snapshot = serializeProject(scene);
        const writable = await currentHandle.createWritable();
        await writable.write(snapshot);
        await writable.close();
        await applyScene(scene, currentHandle.name, currentHandle);
        return;
      } catch {
        // Fall through to Save As.
      }
    }

    await handleSaveProjectAs();
  };

  const handleSaveProjectAs = async () => {
    const suggestedName = projectName.endsWith(".json")
      ? projectName
      : `${projectName}.json`;
    const snapshot = serializeProject(scene);
    const picker = (
      window as Window & {
        showSaveFilePicker?: (options: {
          suggestedName?: string;
          types?: Array<{
            description?: string;
            accept: Record<string, string[]>;
          }>;
        }) => Promise<ProjectFileHandle>;
      }
    ).showSaveFilePicker;

    if (picker) {
      try {
        const handle = await picker({
          suggestedName,
          types: [
            {
              description: "Storyboard project",
              accept: {
                "application/json": [".json"],
              },
            },
          ],
        });
        if (!handle.createWritable) {
          throw new Error("Save handle is not writable");
        }
        const writable = await handle.createWritable();
        await writable.write(snapshot);
        await writable.close();
        await applyScene(scene, handle.name, handle);
        return;
      } catch {
        // Fall back to a download if picker save fails.
      }
    }

    const blob = new Blob([snapshot], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = suggestedName;
    anchor.click();
    URL.revokeObjectURL(url);
    await applyScene(scene, suggestedName, null);
  };

  const handleRecentSelect = async (entry: RecentProjectEntry) => {
    try {
      const loadedScene = await loadProjectFromRecent(entry);
      projectHandleRef.current = entry.handle ?? null;
      setProjectName(entry.name);
      setScene(loadedScene);
      setActiveLayerId(loadedScene.layers[0]?.id ?? "");
      setRecentMenuOpen(false);
      await syncRecentProjects(
        entry.name,
        serializeProject(loadedScene),
        entry.handle ?? null,
      );
    } catch (error) {
      console.error(error);
      window.alert("最近のファイルの読み込みに失敗しました。");
    }
  };

  const updateSceneCamera = (axis: 0 | 1 | 2, value: number) => {
    setScene((current) => ({
      ...current,
      camera: {
        position: setVec3Value(current.camera.position, axis, value),
      },
    }));
  };

  const updateSceneDome = (
    key: "radius" | "scale" | "translate",
    axis: 0 | 1 | 2,
    value: number,
  ) => {
    setScene((current) => {
      if (key === "radius") {
        return { ...current, dome: { ...current.dome, radius: value } };
      }

      return {
        ...current,
        dome: {
          ...current.dome,
          [key]: setVec3Value(current.dome[key], axis, value),
        },
      };
    });
  };

  const handleResetGuide = () => {
    setScene((current) => ({
      ...current,
      guideImageUrl: "",
    }));
  };

  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key !== "Delete" || !activeLayerId) {
        return;
      }

      const target = event.target;
      if (
        target instanceof HTMLInputElement ||
        target instanceof HTMLTextAreaElement ||
        target instanceof HTMLSelectElement ||
        (target instanceof HTMLElement && target.isContentEditable)
      ) {
        return;
      }

      event.preventDefault();
      handleDeleteLayer(activeLayerId);
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [activeLayerId]);

  return (
    <div className="app-shell">
      <header className="topbar">
        <div>
          <p className="eyebrow">Equirectangular Editor</p>
          <p className="project-name">{projectName}</p>
        </div>
        <div className="topbar-actions">
          <input
            ref={openProjectInputRef}
            type="file"
            accept=".json,application/json"
            hidden
            onChange={handleOpenProjectFallback}
          />
          <input
            ref={guideInputRef}
            type="file"
            accept="image/*"
            hidden
            onChange={handleGuideFileLoad}
          />
          <input
            ref={backgroundInputRef}
            type="file"
            accept="image/*"
            hidden
            onChange={handleBackgroundFileLoad}
          />
          <button type="button" onClick={() => guideInputRef.current?.click()}>
            ガイド読み込み
          </button>
          <button type="button" onClick={handleResetGuide}>
            ガイドをデフォルトへ戻す
          </button>
          <button
            type="button"
            onClick={() => backgroundInputRef.current?.click()}
          >
            背景読み込み
          </button>
          <div className="project-controls">
            <button type="button" onClick={handleOpenProject}>
              Open
            </button>
            <button type="button" onClick={() => void handleSaveProject()}>
              Save
            </button>
            <button type="button" onClick={() => void handleSaveProject(true)}>
              Save As
            </button>
            <button
              type="button"
              onClick={() => setRecentMenuOpen((current) => !current)}
            >
              Recent
            </button>
            <button
              type="button"
              onClick={() =>
                window.location.assign(
                  new URL("../viewer/", window.location.href).toString(),
                )
              }
            >
              Viewer
            </button>
            {recentMenuOpen ? (
              <div className="recent-menu">
                {recentProjects.length === 0 ? (
                  <span className="recent-empty">
                    最近のファイルはありません。
                  </span>
                ) : (
                  recentProjects.map((entry) => (
                    <button
                      key={entry.id}
                      type="button"
                      className="recent-item"
                      onClick={() => void handleRecentSelect(entry)}
                    >
                      <strong>{entry.name}</strong>
                      <small>
                        {new Date(entry.lastOpenedAt).toLocaleString()}
                      </small>
                    </button>
                  ))
                )}
              </div>
            ) : null}
          </div>
        </div>
      </header>

      <main className="workspace">
        <div className="main-column">
          <section className="viewport-panel">
            <div className="panel-header">
              <div>
                <h2>EditView</h2>
                <p>2:1 Equirectangular 上でレイヤーを配置・編集する。</p>
              </div>
              <span className="pill">Interactive</span>
            </div>

            <EquirectangularEditor
              guideImageUrl={scene.guideImageUrl}
              backgroundImageUrl={scene.backgroundImageUrl}
              layers={scene.layers}
              activeLayerId={activeLayerId}
              onSelectLayer={setActiveLayerId}
              onUpdateLayer={(id, patch) =>
                setScene((current) => updateLayer(current, id, patch))
              }
              onDropImageFile={handleDropImageFile}
              interactive
            />

            <div className="footer-row">
              <span>ドラッグで緯度経度を更新</span>
              <span>左側のレイヤーを選択して数値編集</span>
            </div>
          </section>

          <section className="viewport-panel">
            <div className="panel-header">
              <div>
                <h2>ProjectionPreview</h2>
                <p>空間配置を Equirectangular に投影し直した結果。</p>
              </div>
              <span className="pill">Rendered result</span>
            </div>

            <ProjectionPreview scene={scene} />
          </section>
        </div>

        <aside className="side-panel">
          <CollapsiblePanel
            title="Scene"
            description="ガイド、背景、ドーム、カメラの基本設定。"
            open={scenePanelOpen}
            onToggle={() => setScenePanelOpen((current) => !current)}
          >
            <label>
              Dome radius
              <input
                type="number"
                value={scene.dome.radius}
                onChange={(event) =>
                  updateSceneDome("radius", 0, Number(event.target.value))
                }
              />
            </label>
            <label>
              Dome scale
              <div className="triple-input">
                {scene.dome.scale.map((value, axis) => (
                  <input
                    key={axis}
                    type="number"
                    value={value}
                    onChange={(event) =>
                      updateSceneDome(
                        "scale",
                        axis as 0 | 1 | 2,
                        Number(event.target.value),
                      )
                    }
                  />
                ))}
              </div>
            </label>
            <label>
              Dome translate
              <div className="triple-input">
                {scene.dome.translate.map((value, axis) => (
                  <input
                    key={axis}
                    type="number"
                    value={value}
                    onChange={(event) =>
                      updateSceneDome(
                        "translate",
                        axis as 0 | 1 | 2,
                        Number(event.target.value),
                      )
                    }
                  />
                ))}
              </div>
            </label>
            <label>
              Camera position
              <div className="triple-input">
                {scene.camera.position.map((value, axis) => (
                  <input
                    key={axis}
                    type="number"
                    value={value}
                    onChange={(event) =>
                      updateSceneCamera(
                        axis as 0 | 1 | 2,
                        Number(event.target.value),
                      )
                    }
                  />
                ))}
              </div>
            </label>
          </CollapsiblePanel>

          <CollapsiblePanel
            title="Layers"
            description="最大 10 枚の 2D 画像。"
            open={layersPanelOpen}
            onToggle={() => setLayersPanelOpen((current) => !current)}
            action={
              <button
                type="button"
                disabled={scene.layers.length >= 10}
                onClick={handleAddLayer}
              >
                Add
              </button>
            }
          >
            <div className="layer-list">
              {scene.layers.map((layer) => (
                <div
                  key={layer.id}
                  className={`layer-row-shell ${layer.id === activeLayerId ? "active" : ""}`}
                >
                  <button
                    type="button"
                    className="layer-row"
                    onClick={() => setActiveLayerId(layer.id)}
                  >
                    <span>{layer.imageName ?? layer.name}</span>
                    <small>
                      lat {layer.latitude.toFixed(1)} / lon{" "}
                      {layer.longitude.toFixed(1)} / dist{" "}
                      {layer.distance.toFixed(1)}
                    </small>
                  </button>
                  <button
                    type="button"
                    className="layer-delete"
                    onClick={() => handleDeleteLayer(layer.id)}
                    aria-label={`${layer.name} を削除`}
                  >
                    Delete
                  </button>
                </div>
              ))}
            </div>
          </CollapsiblePanel>

          <CollapsiblePanel
            title="Inspector"
            description="選択中レイヤーの配置調整。"
            open={inspectorPanelOpen}
            onToggle={() => setInspectorPanelOpen((current) => !current)}
          >
            {activeLayer ? (
              <>
                <label>
                  Image
                  <div className="row-actions">
                    <input
                      type="text"
                      value={activeLayer.imageUrl}
                      readOnly
                      placeholder="未設定"
                    />
                    <input
                      ref={(element) => {
                        layerInputRefs.current[activeLayer.id] = element;
                      }}
                      type="file"
                      accept="image/*"
                      hidden
                      onChange={handleLayerFileLoad(activeLayer.id)}
                    />
                    <button
                      type="button"
                      onClick={() =>
                        layerInputRefs.current[activeLayer.id]?.click()
                      }
                    >
                      Load
                    </button>
                  </div>
                </label>
                <DraggableNumberField
                  label="Latitude"
                  value={activeLayer.latitude}
                  onChange={(nextValue) =>
                    setScene((current) =>
                      updateLayer(current, activeLayer.id, {
                        latitude: nextValue,
                      }),
                    )
                  }
                  stepPerPixel={0.2}
                  min={-90}
                  max={90}
                />
                <DraggableNumberField
                  label="Longitude"
                  value={activeLayer.longitude}
                  onChange={(nextValue) =>
                    setScene((current) =>
                      updateLayer(current, activeLayer.id, {
                        longitude: nextValue,
                      }),
                    )
                  }
                  stepPerPixel={0.2}
                  min={-180}
                  max={180}
                />
                <DraggableNumberField
                  label="Distance"
                  value={activeLayer.distance}
                  onChange={(nextValue) =>
                    setScene((current) =>
                      updateLayer(current, activeLayer.id, {
                        distance: nextValue,
                      }),
                    )
                  }
                  stepPerPixel={0.1}
                  min={0.1}
                  max={200}
                />
                <DraggableNumberField
                  label="Rotation"
                  value={activeLayer.rotation}
                  onChange={(nextValue) =>
                    setScene((current) =>
                      updateLayer(current, activeLayer.id, {
                        rotation: nextValue,
                      }),
                    )
                  }
                  stepPerPixel={1}
                  wrap={360}
                />
                <DraggableNumberField
                  label="Scale"
                  value={activeLayer.scale}
                  onChange={(nextValue) =>
                    setScene((current) =>
                      updateLayer(current, activeLayer.id, {
                        scale: nextValue,
                      }),
                    )
                  }
                  stepPerPixel={0.01}
                  min={0.01}
                  max={20}
                />
                <label className="checkbox-row">
                  <input
                    type="checkbox"
                    checked={activeLayer.visible}
                    onChange={(event) =>
                      setScene((current) =>
                        updateLayer(current, activeLayer.id, {
                          visible: event.target.checked,
                        }),
                      )
                    }
                  />
                  Visible
                </label>
              </>
            ) : (
              <p className="empty-state">レイヤーがありません。</p>
            )}
          </CollapsiblePanel>

          <section className="panel">
            <div className="panel-header">
              <div>
                <h2>VR Preview</h2>
                <p>Three.js の 3D プレビュー。</p>
              </div>
              <div className="panel-actions">
                <button
                  type="button"
                  onClick={() => setVrGuideVisible((current) => !current)}
                >
                  Guide {vrGuideVisible ? "ON" : "OFF"}
                </button>
                <button
                  type="button"
                  className="primary"
                  onClick={async () => {
                    await previewRef.current?.enterVr();
                  }}
                >
                  VR プレビュー
                </button>
              </div>
            </div>
            <ThreePreview
              ref={previewRef}
              sceneData={scene}
              activeLayerId={activeLayerId}
              guideVisible={vrGuideVisible}
            />
          </section>
        </aside>
      </main>
    </div>
  );
}

function getDefaultLayerScale(imageHeight: number) {
  const referenceHeight = 1024;
  return Math.max(
    0.25,
    Math.min(8, referenceHeight / Math.max(1, imageHeight)),
  );
}

function CollapsiblePanel(props: {
  title: string;
  description: string;
  open: boolean;
  onToggle: () => void;
  action?: ReactNode;
  children: ReactNode;
}) {
  return (
    <section
      className={`panel collapsible-panel ${props.open ? "open" : "closed"}`}
    >
      <div className="panel-header collapsible-header">
        <button
          type="button"
          className="panel-header-button"
          onClick={props.onToggle}
        >
          <div className="panel-heading-copy">
            <h2>
              <span className="panel-disclosure">
                {props.open ? "▼ " : "▶ "}
              </span>
              {props.title}
            </h2>
            <p>{props.description}</p>
          </div>
        </button>
        {props.action ? (
          <div className="panel-actions">{props.action}</div>
        ) : null}
      </div>
      {props.open ? (
        <div className="collapsible-body">{props.children}</div>
      ) : null}
    </section>
  );
}

function DraggableNumberField(props: {
  label: string;
  value: number;
  onChange: (nextValue: number) => void;
  stepPerPixel: number;
  min?: number;
  max?: number;
  wrap?: number;
}) {
  return (
    <label
      className="drag-number-label"
      onPointerDown={(event) =>
        handleNumberLabelDrag(event, props.value, props.onChange, {
          stepPerPixel: props.stepPerPixel,
          min: props.min,
          max: props.max,
          wrap: props.wrap,
        })
      }
    >
      <span className="drag-number-title">{props.label}</span>
      <input
        type="number"
        value={props.value}
        onChange={(event) => props.onChange(Number(event.target.value))}
      />
    </label>
  );
}

function handleNumberLabelDrag(
  event: PointerEvent<HTMLLabelElement>,
  value: number,
  onChange: (nextValue: number) => void,
  options: {
    stepPerPixel: number;
    min?: number;
    max?: number;
    wrap?: number;
  },
) {
  if (!event.isPrimary || event.button !== 0) {
    return;
  }

  const target = event.target;
  if (
    target instanceof HTMLInputElement ||
    target instanceof HTMLButtonElement
  ) {
    return;
  }

  event.preventDefault();
  event.stopPropagation();

  const startX = event.clientX;
  const startValue = value;
  const pointerId = event.pointerId;
  const move = (moveEvent: globalThis.PointerEvent) => {
    if (moveEvent.pointerId !== pointerId) {
      return;
    }

    const delta = (moveEvent.clientX - startX) * options.stepPerPixel;
    let nextValue = startValue + delta;
    if (options.wrap) {
      nextValue = wrapNumber(nextValue, options.wrap);
    }
    if (typeof options.min === "number") {
      nextValue = Math.max(options.min, nextValue);
    }
    if (typeof options.max === "number") {
      nextValue = Math.min(options.max, nextValue);
    }
    onChange(roundNumber(nextValue));
  };
  const up = (upEvent: globalThis.PointerEvent) => {
    if (upEvent.pointerId !== pointerId) {
      return;
    }
    window.removeEventListener("pointermove", move);
    window.removeEventListener("pointerup", up);
    window.removeEventListener("pointercancel", up);
  };

  window.addEventListener("pointermove", move);
  window.addEventListener("pointerup", up);
  window.addEventListener("pointercancel", up);
}

function roundNumber(value: number) {
  return Math.round(value * 100) / 100;
}

function wrapNumber(value: number, span: number) {
  const wrapped = value % span;
  return wrapped < 0 ? wrapped + span : wrapped;
}
