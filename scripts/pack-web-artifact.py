"""Packs `npx expo export -p web` output into a Claude Artifact: page fragment + files.

Usage: python scripts/pack-web-artifact.py <export dir> <out dir>

The bundle refers to its chunks and assets by absolute paths ("/_expo/…", "/assets/…").
The artifact may be served from a sub-path, so those become window.__DDB + "…", where
__DDB is the page's own folder, captured before the app moves the URL to "/".
"""
import json, re, shutil, sys
from pathlib import Path

src, out = Path(sys.argv[1]), Path(sys.argv[2])
if out.exists():
    shutil.rmtree(out)
shutil.copytree(src, out)
(out / 'index.html').unlink()
(out / 'metadata.json').unlink(missing_ok=True)

# The artifact service reserves names starting with "_": move the bundles to js/ and
# drop leading underscores from their names.
old_dir = out / '_expo/static/js/web'
renames = {f.name: f.name.lstrip('_') for f in old_dir.glob('*.js')}
(out / 'js').mkdir()
for f in old_dir.glob('*.js'):
    s = f.read_text(encoding='utf-8')
    s = s.replace('"/_expo/static/js/web/', 'window.__DDB+"js/').replace('"/assets/', 'window.__DDB+"assets/')
    for a, b in renames.items():
        s = s.replace('js/' + a, 'js/' + b)
    (out / 'js' / renames[f.name]).write_text(s, encoding='utf-8', newline='')
shutil.rmtree(out / '_expo')

html = (src / 'index.html').read_text(encoding='utf-8')
scripts = ['js/' + renames[p.rsplit('/', 1)[1]] for p in re.findall(r'<script src="/([^"]+)"', html)]

page = f"""<title>Dice Den</title>
<meta name="theme-color" content="#0E2519">
<style>
  :root {{ --bg: #F4EFE6; }}
  @media (prefers-color-scheme: dark) {{ :root:not([data-theme="light"]) {{ --bg: #14100C; color-scheme: dark; }} }}
  :root[data-theme="dark"] {{ --bg: #14100C; color-scheme: dark; }}
  html, body {{ height: 100%; }}
  body {{ overflow: hidden; background: var(--bg); }}
  #root {{ display: flex; height: 100%; flex: 1; }}
</style>
<noscript>Dice Den needs JavaScript to run.</noscript>
<div id="root"></div>
<script>
  (function () {{
    window.__DDB = new URL('.', location.href).href;
    // The app's router reads the address: start it on the home screen.
    try {{ history.replaceState(null, '', '/'); }} catch (e) {{}}
    {json.dumps(scripts)}.forEach(function (p) {{
      var s = document.createElement('script');
      s.src = window.__DDB + p;
      s.async = false;
      document.body.appendChild(s);
    }});
  }})();
</script>
"""
(out / 'dice-den.html').write_text(page, encoding='utf-8', newline='')

files = sorted(p.relative_to(out).as_posix() for p in out.rglob('*') if p.is_file() and p.name != 'dice-den.html')
(out.parent / 'artifact-files.json').write_text(json.dumps({k: k for k in files}, indent=1), encoding='utf-8')
print(len(files), 'files;', sum((out / k).stat().st_size for k in files) // 1024, 'KB')
print(sorted({Path(k).suffix for k in files}))
