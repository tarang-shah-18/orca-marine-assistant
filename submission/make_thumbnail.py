#!/usr/bin/env python3
"""Generate the ORCA SIH 2026 YouTube thumbnail (1920x1080 PNG)."""

from PIL import Image, ImageDraw, ImageFont, ImageFilter
import math

W, H = 1920, 1080

# --- palette (matches the app's light theme) ---
BG_TOP = (248, 250, 253)
BG_BOT = (228, 236, 246)
NAVY = (22, 49, 79)          # --color-slate-950 in light
NAVY_SOFT = (58, 94, 130)    # --color-slate-700-ish
CYAN = (10, 111, 156)        # --color-cyan-500 in light
CYAN_FAINT = (178, 214, 232)
CYAN_WASH = (214, 234, 244)
WHITE = (255, 255, 255)

FONT_BLACK = "/System/Library/Fonts/Supplemental/Arial Black.ttf"
FONT_BOLD = "/System/Library/Fonts/Supplemental/Arial Bold.ttf"
FONT_REG = "/System/Library/Fonts/Supplemental/Arial.ttf"


def font(path, size):
    return ImageFont.truetype(path, size)


def v_gradient(w, h, top, bottom):
    base = Image.new("RGB", (w, h), top)
    top_r, top_g, top_b = top
    bot_r, bot_g, bot_b = bottom
    px = base.load()
    for y in range(h):
        t = y / max(h - 1, 1)
        r = int(top_r + (bot_r - top_r) * t)
        g = int(top_g + (bot_g - top_g) * t)
        b = int(top_b + (bot_b - top_b) * t)
        for x in range(w):
            px[x, y] = (r, g, b)
    return base


