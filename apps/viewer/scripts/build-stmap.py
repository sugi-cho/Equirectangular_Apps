#!/usr/bin/env python
from __future__ import annotations

import argparse
import json
from datetime import datetime, timezone
from pathlib import Path

import numpy as np
import OpenEXR


def main() -> int:
    parser = argparse.ArgumentParser()
    parser.add_argument("--input", required=True)
    parser.add_argument("--out", action="append", required=True)
    args = parser.parse_args()

    input_path = Path(args.input).resolve()
    output_dirs = [Path(entry).resolve() for entry in args.out]

    for output_dir in output_dirs:
        output_dir.mkdir(parents=True, exist_ok=True)

    exr = OpenEXR.InputFile(str(input_path))
    header = exr.header()
    data_window = header["dataWindow"]
    width = data_window.max.x - data_window.min.x + 1
    height = data_window.max.y - data_window.min.y + 1

    r = np.frombuffer(exr.channel("R"), dtype=np.float32).reshape(height, width)
    g = np.frombuffer(exr.channel("G"), dtype=np.float32).reshape(height, width)
    a = np.frombuffer(exr.channel("A"), dtype=np.float32).reshape(height, width)

    valid = np.isfinite(r) & np.isfinite(g) & np.isfinite(a) & (a > 0.0)
    ys, xs = np.where(valid)
    if xs.size == 0 or ys.size == 0:
      raise RuntimeError("No valid STMap pixels found.")

    min_x = int(xs.min())
    min_y = int(ys.min())
    max_x = int(xs.max())
    max_y = int(ys.max())
    crop_width = max_x - min_x + 1
    crop_height = max_y - min_y + 1

    crop_valid = valid[min_y : max_y + 1, min_x : max_x + 1]
    crop_r = np.where(crop_valid, r[min_y : max_y + 1, min_x : max_x + 1], 0.0)
    crop_g = np.where(crop_valid, g[min_y : max_y + 1, min_x : max_x + 1], 0.0)

    pixels = np.stack((crop_r, crop_g), axis=-1).astype("<f2")
    mask = np.where(crop_valid, 255, 0).astype(np.uint8)

    manifest = {
        "version": 3,
        "revision": f"{input_path.name}:{width}x{height}:{datetime.now(timezone.utc).isoformat()}",
        "source": {
            "fileName": input_path.name,
            "width": width,
            "height": height,
        },
        "crop": {
            "x": min_x,
            "y": min_y,
            "width": crop_width,
            "height": crop_height,
        },
        "cropUv": {
            "x": min_x / width,
            "y": min_y / height,
            "width": crop_width / width,
            "height": crop_height / height,
        },
        "format": {
            "channels": "rg",
            "encoding": "float16",
        },
        "files": {
            "pixels": "pixels.bin",
            "mask": "mask.bin",
        },
    }

    manifest_text = json.dumps(manifest, indent=2) + "\n"
    for output_dir in output_dirs:
        (output_dir / "pixels.bin").write_bytes(pixels.tobytes())
        (output_dir / "mask.bin").write_bytes(mask.tobytes())
        (output_dir / "stmap.json").write_text(manifest_text, encoding="utf-8")

    print("Wrote STMap bundle to " + ", ".join(str(path) for path in output_dirs))
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
