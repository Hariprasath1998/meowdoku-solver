import sys
from playwright.sync_api import sync_playwright
img = sys.argv[1]; out = sys.argv[2]
with sync_playwright() as p:
    b = p.chromium.launch()
    pg = b.new_page(viewport={'width': int(sys.argv[3]) if len(sys.argv)>3 else 1200, 'height': 900})
    errs = []; pg.on('pageerror', lambda e: errs.append(str(e))); pg.on('console', lambda m: m.type=='error' and errs.append(m.text))
    pg.goto('file:///home/claude/meowdoku/dist/index.html')
    pg.set_input_files('#file', img)
    pg.wait_for_timeout(2500)
    print('status:', pg.inner_text('#status')); print('cats:', pg.locator('.cat').count()); print('errors:', errs)
    pg.screenshot(path=out, full_page=True)
    b.close()
