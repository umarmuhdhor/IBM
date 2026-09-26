"""Render the app icon as a monochrome halftone SVG for the landing hero.

Usage: python3 scripts/halftone-logo.py ../../../app/resources/icon.png public/brand/bob-crew-halftone.svg
Dot radius follows luminance x alpha, so faces read bright and outlines drop out.
"""

import sys

from PIL import Image

GRID = 64  # dots per side
CELL = 12  # output px per dot, matches the 12px page dot grid
MAX_R = 5.2

src, dst = sys.argv[1], sys.argv[2]
img = Image.open(src).convert("RGBA").resize((GRID, GRID), Image.LANCZOS)

circles = []
for y in range(GRID):
    for x in range(GRID):
        r, g, b, a = img.getpixel((x, y))
        lum = (0.2126 * r + 0.7152 * g + 0.0722 * b) / 255
        value = lum * (a / 255)
        radius = MAX_R * value**0.8
        if radius < 0.6:
            continue
        cx, cy = x * CELL + CELL / 2, y * CELL + CELL / 2
        circles.append(f'<circle cx="{cx:g}" cy="{cy:g}" r="{radius:.2f}"/>')

size = GRID * CELL
with open(dst, "w") as out:
    out.write(
        f'<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 {size} {size}" fill="#f4f4f4">'
        + "".join(circles)
        + "</svg>\n"
    )
print(f"{len(circles)} dots -> {dst}")
