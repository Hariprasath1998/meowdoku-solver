# Meowdoku Solver

Upload, drop or paste a Meowdoku screenshot and the solution appears. Everything runs in the browser.

**Open `index.html` in any browser.** It's a single self-contained file, with no server and no install.

## How it works
1. **Board detection**: finds long horizontal and vertical edges. The grid is the only thing that has both, so header bars and buttons are ignored.
2. **Grid size**: tries 4×4 to 16×16 and picks the size whose line positions best match the edges.
3. **Rooms**: samples each cell's dominant colour and clusters the cells into exactly N rooms.
4. **Solver**: backtracks row by row (one cat per row, column and room, no touching), with pruning. It counts up to 2 solutions, so it can warn you when the board was probably misread.
5. **Fixes**: drag the board box, change the grid size, or repaint cells by tapping.

## Files
- `index.html`: the built app (open this)
- `src/core.js`: detection, clustering and solver (also runs in Node)
- `src/app.html`: UI template. Run `python3 build.py` to rebuild into `dist/index.html`
- `test/gen.py`, `test/run.js`, `test/ui.py`: synthetic screenshot generator, accuracy test, browser smoke test
