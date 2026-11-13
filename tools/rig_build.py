"""Tách ảnh con giáp (đã tách nền) thành các lớp bộ phận + rig.json cho web.
Chạy: python3 tools/rig_build.py <thư mục chứa {ma}_orig.png và {ma}_cut.png> public/rig
"""
import json, sys, os
import cv2, numpy as np
from PIL import Image
sys.path.insert(0, os.path.dirname(__file__))
from rigs import RIGS

SRC, OUT = sys.argv[1], sys.argv[2]
SCALE = 0.55

def poly_mask(pts, shape):
    m = np.zeros(shape, np.uint8); cv2.fillPoly(m, [np.array(pts, np.int32)], 255); return m

def half(clear, shape):
    H, W = shape; yy, xx = np.mgrid[0:H, 0:W]
    if clear == "all": return np.ones(shape, bool)
    (k, v), = clear.items()
    return {"y_gt": yy > v, "y_lt": yy < v, "x_gt": xx > v, "x_lt": xx < v}[k]

def save(arr, path, box):
    x0, y0, x1, y1 = box
    im = Image.fromarray(arr[y0:y1, x0:x1])
    im = im.resize((max(1, round((x1 - x0) * SCALE)), max(1, round((y1 - y0) * SCALE))), Image.LANCZOS)
    im.save(path, "WEBP", quality=88)

for code, parts in RIGS.items():
    o = np.array(Image.open(f"{SRC}/{code}_orig.png").convert("RGB"))
    A = np.array(Image.open(f"{SRC}/{code}_cut.png"))[:, :, 3]
    H, W = A.shape
    os.makedirs(f"{OUT}/{code}", exist_ok=True)
    base_a = A.copy().astype(np.float32)
    fill = np.zeros((H, W), np.uint8)
    layers = []
    for p in parts:
        m = cv2.GaussianBlur(poly_mask(p["poly"], (H, W)), (5, 5), 0).astype(np.float32) / 255
        al = (A * m).astype(np.uint8)
        ys, xs = np.where(al > 8)
        box = (int(xs.min()), int(ys.min()), int(xs.max()) + 1, int(ys.max()) + 1)
        save(np.dstack([o, al]), f"{OUT}/{code}/{p['name']}.webp", box)
        if p.get("clear"):
            cm = half(p["clear"], (H, W)) & (poly_mask(p["poly"], (H, W)) > 0)
            cm = cv2.GaussianBlur(cm.astype(np.float32), (7, 7), 0)
            base_a *= (1 - cm)
        if p.get("fill"):
            fill |= cv2.dilate(poly_mask(p["poly"], (H, W)), np.ones((11, 11), np.uint8))
        x0, y0, x1, y1 = box
        px, py = p["pivot"]
        layers.append(dict(name=p["name"], role=p["role"], phase=p.get("phase", "A"), z=p["z"],
                           x=x0 / W, y=y0 / H, w=(x1 - x0) / W, h=(y1 - y0) / H,
                           ox=(px - x0) / (x1 - x0), oy=(py - y0) / (y1 - y0)))
    base = o.copy()
    if fill.any():
        inside = (A > 200) & (fill == 0)
        src = o.copy(); src[~(A > 120)] = o[inside].mean(axis=0)
        inp = cv2.inpaint(src, fill, 11, cv2.INPAINT_TELEA)
        inp = cv2.GaussianBlur(inp, (21, 21), 0)
        base[fill > 0] = inp[fill > 0]
    ba = np.clip(base_a, 0, 255).astype(np.uint8)
    ys, xs = np.where(ba > 8)
    save(np.dstack([base, ba]), f"{OUT}/{code}/body.webp", (0, 0, W, H))
    order = [l for l in layers if l["z"] == "back"] + [dict(name="body", role="body", phase="A", z="mid", x=0, y=0, w=1, h=1, ox=.5, oy=1)] + [l for l in layers if l["z"] == "front"]
    json.dump({"ratio": W / H, "layers": order}, open(f"{OUT}/{code}/rig.json", "w"), indent=1)
    print(code, len(order), "lớp")

# Gộp tất cả rig.json thành src/lib/rig-data.json (toạ độ chuyển sang %).
if __name__ == "__main__":
    out = {}
    for code in sorted(os.listdir(OUT)):
        f = f"{OUT}/{code}/rig.json"
        if not os.path.exists(f): continue
        r = json.load(open(f))
        for l in r["layers"]:
            for k in ("x", "y", "w", "h", "ox", "oy"):
                if l[k] <= 1.0001: l[k] = round(l[k] * 100, 2)
        out[code] = r
    json.dump(out, open(os.path.join(os.path.dirname(__file__), "..", "src/lib/rig-data.json"), "w"), separators=(",", ":"))
