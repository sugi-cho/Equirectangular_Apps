import { useEffect, useMemo, useRef, useState, type ChangeEvent } from "react";
import { StMapOverlayPreview } from "./components/StMapOverlayPreview";
import { ThreeViewer, type ThreeViewerHandle } from "./components/ThreeViewer";
import { formatTime, readMediaKind } from "./lib/media";
import { loadLastMedia, saveLastMedia } from "./lib/recent-media";

export type SourceKind = "none" | "image" | "video";

const DEFAULT_SPHERE_RADIUS = 13.3;
type MediaSelection = {
  kind: SourceKind;
  sourceUrl: string;
  sourceName: string;
};

type ViewerState = {
  kind: SourceKind;
  sourceUrl: string;
  sourceName: string;
  sourceWidth: number;
  sourceHeight: number;
  sphereRadius: number;
  playing: boolean;
  loop: boolean;
  currentTime: number;
  duration: number;
};

const emptyState: ViewerState = {
  kind: "none",
  sourceUrl: "",
  sourceName: "Untitled",
  sourceWidth: 0,
  sourceHeight: 0,
  sphereRadius: DEFAULT_SPHERE_RADIUS,
  playing: false,
  loop: false,
  currentTime: 0,
  duration: 0,
};

const emptyMediaSelection: MediaSelection = {
  kind: "none",
  sourceUrl: "",
  sourceName: "",
};

