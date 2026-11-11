import random, json, sys, struct
from PIL import Image, ImageDraw, ImageFont

PASTELS = [(255,183,178),(255,218,158),(253,253,150),(178,226,178),(170,210,240),(204,180,240),
           (255,200,230),(190,235,230),(230,200,170),(210,210,210),(255,160,120),(150,200,150),
           (180,180,255),(240,230,140),(220,170,200),(160,220,255)]

def queens(n, rng):
    while True:
        cols = list(range(n)); rng.shuffle(cols)
        def bt(r, place, used):
            if r == n: return place
            opts = [c for c in range(n) if c not in used and (r == 0 or abs(c - place[-1]) > 1)]
            rng.shuffle(opts)
            for c in opts:
                res = bt(r+1, place+[c], used|{c})
                if res: return res
            return None
        p = bt(0, [], set())
        if p: return p

def regions_from(place, n, rng):
    reg = [[-1]*n for _ in range(n)]
    frontier = []
    for r, c in enumerate(place):
        reg[r][c] = r; frontier.append((r, c))
    while frontier:
        i = rng.randrange(len(frontier)); r, c = frontier[i]
        nb = [(r+dr, c+dc) for dr, dc in ((1,0),(-1,0),(0,1),(0,-1)) if 0 <= r+dr < n and 0 <= c+dc < n and reg[r+dr][c+dc] < 0]
        if not nb: frontier.pop(i); continue
        rr, cc = rng.choice(nb); reg[rr][cc] = reg[r][c]; frontier.append((rr, cc))
    return reg

def render(n, reg, rng, style):
    W, H = 1080, 2340
    bg = (250, 244, 232) if style != 'dark' else (40, 36, 48)
    im = Image.new('RGB', (W, H), bg); d = ImageDraw.Draw(im)
    d.rectangle([60, 120, 1020, 260], fill=(255, 200, 120))  # header bar
    d.text((100, 300), "Meowdoku  Level 42   <3 <3 <3", fill=(80, 60, 60))
    side = rng.randint(880, 1000); x0 = (W - side)//2; y0 = rng.randint(500, 700)
    cols = rng.sample(PASTELS, n)
    cell = side / n
    for r in range(n):
        for c in range(n):
            d.rectangle([x0 + c*cell, y0 + r*cell, x0 + (c+1)*cell, y0 + (r+1)*cell], fill=cols[reg[r][c]])
    thin = (120, 110, 110) if style != 'light' else (215, 210, 205)
    for k in range(1, n):
        d.line([x0 + k*cell, y0, x0 + k*cell, y0 + side], fill=thin, width=2)
        d.line([x0, y0 + k*cell, x0 + side, y0 + k*cell], fill=thin, width=2)
    for r in range(n):
        for c in range(n):
            X, Y = x0 + c*cell, y0 + r*cell
            if c+1 < n and reg[r][c] != reg[r][c+1]: d.line([X+cell, Y, X+cell, Y+cell], fill=(30,30,30), width=6)
            if r+1 < n and reg[r][c] != reg[r+1][c]: d.line([X, Y+cell, X+cell, Y+cell], fill=(30,30,30), width=6)
    d.rectangle([x0, y0, x0+side, y0+side], outline=(30,30,30), width=8)
    d.rounded_rectangle([140, y0+side+150, 940, y0+side+290], radius=40, fill=(120, 190, 120))  # button
    d.text((450, y0+side+210), "Hint", fill=(255,255,255))
    return im

def main(seed, n, style, out):
    rng = random.Random(seed)
    place = queens(n, rng); reg = regions_from(place, n, rng)
    im = render(n, reg, rng, style)
    if style == 'jpeg':
        im = im.resize((720, 1560), Image.BILINEAR)
    im.save(out + '.png')
    w, h = im.size
    with open(out + '.rgba', 'wb') as f:
        f.write(struct.pack('<II', w, h)); f.write(im.convert('RGBA').tobytes())
    json.dump({'n': n, 'regions': [v for row in reg for v in row], 'place': place}, open(out + '.json', 'w'))

if __name__ == '__main__':
    main(int(sys.argv[1]), int(sys.argv[2]), sys.argv[3], sys.argv[4])
