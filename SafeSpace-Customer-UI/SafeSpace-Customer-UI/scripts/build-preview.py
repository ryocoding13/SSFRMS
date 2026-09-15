"""Create an offline, single-file preview from an already-built Vite dist folder.
Run: npm run build && python3 scripts/build-preview.py
"""
from pathlib import Path
import re, base64
root = Path(__file__).resolve().parents[1]
dist = root / 'dist'
page = (dist / 'index.html').read_text()
css_ref = re.search(r'<link[^>]+href="([^"]+\.css)"[^>]*>', page)
js_ref = re.search(r'<script[^>]+src="([^"]+\.js)"[^>]*></script>', page)
css_path = dist / css_ref.group(1).removeprefix('./')
css = css_path.read_text()
def font_data(match):
    relative = match.group(1).strip('"\'')
    if relative.startswith('data:'):
        return match.group(0)
    path = (css_path.parent / relative).resolve()
    encoded = base64.b64encode(path.read_bytes()).decode()
    mime = 'font/woff2' if path.suffix == '.woff2' else 'font/woff'
    return f'url("data:{mime};base64,{encoded}")'
css = re.sub(r'url\(([^)]+)\)', font_data, css)
js = (dist / js_ref.group(1).removeprefix('./')).read_text()
js = re.sub(r'</script', r'<\\/script', js, flags=re.I)
page = page.replace(css_ref.group(0), '<style>' + css + '</style>')
page = page.replace(js_ref.group(0), '')
page = page.replace('</body>', '<script type="module">' + js + '</script></body>')
licenses = []
for pkg in ['react', 'react-dom', '@fontsource/inter']:
    path = root / 'node_modules' / pkg / 'LICENSE'
    if path.exists():
        licenses.append(f'## {pkg}\n\n' + path.read_text())
if licenses:
    notice = '# Third-party licenses\n\n' + '\n\n'.join(licenses)
    (root / 'THIRD-PARTY-NOTICES.md').write_text(notice)
    page = page.replace('</body>', '<script type="text/plain" id="third-party-licenses">'+notice+'</script></body>')
output = root / 'SafeSpace-Customer-Preview.html'
output.write_text(page)
print(f'Created {output.name} ({output.stat().st_size:,} bytes)')
