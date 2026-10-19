"""Generates the 1024x1024 source icon used by `tauri icon`.

No Pillow dependency: the mark is simple enough (a rounded square plus a line
chart) to rasterise directly and emit as a PNG.
"""

import math
import struct
import zlib

SIZE = 1024
BG = (37, 36, 42)
FG = (252, 251, 250)

# Chart geometry. Four vertices with a dip in the middle read as a trend at
# 32x32 while still leaving a recognisable silhouette at 1024.
POINTS = [(256, 648), (428, 486), (590, 576), (772, 352)]
BASELINE = 716
STROKE_HALF = 30
FILL_ALPHA = 0.1

CHART_BOX = (200, 300, 820, 730)


def rounded_rect_alpha(px, py, x0, y0, x1, y1, radius):
    """Analytic coverage of a rounded rectangle at a pixel centre."""
    cx, cy = (x0 + x1) / 2.0, (y0 + y1) / 2.0
    hw, hh = (x1 - x0) / 2.0, (y1 - y0) / 2.0
    dx = abs(px - cx) - (hw - radius)
    dy = abs(py - cy) - (hh - radius)
    ax, ay = max(dx, 0.0), max(dy, 0.0)
    distance = math.hypot(ax, ay) + min(max(dx, dy), 0.0) - radius
    return max(0.0, min(1.0, 0.5 - distance))


def segment_distance(px, py, x1, y1, x2, y2):
    dx, dy = x2 - x1, y2 - y1
    length2 = dx * dx + dy * dy
    if length2 == 0.0:
        return math.hypot(px - x1, py - y1)
    t = max(0.0, min(1.0, ((px - x1) * dx + (py - y1) * dy) / length2))
    return math.hypot(px - (x1 + t * dx), py - (y1 + t * dy))


def inside_polygon(polygon, px, py):
    result = False
    count = len(polygon)
    j = count - 1
    for i in range(count):
        xi, yi = polygon[i]
        xj, yj = polygon[j]
        if (yi > py) != (yj > py) and px < (xj - xi) * (py - yi) / (yj - yi) + xi:
            result = not result
        j = i
    return result


def blend(dst, src, alpha):
    return tuple(round(d + (s - d) * alpha) for d, s in zip(dst, src))


def main():
    area = POINTS + [(POINTS[-1][0], BASELINE), (POINTS[0][0], BASELINE)]
    segments = list(zip(POINTS, POINTS[1:]))
    box_x0, box_y0, box_x1, box_y1 = CHART_BOX

    rows = []
    for y in range(SIZE):
        row = bytearray()
        row.append(0)  # filter type: none
        py = y + 0.5
        for x in range(SIZE):
            px = x + 0.5
            alpha = rounded_rect_alpha(px, py, 96, 96, SIZE - 96, SIZE - 96, 190)
            if alpha <= 0.0:
                row.extend((0, 0, 0, 0))
                continue

            color = BG

            if box_x0 <= px <= box_x1 and box_y0 <= py <= box_y1:
                if inside_polygon(area, px, py):
                    color = blend(color, FG, FILL_ALPHA)

                stroke = 0.0
                for (x1, y1), (x2, y2) in segments:
                    distance = segment_distance(px, py, x1, y1, x2, y2)
                    stroke = max(stroke, max(0.0, min(1.0, STROKE_HALF + 0.5 - distance)))

                # Round joins only. A circle exactly the width of the stroke
                # closes the outer corner without reading as an end-point dot.
                for cx, cy in POINTS:
                    distance = math.hypot(px - cx, py - cy)
                    stroke = max(stroke, max(0.0, min(1.0, STROKE_HALF + 0.5 - distance)))

                if stroke > 0.0:
                    color = blend(color, FG, stroke)

            row.extend((*color, round(alpha * 255)))
        rows.append(bytes(row))

    raw = b"".join(rows)

    def chunk(tag, payload):
        return (
            struct.pack(">I", len(payload))
            + tag
            + payload
            + struct.pack(">I", zlib.crc32(tag + payload) & 0xFFFFFFFF)
        )

    header = struct.pack(">IIBBBBB", SIZE, SIZE, 8, 6, 0, 0, 0)
    png = (
        b"\x89PNG\r\n\x1a\n"
        + chunk(b"IHDR", header)
        + chunk(b"IDAT", zlib.compress(raw, 9))
        + chunk(b"IEND", b"")
    )

    with open("assets/icon.png", "wb") as handle:
        handle.write(png)
    print(f"wrote assets/icon.png ({len(png)} bytes)")


if __name__ == "__main__":
    main()
