# Generates the app icon, Android adaptive icons, splash image and favicon (specs.md §9:
# two ivory dice on walnut showing 5 and 6, no text). Run: python scripts/make_icons.py assets
import sys
from PIL import Image, ImageDraw, ImageFilter
OUT = sys.argv[1]
S = 4  # supersampling

PIPS = {5: [(27,27),(73,27),(50,50),(27,73),(73,73)], 6: [(29,25),(71,25),(29,50),(71,50),(29,75),(71,75)]}

def lerp(a, b, t): return tuple(int(a[i] + (b[i]-a[i]) * t) for i in range(len(a)))

def die(size, value, mono=False):
    """One die as RGBA, `size` px square, drawn at S× and downsampled."""
    n = size * S
    img = Image.new('RGBA', (n, int(n*1.1)), (0,0,0,0))
    d = ImageDraw.Draw(img)
    r = int(n*0.24)
    if mono:
        d.rounded_rectangle([0,0,n-1,n-1], r, fill=(255,255,255,255))
    else:
        d.rounded_rectangle([0,int(n*0.06),n-1,int(n*1.06)-1], r, fill=(205,187,160,255))  # edge lip
        face = Image.new('RGBA', (n, n), (0,0,0,0))
        grad = Image.new('RGBA', (n, n))
        gd = ImageDraw.Draw(grad)
        for y in range(n):
            gd.line([(0,y),(n,y)], fill=lerp((255,255,253,255),(232,220,200,255), y/n))
        mask = Image.new('L', (n, n), 0)
        ImageDraw.Draw(mask).rounded_rectangle([0,0,n-1,n-1], r, fill=255)
        face.paste(grad, (0,0), mask)
        img.alpha_composite(face)
    for (x, y) in PIPS[value]:
        cx, cy, pr = x/100*n, y/100*n, 0.1*n
        if mono:
            d.ellipse([cx-pr,cy-pr,cx+pr,cy+pr], fill=(0,0,0,0))
        else:
            d.ellipse([cx-pr,cy-pr+0.012*n,cx+pr,cy+pr+0.012*n], fill=(255,255,255,230))
            d.ellipse([cx-pr,cy-pr,cx+pr,cy+pr], fill=(42,26,16,255))
            d.ellipse([cx-pr*0.55,cy-pr*0.7,cx-pr*0.05,cy-pr*0.2], fill=(90,62,43,255))
    return img.resize((size, int(size*1.1)), Image.LANCZOS)

def dice_layer(canvas, scale, mono=False, shadow=True):
    """Two dice (5 and 6), tilted, centred; scale = fraction of the canvas they span."""
    layer = Image.new('RGBA', (canvas, canvas), (0,0,0,0))
    s = int(canvas * scale * 0.5)
    a = die(s, 5, mono).rotate(14, resample=Image.BICUBIC, expand=True)
    b = die(s, 6, mono).rotate(-10, resample=Image.BICUBIC, expand=True)
    pa = (int(canvas*0.5 - a.width*0.95), int(canvas*0.5 - a.height*0.62))
    pb = (int(canvas*0.5 - b.width*0.08), int(canvas*0.5 - b.height*0.38))
    if shadow and not mono:
        sh = Image.new('RGBA', (canvas, canvas), (0,0,0,0))
        for img, p in ((a, pa), (b, pb)):
            blk = Image.new('RGBA', img.size, (20,8,2,150))
            sh.paste(blk, (p[0]+int(canvas*0.012), p[1]+int(canvas*0.03)), img)
        layer.alpha_composite(sh.filter(ImageFilter.GaussianBlur(canvas*0.02)))
    layer.alpha_composite(a, pa)
    layer.alpha_composite(b, pb)
    return layer

def walnut(canvas):
    bg = Image.new('RGBA', (canvas, canvas))
    d = ImageDraw.Draw(bg)
    for y in range(canvas):
        d.line([(0,y),(canvas,y)], fill=lerp((180,100,47,255),(92,45,20,255), y/canvas))
    glow = Image.new('RGBA', (canvas, canvas), (0,0,0,0))
    ImageDraw.Draw(glow).ellipse([-canvas*0.2,-canvas*0.5,canvas*1.2,canvas*0.55], fill=(244,207,115,60))
    bg.alpha_composite(glow.filter(ImageFilter.GaussianBlur(canvas*0.08)))
    return bg

C = 1024
icon = walnut(C); icon.alpha_composite(dice_layer(C, 0.78)); icon.convert('RGB').save(f'{OUT}/icon.png')
walnut(C).convert('RGB').save(f'{OUT}/android-icon-background.png')
dice_layer(C, 0.56).save(f'{OUT}/android-icon-foreground.png')
dice_layer(C, 0.56, mono=True, shadow=False).save(f'{OUT}/android-icon-monochrome.png')
dice_layer(C, 0.9).save(f'{OUT}/splash-icon.png')
fav = walnut(192); fav.alpha_composite(dice_layer(192, 0.8)); fav.resize((48,48), Image.LANCZOS).save(f'{OUT}/favicon.png')
print('ok')
