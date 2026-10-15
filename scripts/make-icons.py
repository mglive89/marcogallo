# Icone e schermata di avvio dell'app da resources/icon.png (Pillow).
from PIL import Image
import glob, os, json
R = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
icon = Image.open(os.path.join(R, "resources/icon.png")).convert("RGBA")
A = os.path.join(R, "android/app/src/main/res")
for d, px in {"mdpi": 48, "hdpi": 72, "xhdpi": 96, "xxhdpi": 144, "xxxhdpi": 192}.items():
    ic = icon.resize((px, px), Image.LANCZOS)
    ic.save(f"{A}/mipmap-{d}/ic_launcher.png")
    m = Image.new("L", (px * 4, px * 4), 0)
    from PIL import ImageDraw
    ImageDraw.Draw(m).ellipse((0, 0, px * 4 - 1, px * 4 - 1), fill=255)
    r = Image.new("RGBA", (px, px), (0, 0, 0, 0)); r.paste(ic, (0, 0), m.resize((px, px), Image.LANCZOS)); r.save(f"{A}/mipmap-{d}/ic_launcher_round.png")
    fg = int(px * 108 / 48); inner = int(fg * 0.70)
    f = Image.new("RGBA", (fg, fg), (0, 0, 0, 0)); f.paste(icon.resize((inner, inner), Image.LANCZOS), ((fg - inner) // 2, (fg - inner) // 2))
    f.save(f"{A}/mipmap-{d}/ic_launcher_foreground.png")
open(f"{A}/values/ic_launcher_background.xml", "w").write('<?xml version="1.0" encoding="utf-8"?>\n<resources>\n    <color name="ic_launcher_background">#1C1D21</color>\n</resources>\n')
BG = (20, 29, 61, 255)
for p in glob.glob(f"{A}/drawable*/splash.png"):
    w, h = Image.open(p).size
    s = Image.new("RGBA", (w, h), BG); k = int(min(w, h) * 0.42)
    s.paste(icon.resize((k, k), Image.LANCZOS), ((w - k) // 2, (h - k) // 2), icon.resize((k, k), Image.LANCZOS)); s.convert("RGB").save(p)
I = os.path.join(R, "ios/App/App/Assets.xcassets")
for p in glob.glob(f"{I}/AppIcon.appiconset/*.png"):
    w, h = Image.open(p).size; icon.resize((w, h), Image.LANCZOS).convert("RGB").save(p)
for p in glob.glob(f"{I}/Splash.imageset/*.png"):
    w, h = Image.open(p).size
    s = Image.new("RGBA", (w, h), BG); k = int(min(w, h) * 0.30)
    s.paste(icon.resize((k, k), Image.LANCZOS), ((w - k) // 2, (h - k) // 2), icon.resize((k, k), Image.LANCZOS)); s.convert("RGB").save(p)
print("icone pronte")