export default function App() {
  const [state, setState] = useState<ViewerState>(emptyState);
  const [stmapSource, setStmapSource] = useState<MediaSelection>(emptyMediaSelection);
  const [status, setStatus] = useState("画像または動画を読み込んでください。");
  const inputRef = useRef<HTMLInputElement | null>(null);
  const stmapInputRef = useRef<HTMLInputElement | null>(null);
  const [videoElement, setVideoElement] = useState<HTMLVideoElement | null>(null);
  const [stmapVideoElement, setStmapVideoElement] = useState<HTMLVideoElement | null>(null);
  const viewerRef = useRef<ThreeViewerHandle | null>(null);
  const currentObjectUrlRef = useRef<string | null>(null);
  const currentStmapObjectUrlRef = useRef<string | null>(null);
  const currentBlobRef = useRef<Blob | null>(null);
  const stateRef = useRef(state);
  const saveTimerRef = useRef<number | null>(null);
  const persistenceSuspendedRef = useRef(false);

  stateRef.current = state;

  const canPlayVideo = state.kind === "video" && Boolean(state.sourceUrl);
  const canAdjustRadius = state.kind !== "none";
  const stmapSourceLabel = useMemo(() => {
    if (stmapSource.kind === "none") {
      return "未選択";
    }
    return stmapSource.sourceName;
  }, [stmapSource.kind, stmapSource.sourceName]);
  const currentLabel = useMemo(() => {
    if (state.kind === "none") {
      return "No source";
    }
    return state.sourceName;
  }, [state.kind, state.sourceName]);

  useEffect(() => {
    return () => {
      if (saveTimerRef.current !== null) {
        window.clearTimeout(saveTimerRef.current);
        saveTimerRef.current = null;
      }
      if (currentObjectUrlRef.current) {
        URL.revokeObjectURL(currentObjectUrlRef.current);
        currentObjectUrlRef.current = null;
      }
      if (currentStmapObjectUrlRef.current) {
        URL.revokeObjectURL(currentStmapObjectUrlRef.current);
        currentStmapObjectUrlRef.current = null;
      }
    };
  }, []);

  useEffect(() => {
    void (async () => {
      try {
        const stored = await loadLastMedia();
        if (!stored) {
          return;
        }
        if (currentObjectUrlRef.current) {
          URL.revokeObjectURL(currentObjectUrlRef.current);
        }
        const sourceUrl = URL.createObjectURL(stored.blob);
        currentObjectUrlRef.current = sourceUrl;
        currentBlobRef.current = stored.blob;
        persistenceSuspendedRef.current = stored.kind === "video";
        setState((current) => ({
          ...current,
          kind: stored.kind,
          sourceUrl,
          sourceName: stored.sourceName,
          sourceWidth: 0,
          sourceHeight: 0,
          currentTime: stored.currentTime ?? 0,
          duration: 0,
          playing: false,
          loop: stored.loop ?? false,
        }));
        setStatus(`Restored: ${stored.sourceName}`);
      } catch (error) {
        console.error(error);
        setStatus(`Restore failed: ${error instanceof Error ? error.message : String(error)}`);
      }
    })();
  }, []);

  useEffect(() => {
    const handleWindowError = (event: ErrorEvent) => {
      setStatus(`Window error: ${event.message}`);
    };
    const handleRejection = (event: PromiseRejectionEvent) => {
      setStatus(
        `Promise rejected: ${event.reason instanceof Error ? event.reason.message : String(event.reason)}`,
      );
    };
    window.addEventListener("error", handleWindowError);
    window.addEventListener("unhandledrejection", handleRejection);
    return () => {
      window.removeEventListener("error", handleWindowError);
      window.removeEventListener("unhandledrejection", handleRejection);
    };
  }, []);

  useEffect(() => {
    const video = videoElement;
    if (!video || state.kind !== "video") {
      return;
    }
    video.loop = state.loop;
    if (state.playing) {
      void video.play().catch(() => {
        setState((current) => ({ ...current, playing: false }));
      });
    } else {
      video.pause();
    }
  }, [state.kind, state.loop, state.playing, state.sourceUrl, videoElement]);

  useEffect(() => {
    const video = stmapVideoElement;
    if (!video || stmapSource.kind !== "video") {
      return;
    }
    video.loop = true;
    video.muted = true;
    video.playsInline = true;
    void video.play().catch((error) => {
      console.error(error);
      setStatus(`2D Overlay Media video error: ${error instanceof Error ? error.message : String(error)}`);
    });
  }, [stmapSource.kind, stmapSource.sourceUrl, stmapVideoElement]);

  const saveCurrentMedia = (currentTime: number) => {
    if (persistenceSuspendedRef.current) {
      return;
    }
    const blob = currentBlobRef.current;
    if (!blob) {
      return;
    }
    void saveLastMedia({
      kind: "video",
      sourceName: stateRef.current.sourceName,
      blob,
      currentTime,
      loop: stateRef.current.loop,
    }).catch((error) => {
      console.error(error);
      setStatus(`Save failed: ${error instanceof Error ? error.message : String(error)}`);
    });
  };

  const scheduleCurrentMediaSave = (currentTime: number) => {
    if (persistenceSuspendedRef.current) {
      return;
    }
    if (saveTimerRef.current !== null) {
      window.clearTimeout(saveTimerRef.current);
    }
    saveTimerRef.current = window.setTimeout(() => {
      saveTimerRef.current = null;
      saveCurrentMedia(currentTime);
    }, 800);
  };

  const openFile = async (file: File) => {
    const kind = readMediaKind(file);
    const sourceUrl = URL.createObjectURL(file);
    if (currentObjectUrlRef.current) {
      URL.revokeObjectURL(currentObjectUrlRef.current);
    }
    currentObjectUrlRef.current = sourceUrl;
    currentBlobRef.current = file;
    setState({
      kind,
      sourceUrl,
      sourceName: file.name,
      sourceWidth: 0,
      sourceHeight: 0,
      sphereRadius: DEFAULT_SPHERE_RADIUS,
      playing: kind === "video",
      loop: false,
      currentTime: 0,
      duration: 0,
    });
    persistenceSuspendedRef.current = false;
    setStatus(`${kind === "video" ? "Video" : "Image"} loaded: ${file.name}`);
    void saveLastMedia({ kind, sourceName: file.name, blob: file, currentTime: 0, loop: false }).catch((error) => {
      console.error(error);
      setStatus(`Save failed: ${error instanceof Error ? error.message : String(error)}`);
    });
  };

  const openStmapSource = async (file: File) => {
    const kind = readMediaKind(file);
    const sourceUrl = URL.createObjectURL(file);
    if (currentStmapObjectUrlRef.current) {
      URL.revokeObjectURL(currentStmapObjectUrlRef.current);
    }
    currentStmapObjectUrlRef.current = sourceUrl;
    setStmapSource({
      kind,
      sourceUrl,
      sourceName: file.name,
    });
    setStatus(`2D Overlay Media loaded: ${file.name}`);
  };

  const handleSourceInput = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) {
      return;
    }
    void openFile(file);
    event.target.value = "";
  };

  const handleStmapSourceInput = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) {
      return;
    }
    void openStmapSource(file);
    event.target.value = "";
  };

  const clearStmapSource = () => {
    if (currentStmapObjectUrlRef.current) {
      URL.revokeObjectURL(currentStmapObjectUrlRef.current);
      currentStmapObjectUrlRef.current = null;
    }
    setStmapSource(emptyMediaSelection);
    setStatus("2D Overlay Media をクリアしました。");
  };

  const handlePlayToggle = () => {
    if (state.kind !== "video") {
      return;
    }
    setState((current) => ({ ...current, playing: !current.playing }));
  };

  const handleReset = () => {
    setState((current) => ({ ...current, sphereRadius: DEFAULT_SPHERE_RADIUS, currentTime: 0 }));
    const video = videoElement;
    if (video) {
      video.currentTime = 0;
    }
    if (state.kind === "video") {
      saveCurrentMedia(0);
    }
  };

  const handleSeek = (time: number) => {
    const video = videoElement;
    if (video) {
      video.currentTime = time;
    }
    setState((current) => ({ ...current, currentTime: time }));
    if (state.kind === "video") {
      saveCurrentMedia(time);
    }
  };

  return (
    <div className="app-shell">
      <header className="topbar">
        <div>
          <p className="eyebrow">Equirectangular Viewer</p>
          <p className="project-name">{currentLabel}</p>
        </div>
        <div className="topbar-actions">
          <input
            ref={inputRef}
            type="file"
            accept="image/*,video/*"
            hidden
            onChange={handleSourceInput}
          />
          <button type="button" onClick={() => inputRef.current?.click()}>
            Open
          </button>
          <button type="button" onClick={handleReset}>
            Reset
          </button>
          <button type="button" onClick={() => window.location.assign("/editor")}>
            Editor
          </button>
        </div>
      </header>

      <main className="workspace">
        <section className="viewer-column">
          <div className="panel">
            <div className="panel-header">
              <div>
                <h2>Viewer</h2>
                <p>画像と動画を Equirectangular として表示します。</p>
              </div>
              <span className="pill">{state.kind === "video" ? "Video" : "Image"}</span>
            </div>
            <div className="stage">
              {state.kind === "video" ? (
                <video
                  ref={setVideoElement}
                  className="media-fit"
                  src={state.sourceUrl}
                  muted
                  autoPlay
                  playsInline
                  loop={state.loop}
                  onError={(event) => {
                    const video = event.currentTarget;
                    const error = video?.error;
                    setStatus(
                      error
                        ? `Video error: ${error.code}${error.message ? ` ${error.message}` : ""}`
                        : "Video error.",
                    );
                  }}
                  onLoadedMetadata={(event) =>
                    (() => {
                      const video = event.currentTarget;
                      if (!video) {
                        return;
                      }
                      setState((current) => ({
                        ...current,
                        duration: video.duration || 0,
                        sourceWidth: video.videoWidth || current.sourceWidth,
                        sourceHeight: video.videoHeight || current.sourceHeight,
                      }));
                      if (state.kind === "video" && state.currentTime > 0 && Number.isFinite(video.duration)) {
                        video.currentTime = Math.min(state.currentTime, Math.max(video.duration - 0.1, 0));
                      } else {
                        persistenceSuspendedRef.current = false;
                      }
                    })()
                  }
                  onSeeked={() => {
                    if (persistenceSuspendedRef.current) {
                      persistenceSuspendedRef.current = false;
                    }
                    saveCurrentMedia(videoElement?.currentTime ?? stateRef.current.currentTime);
                  }}
                  onTimeUpdate={(event) =>
                    (() => {
                      const video = event.currentTarget;
                      if (!video) {
                        return;
                      }
                      const currentTime = video.currentTime;
                      setState((current) => ({
                        ...current,
                        currentTime,
                      }));
                      scheduleCurrentMediaSave(currentTime);
                    })()
                  }
                  onPause={() => {
                    setState((current) => ({ ...current, playing: false }));
                    saveCurrentMedia(stateRef.current.currentTime);
                  }}
                  onEnded={() => {
                    setState((current) => ({ ...current, playing: false }));
                    saveCurrentMedia(stateRef.current.currentTime);
                  }}
                />
              ) : state.kind === "image" ? (
                <img
                  className="media-fit"
                  src={state.sourceUrl}
                  alt={state.sourceName}
                  onLoad={(event) => {
                    const img = event.currentTarget;
                    if (!img) {
                      return;
                    }
                    setState((current) => ({
                      ...current,
                      sourceWidth: img.naturalWidth || current.sourceWidth,
                      sourceHeight: img.naturalHeight || current.sourceHeight,
                    }));
                  }}
                />
              ) : (
                <div className="empty-state">Open から画像または動画を読み込んでください。</div>
              )}
              <StMapOverlayPreview
                sourceKind={stmapSource.kind}
                sourceUrl={stmapSource.sourceUrl}
                videoElement={stmapVideoElement}
                onStatus={setStatus}
              />
            </div>
            {(canPlayVideo || canAdjustRadius) && (
              <div className="media-controls media-controls-stack">
                {canPlayVideo && (
                  <div className="video-controls">
                    <button type="button" onClick={handlePlayToggle}>
                      {state.playing ? "Pause" : "Play"}
                    </button>
                    <button type="button" onClick={() => setState((current) => ({ ...current, loop: !current.loop }))}>
                      Loop {state.loop ? "ON" : "OFF"}
                    </button>
                    <input
                      type="range"
                      min={0}
                      max={Math.max(state.duration, 0)}
                      step={0.01}
                      value={state.currentTime}
                      onChange={(event) => handleSeek(Number(event.target.value))}
                    />
                    <span className="timecode">
                      {formatTime(state.currentTime)} / {formatTime(state.duration)}
                    </span>
                  </div>
                )}
                {canAdjustRadius && (
                  <label className="radius-control">
                    Sphere Radius
                    <input
                      type="range"
                      min={5}
                      max={50}
                      step={1}
                      value={state.sphereRadius}
                      onChange={(event) =>
                        setState((current) => ({ ...current, sphereRadius: Number(event.target.value) }))
                      }
                    />
                    <span className="radius-value">{state.sphereRadius.toFixed(0)} m</span>
                  </label>
                )}
              </div>
            )}
          </div>

          <section className="panel">
            <div className="panel-header">
              <div>
                <h2>2D Overlay Media</h2>
                <p>VR Preview に重ねる 2D メディアを選択します。</p>
              </div>
            </div>
            <div className="media-controls stmap-controls">
              <input
                ref={stmapInputRef}
                type="file"
                accept="image/*,video/*"
                hidden
                onChange={handleStmapSourceInput}
              />
              <div className="stmap-controls-row">
                <button type="button" onClick={() => stmapInputRef.current?.click()}>
                  2D Overlay Media を選択
                </button>
                <button type="button" onClick={clearStmapSource} disabled={stmapSource.kind === "none"}>
                  クリア
                </button>
              </div>
              <p className="stmap-source-label">2D Overlay Media: {stmapSourceLabel}</p>
            </div>
            {stmapSource.kind === "video" ? (
              <video
                ref={setStmapVideoElement}
                src={stmapSource.sourceUrl}
                muted
                autoPlay
                playsInline
                loop
                hidden
                onError={(event) => {
                  const video = event.currentTarget;
                  const error = video?.error;
                  setStatus(
                    error
                      ? `2D Overlay Media video error: ${error.code}${error.message ? ` ${error.message}` : ""}`
                      : "2D Overlay Media video error.",
                  );
                }}
              />
            ) : null}
          </section>
        </section>

        <aside className="side-column">
          <section className="panel">
            <div className="panel-header">
              <div>
                <h2>VR Preview</h2>
                <p>Three.js で球面に投影して確認します。</p>
              </div>
              <button
                type="button"
                className="primary"
                onClick={async () => {
                  const ok = await viewerRef.current?.enterVr();
                  setStatus(ok ? "VR session started." : "VR session not available.");
                }}
              >
                VR プレビュー
              </button>
            </div>
            <ThreeViewer
              ref={viewerRef}
              sourceKind={state.kind}
              sourceUrl={state.sourceUrl}
              videoElement={videoElement}
              stmapSourceKind={stmapSource.kind}
              stmapSourceUrl={stmapSource.sourceUrl}
              stmapVideoElement={stmapVideoElement}
              sphereRadius={state.sphereRadius}
              onStatus={setStatus}
            />
          </section>

          <section className="panel">
            <h2>Status</h2>
            <p>{status}</p>
          </section>
        </aside>
      </main>
    </div>
  );
}
