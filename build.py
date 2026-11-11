import pathlib
root = pathlib.Path(__file__).parent
core = (root / 'src/core.js').read_text().replace("if (typeof module !== 'undefined') module.exports = MeowCore;", '')
html = (root / 'src/app.html').read_text().replace('/*__CORE__*/', core)
(root / 'dist').mkdir(exist_ok=True)
(root / 'dist/index.html').write_text(html)
print('built', len(html), 'bytes')
