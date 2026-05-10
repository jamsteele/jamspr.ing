"""
Find painted fairy-light positions in assets/room.png and emit them as a
JS-array literal that can be pasted into PAINTED_LIGHT_POSITIONS in script.js.

Use this any time the room art is replaced or significantly edited so the
twinkle overlay stays aligned with the painted lights.

Approach:
  1. Filter pixels: bright (R+G+B > 600) AND warm-leaning (R >= B - 5).
  2. Restrict to known light-string regions (window-frame perimeter +
     right-wall shelf strip). Bottom of window is excluded — too much
     mountain/sunset bleed-through and obscured by books.
  3. Find local maxima (brightest pixel in 9×9 neighbourhood).
  4. Merge maxima within 16px of each other (single light = single position).
  5. Convert pixel coords to % of image width/height.

Tunables: BRIGHTNESS_MIN, MERGE_DISTANCE_PX, region pixel ranges.

Outputs:
  - stdout: JS array literal of {x, y} positions in %.
  - assets/detection_overlay.png: room art with red rings around each
    detected light, for visual QA.

Requires: Pillow, numpy (pip install Pillow numpy).
"""

from PIL import Image, ImageDraw
import numpy as np
from pathlib import Path
import sys

ROOT = Path(__file__).resolve().parent.parent / "assets"
SRC = ROOT / "room.png"
OUT_OVERLAY = ROOT / "detection_overlay.png"

BRIGHTNESS_MIN = 600    # sum of RGB
MERGE_DISTANCE_PX = 16  # adjacent maxima within this distance collapse to one


def detect():
    img = Image.open(SRC).convert("RGB")
    arr = np.array(img)
    H, W, _ = arr.shape

    R, G, B = arr[..., 0].astype(int), arr[..., 1].astype(int), arr[..., 2].astype(int)
    brightness = R + G + B
    mask = (brightness > BRIGHTNESS_MIN) & (R > B - 5)

    # Restrict to known light regions in the current room.png (1536×1024).
    # If the room art is replaced, retune these pixel ranges.
    region = np.zeros_like(mask, dtype=bool)
    region[0:55, 110:600] = True       # window — top wood frame
    region[40:330, 105:148] = True     # window — left wood frame
    region[40:330, 552:610] = True     # window — right wood frame
    region[180:280, 1050:1490] = True  # right wall — shelf with bulbs
    mask &= region

    # Find local maxima
    local_max = np.zeros_like(mask, dtype=bool)
    for y in range(8, H - 8):
        for x in range(8, W - 8):
            if not mask[y, x]:
                continue
            b = brightness[y, x]
            if b == brightness[y - 4 : y + 5, x - 4 : x + 5].max():
                local_max[y, x] = True

    points = list(zip(*np.where(local_max)[::-1]))  # (x, y) pairs

    # Merge nearby maxima
    merged = []
    used = [False] * len(points)
    for i, (x1, y1) in enumerate(points):
        if used[i]:
            continue
        cluster = [(x1, y1)]
        used[i] = True
        for j, (x2, y2) in enumerate(points):
            if used[j]:
                continue
            if abs(x1 - x2) < MERGE_DISTANCE_PX and abs(y1 - y2) < MERGE_DISTANCE_PX:
                cluster.append((x2, y2))
                used[j] = True
        cx = sum(p[0] for p in cluster) / len(cluster)
        cy = sum(p[1] for p in cluster) / len(cluster)
        merged.append((cx, cy))

    return img, merged, W, H


def main():
    img, points, W, H = detect()
    points.sort(key=lambda p: (p[1], p[0]))

    overlay = img.copy()
    draw = ImageDraw.Draw(overlay)
    for cx, cy in points:
        draw.ellipse([cx - 12, cy - 12, cx + 12, cy + 12], outline="red", width=3)
    overlay.save(OUT_OVERLAY)

    print(f"// {len(points)} painted lights detected. Visual QA: {OUT_OVERLAY.name}")
    print("const PAINTED_LIGHT_POSITIONS = [")
    for cx, cy in points:
        print(f"  {{ x: {cx / W * 100:.2f}, y: {cy / H * 100:.2f} }},")
    print("];")


if __name__ == "__main__":
    sys.exit(main())