def radial_glow(size, color, peak=110):
    """Soft radial highlight used to seat the radar."""
    g = Image.new("L", (size, size), 0)
    d = ImageDraw.Draw(g)
    d.ellipse([0, 0, size, size], fill=peak)
    g = g.filter(ImageFilter.GaussianBlur(size // 6))
    layer = Image.new("RGBA", (size, size), (0, 0, 0, 0))
    layer.putalpha(g)
    tint = Image.new("RGBA", (size, size), color + (255,))
    out = Image.new("RGBA", (size, size), (0, 0, 0, 0))
    out.paste(tint, (0, 0), layer)
    return out


img = v_gradient(W, H, BG_TOP, BG_BOT).convert("RGBA")

# ---------------------------------------------------------------- radar
CX, CY = 1436, 500
R_OUT = 352

# soft glow behind the radar
glow = radial_glow(1500, CYAN_WASH, peak=70)
img.alpha_composite(glow, (CX - 750, CY - 750))

d = ImageDraw.Draw(img, "RGBA")

# outer disc
d.ellipse([CX - R_OUT, CY - R_OUT, CX + R_OUT, CY + R_OUT],
          fill=(255, 255, 255, 46), outline=CYAN + (150,), width=3)

# concentric rings
for r in (R_OUT, 288, 204, 120):
    d.ellipse([CX - r, CY - r, CX + r, CY + r],
              outline=CYAN + (110 if r == R_OUT else 70,), width=2)

# cross hairs
d.line([CX - R_OUT, CY, CX + R_OUT, CY], fill=CYAN + (60,), width=2)
d.line([CX, CY - R_OUT, CX, CY + R_OUT], fill=CYAN + (60,), width=2)

# sweep wedge (a lit sector, like a radar sweep caught mid-turn)
sweep = Image.new("RGBA", (W, H), (0, 0, 0, 0))
sd = ImageDraw.Draw(sweep)
sd.pieslice([CX - R_OUT, CY - R_OUT, CX + R_OUT, CY + R_OUT],
            start=-90, end=-38, fill=CYAN + (46,))
sd.pieslice([CX - R_OUT, CY - R_OUT, CX + R_OUT, CY + R_OUT],
            start=-90, end=-88, fill=CYAN + (120,))
sweep = sweep.filter(ImageFilter.GaussianBlur(1.2))
img.alpha_composite(sweep)

# blips: fishing grounds / agent nodes the radar has found
blips = [
    (CX - 168, CY - 128, 13),
    (CX + 120, CY - 196, 10),
    (CX + 214, CY + 66, 15),
    (CX - 96, CY + 176, 9),
    (CX + 44, CY + 236, 11),
    (CX - 238, CY + 40, 8),
]
for bx, by, br in blips:
    d.ellipse([bx - br - 7, by - br - 7, bx + br + 7, by + br + 7],
              fill=CYAN + (38,))
    d.ellipse([bx - br, by - br, bx + br, by + br], fill=CYAN + (235,))
    d.ellipse([bx - br * 0.4, by - br * 0.4, bx + br * 0.4, by + br * 0.4],
              fill=WHITE + (255,))

# No range labels: at thumbnail size they read as noise, and the inner ones
# collided with the ORCA wordmark.

# ---------------------------------------------------------------- waves
def wave(y_base, amp, color, width, phase=0.0):
    pts = []
    for x in range(0, W + 8, 8):
        y = y_base + amp * math.sin((x / 165.0) + phase)
        pts.append((x, y))
    d.line(pts, fill=color, width=width)

wave(968, 16, CYAN + (26,), 26, phase=0.4)
wave(992, 13, CYAN + (40,), 18, phase=1.7)
wave(1012, 10, CYAN + (60,), 12, phase=3.1)

# ---------------------------------------------------------------- text block
TX = 118

# top badge pill
badge = "SIH 2026  ·  ISRO  ·  SPACE TECHNOLOGY"
f_badge = font(FONT_BOLD, 30)
bb = d.textbbox((0, 0), badge, font=f_badge)
bw, bh = bb[2] - bb[0], bb[3] - bb[1]
pad_x, pad_y = 30, 16
pill = [TX, 148, TX + bw + pad_x * 2, 148 + bh + pad_y * 2 + 6]
d.rounded_rectangle(pill, radius=(pill[3] - pill[1]) // 2, fill=CYAN + (255,))
d.text((TX + pad_x, 148 + pad_y - 2), badge, font=f_badge, fill=WHITE + (255,))

# ORCA — the dominant word
f_orca = font(FONT_BLACK, 336)
d.text((TX - 8, 208), "ORCA", font=f_orca, fill=NAVY + (255,))

# underline accent under ORCA
d.rounded_rectangle([TX + 6, 592, TX + 470, 606], radius=7, fill=CYAN + (255,))

# subtitle
f_sub = font(FONT_BOLD, 62)
d.text((TX + 2, 636), "Marine Ecosystem Reasoning", font=f_sub, fill=NAVY + (255,))
f_sub2 = font(FONT_REG, 50)
d.text((TX + 4, 722), "with Collaborative Agents", font=f_sub2, fill=NAVY_SOFT + (255,))

# stats row
stats = [("11", "LANGUAGES"), ("13", "AGENTS"), ("ZERO", "COST"), ("NO", "API KEYS")]
f_num = font(FONT_BLACK, 54)
f_lbl = font(FONT_BOLD, 25)
sx = TX + 4
sy = 838
for num, lbl in stats:
    d.text((sx, sy), num, font=f_num, fill=CYAN + (255,))
    nw = d.textbbox((0, 0), num, font=f_num)[2]
    d.text((sx, sy + 62), lbl, font=f_lbl, fill=NAVY_SOFT + (255,))
    lw = d.textbbox((0, 0), lbl, font=f_lbl)[2]
    sx += max(nw, lw) + 46

# ---------------------------------------------------------------- save
out = img.convert("RGB")
out.save("/Users/ashmitnimangre/Desktop/orca-marine-assistant/submission/thumbnail.png", "PNG", optimize=True)
print("wrote submission/thumbnail.png", out.size)
