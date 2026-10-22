import { readdirSync, readFileSync } from 'node:fs';
import { dirname, join, basename, relative } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..', 'src');
const allowed = new Set(['main.jsx', 'app', 'features', 'shared', 'assets']);
const errors = [];
for (const entry of readdirSync(root)) {
  if (!allowed.has(entry)) errors.push(`Unexpected src entry: ${entry}`);
}
function inspect(directory) {
  for (const entry of readdirSync(directory, { withFileTypes: true })) {
    const file = join(directory, entry.name);
    const name = relative(root, file);
    if (entry.isDirectory()) {
      if (!/^[a-z][a-z0-9]*(?:-[a-z0-9]+)*$/.test(entry.name)) errors.push(`Use kebab-case directory: ${name}`);
      inspect(file);
    } else if (entry.name.endsWith('.jsx')) {
      if (entry.name !== 'main.jsx' && !/^[A-Z][A-Za-z0-9]*\.jsx$/.test(entry.name)) errors.push(`Use PascalCase JSX filename: ${name}`);
      if (entry.name.endsWith('Page.jsx')) {
        const source = readFileSync(file, 'utf8');
        const component = basename(file, '.jsx');
        if (!new RegExp(`export (?:default )?function ${component}\\b`).test(source)) errors.push(`Export a page component named ${component}: ${name}`);
        const pages = [...source.matchAll(/export (?:default )?function (\w+Page)\b/g)];
        if (pages.length !== 1) errors.push(`Keep one page per file: ${name}`);
      }
    } else if (entry.name.endsWith('.js') && !/^[a-z][A-Za-z0-9]*\.js$/.test(entry.name)) {
      errors.push(`Use camelCase JS filename: ${name}`);
    }
  }
}
inspect(root);
if (errors.length) {
  console.error(errors.join('\n'));
  process.exitCode = 1;
} else console.log('Frontend structure and page naming: PASS');
