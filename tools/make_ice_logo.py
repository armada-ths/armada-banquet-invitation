"""Render the Armada logo as a lit disc of real ice with the ship cut out.

Usage:
    python tools/make_ice_logo.py <logo.pdf> <Ice002 texture folder>

Inputs: the Armada logo PDF (green disc, white ship) and the unzipped
ambientCG Ice002 1K-JPG texture (CC0, https://ambientcg.com/view?id=Ice002).
Output: assets/armada-logo-ice.webp (RGBA), plus tools/ice-logo-preview.png.
Needs numpy, scipy, pillow and pymupdf.
"""
import os
import sys

import numpy as np
import pymupdf
from PIL import Image
from scipy import ndimage as ndi

PDF, TEX = sys.argv[1], sys.argv[2]
HERE = os.path.dirname(os.path.abspath(__file__))
OUT = os.path.join(HERE, "..", "assets", "armada-logo-ice.webp")
PREVIEW = os.path.join(HERE, "ice-logo-preview.png")

S = 900                 # working resolution
DISC = int(S * 0.86)    # logo diameter inside the canvas (room for shadow)
SHIP_SHIFT = (-0.017, -0.015)  # optical centring, fraction of disc diameter (x, y)
OUT_SIZE = 256

def smooth_noise(shape, scale, seed):
    r = np.random.default_rng(seed).standard_normal((shape[0] // scale + 3, shape[1] // scale + 3))
    img = Image.fromarray(((r - r.min()) / (np.ptp(r)) * 255).astype(np.uint8)).resize(shape[::-1], Image.BICUBIC)
    return np.asarray(img, np.float32) / 255 - 0.5


# ---------- shape: disc (slightly uneven edge) minus ship ----------
page = pymupdf.open(PDF)[0]
zoom = DISC / page.rect.width
pix = page.get_pixmap(matrix=pymupdf.Matrix(zoom, zoom))
logo = np.frombuffer(pix.samples, np.uint8).reshape(pix.height, pix.width, pix.n)[:, :, :3]
logo = np.asarray(Image.fromarray(logo).resize((DISC, DISC)), np.int16)
green = (logo[..., 1] > 150) & (logo[..., 0] < 120)
white = (logo.min(axis=2) > 200)
yy, xx = np.mgrid[:DISC, :DISC]
inside_circle = (xx - DISC / 2) ** 2 + (yy - DISC / 2) ** 2 < (DISC / 2 - 2) ** 2
ship_small = white & inside_circle

pad = (S - DISC) // 2
disc = np.zeros((S, S), bool)
disc[pad:pad + DISC, pad:pad + DISC] = green | ship_small
ship = np.zeros((S, S), bool)
ship[pad:pad + DISC, pad:pad + DISC] = ship_small
ship = np.roll(ship, (round(SHIP_SHIFT[1] * DISC), round(SHIP_SHIFT[0] * DISC)), axis=(0, 1))

# uneven outer edge
sd = ndi.distance_transform_edt(disc) - ndi.distance_transform_edt(~disc)
disc = (sd + smooth_noise((S, S), 60, 3) * 7) > 0
shape = disc & ~ship

# ---------- height map: rounded bevel + subtle surface relief ----------
d = ndi.distance_transform_edt(shape)
bevel = S * 0.055
t = np.clip(d / bevel, 0, 1)
h = np.sqrt(1 - (1 - t) ** 2)           # quarter-circle profile, like a melted edge
disp = np.asarray(Image.open(os.path.join(TEX, "Ice002_1K-JPG_Displacement.jpg")).convert("L").resize((S, S)), np.float32) / 255
h = h * bevel * 0.9 + (ndi.gaussian_filter(disp, 2) - 0.5) * 3 * t ** 2
h = ndi.gaussian_filter(h, 1.8)

gy, gx = np.gradient(h)
n = np.dstack([-gx, -gy, np.ones_like(h)])
n /= np.linalg.norm(n, axis=2, keepdims=True)

L = np.array([-0.55, -0.65, 0.55]); L /= np.linalg.norm(L)
V = np.array([0, 0, 1.0])
H = (L + V); H /= np.linalg.norm(H)
ndl = np.clip((n * L).sum(2), 0, 1)
ndh = np.clip((n * H).sum(2), 0, 1)
spec = ndh ** 90 * 2.0 + ndh ** 18 * 0.3
tilt = 1 - n[..., 2]                     # 0 on the flat top, ~1 on steep bevel

# ---------- ice texture, refracted through the bevel ----------
col = Image.open(os.path.join(TEX, "Ice002_1K-JPG_Color.jpg")).convert("L")
col = col.crop((0, 0, 700, 700)).resize((S, S), Image.BICUBIC)      # enlarge the cells a bit
tex = np.asarray(col, np.float32) / 255
tex = (tex - tex.min()) / np.ptp(tex)
refr = 40
gy_idx, gx_idx = np.mgrid[:S, :S]
ty = np.clip(gy_idx + n[..., 1] * refr, 0, S - 1)
tx = np.clip(gx_idx + n[..., 0] * refr, 0, S - 1)
tex = ndi.map_coordinates(tex, [ty, tx], order=1)

deep = np.array([28, 78, 140], np.float32)
mid = np.array([98, 160, 214], np.float32)
pale = np.array([222, 242, 255], np.float32)
k = np.clip(tex * 1.1, 0, 1)[..., None]
base = np.where(k < 0.5, deep + (mid - deep) * (k / 0.5), mid + (pale - mid) * ((k - 0.5) / 0.5))

# thicker ice at the bevel reads deeper blue; light from the top-left brightens facing slopes
shade = 0.78 + 0.35 * ndl - 0.25 * tilt
rgb = base * shade[..., None]
rgb = rgb * (1 - 0.35 * tilt[..., None]) + deep * 0.35 * tilt[..., None]
rgb = rgb + spec[..., None] * 255
# broad glossy sheen on the flat top, upper-left
sheen = np.exp(-(((gx_idx / S) - 0.33) ** 2 + ((gy_idx / S) - 0.28) ** 2) / 0.02) * (1 - tilt) * 0.28
rgb = rgb + sheen[..., None] * 255
# thin bright rim right at the edge (internal reflection)
rim = np.exp(-((d - 2.5) / 2.2) ** 2) * 0.55
rgb = rgb + rim[..., None] * np.array([230, 245, 255])
rgb = np.clip(rgb, 0, 255)

alpha = np.clip(0.82 + 0.15 * tilt + spec * 0.3, 0, 1) * shape
alpha = ndi.gaussian_filter(alpha.astype(np.float32), 0.7)   # anti-alias

# ---------- shadow on the paper: under the disc and inside the cut-out ----------
sh = ndi.gaussian_filter(shape.astype(np.float32), S * 0.012)
sh = np.roll(sh, (int(S * 0.012), int(S * 0.008)), axis=(0, 1)) * 0.38
sh_col = np.array([30, 60, 100], np.float32)
# bluish caustic: light focused through the ice onto the paper
ca = ndi.gaussian_filter(shape.astype(np.float32), S * 0.02)
ca = np.roll(ca, (int(S * 0.03), int(S * 0.025)), axis=(0, 1)) * 0.12

out_a = alpha + (sh + ca) * (1 - alpha)
under = (sh[..., None] * sh_col + ca[..., None] * np.array([120, 190, 245])) / np.maximum(sh + ca, 1e-6)[..., None]
out_rgb = (rgb * alpha[..., None] + under * ((sh + ca) * (1 - alpha))[..., None]) / np.maximum(out_a, 1e-6)[..., None]

img = Image.fromarray(np.dstack([np.clip(out_rgb, 0, 255), np.clip(out_a * 255, 0, 255)]).astype(np.uint8), "RGBA")
img = img.resize((OUT_SIZE, OUT_SIZE), Image.LANCZOS)
img.save(OUT, "WEBP", quality=90, alpha_quality=90, method=6)
print("saved", OUT, os.path.getsize(OUT))

# Preview on the card's paper colour, large and at display size.
paper = Image.new("RGBA", img.size, (248, 244, 234, 255))
prev = Image.alpha_composite(paper, img)
big = prev.resize((512, 512), Image.LANCZOS)
small = prev.resize((76, 76), Image.LANCZOS)
sheet = Image.new("RGBA", (620, 512), (248, 244, 234, 255))
sheet.paste(big, (0, 0))
sheet.paste(small, (530, 218))
sheet.save(PREVIEW)
