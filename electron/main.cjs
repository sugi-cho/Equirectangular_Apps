const { app, BrowserWindow } = require("electron");
const http = require("node:http");
const fs = require("node:fs/promises");
const path = require("node:path");

app.commandLine.appendSwitch("enable-features", "WebXR");
app.commandLine.appendSwitch("force-webxr-runtime", "openxr");

const isDev = !app.isPackaged;
const devUrl = "http://127.0.0.1:5173";

let server = null;
let serverPort = null;

function createWindow() {
  const win = new BrowserWindow({
    width: 1600,
    height: 1000,
    backgroundColor: "#0b0e17",
    title: "Equirectangular Editor",
    webPreferences: {
      contextIsolation: true,
      nodeIntegration: false,
      preload: path.join(__dirname, "preload.cjs"),
    },
  });

  if (isDev) {
    win.loadURL(devUrl);
    win.webContents.openDevTools({ mode: "detach" });
    return;
  }

  if (serverPort) {
    win.loadURL(`http://127.0.0.1:${serverPort}/`);
    return;
  }

  win.loadFile(path.join(__dirname, "..", "dist", "index.html"));
}

function startStaticServer(rootDir) {
  return new Promise((resolve, reject) => {
    const serverInstance = http.createServer(async (req, res) => {
      try {
        const requestUrl = new URL(req.url || "/", "http://127.0.0.1");
        const requestPath = decodeURIComponent(requestUrl.pathname);
        const targetPath = requestPath === "/" ? "index.html" : requestPath.slice(1);
        const safePath = path.normalize(path.join(rootDir, targetPath));

        if (!safePath.startsWith(path.normalize(rootDir))) {
          res.statusCode = 403;
          res.end("Forbidden");
          return;
        }

        let filePath = safePath;
        try {
          await fs.access(filePath);
        } catch {
          filePath = path.join(rootDir, "index.html");
        }

        const ext = path.extname(filePath).toLowerCase();
        res.setHeader("Cache-Control", "no-cache");
        res.setHeader("Content-Type", contentTypeFor(ext));
        const data = await fs.readFile(filePath);
        res.end(data);
      } catch (error) {
        res.statusCode = 500;
        res.end(String(error));
      }
    });

    serverInstance.once("error", reject);
    serverInstance.listen(0, "127.0.0.1", () => {
      const address = serverInstance.address();
      if (!address || typeof address === "string") {
        reject(new Error("Failed to bind local server"));
        return;
      }
      server = serverInstance;
      resolve(address.port);
    });
  });
}

function contentTypeFor(ext) {
  switch (ext) {
    case ".html":
      return "text/html; charset=utf-8";
    case ".js":
      return "application/javascript; charset=utf-8";
    case ".css":
      return "text/css; charset=utf-8";
    case ".json":
      return "application/json; charset=utf-8";
    case ".png":
      return "image/png";
    case ".svg":
      return "image/svg+xml";
    case ".ico":
      return "image/x-icon";
    default:
      return "application/octet-stream";
  }
}

app.whenReady().then(async () => {
  if (!isDev) {
    const distDir = path.join(app.getAppPath(), "dist");
    serverPort = await startStaticServer(distDir);
  }

  createWindow();

  app.on("activate", () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      createWindow();
    }
  });
});

app.on("window-all-closed", () => {
  if (server) {
    server.close();
    server = null;
  }
  if (process.platform !== "darwin") {
    app.quit();
  }
});
