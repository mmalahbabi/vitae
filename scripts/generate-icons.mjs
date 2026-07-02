import { Resvg } from '@resvg/resvg-js';
import { readFileSync, writeFileSync, mkdirSync } from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const dir = path.dirname(fileURLToPath(import.meta.url));
const publicDir = path.join(dir, '..', 'public');
mkdirSync(publicDir, { recursive: true });

const iconSvg = readFileSync(path.join(dir, 'icon.svg'), 'utf8');
const maskableSvg = readFileSync(path.join(dir, 'icon-maskable.svg'), 'utf8');

function render(svg, size, outFile) {
  const resvg = new Resvg(svg, { fitTo: { mode: 'width', value: size } });
  const png = resvg.render().asPng();
  writeFileSync(path.join(publicDir, outFile), png);
  console.log(`wrote ${outFile} (${size}x${size})`);
}

render(iconSvg, 512, 'icon-512.png');
render(iconSvg, 192, 'icon-192.png');
render(iconSvg, 180, 'apple-touch-icon.png');
render(iconSvg, 32, 'favicon-32.png');
render(maskableSvg, 512, 'icon-maskable-512.png');

console.log('done');
