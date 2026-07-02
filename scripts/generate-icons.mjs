import { Resvg } from '@resvg/resvg-js';
import { readFileSync, writeFileSync, mkdirSync } from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const dir = path.dirname(fileURLToPath(import.meta.url));
const publicDir = path.join(dir, '..', 'public');
mkdirSync(publicDir, { recursive: true });

const iconSvg = readFileSync(path.join(dir, 'icon.svg'), 'utf8');
const maskableSvg = readFileSync(path.join(dir, 'icon-maskable.svg'), 'utf8');
const splashSvg = readFileSync(path.join(dir, 'splash.svg'), 'utf8');
const iconBgSvg = readFileSync(path.join(dir, 'icon-background.svg'), 'utf8');

function render(svg, size, outDir, outFile) {
  const resvg = new Resvg(svg, { fitTo: { mode: 'width', value: size } });
  const png = resvg.render().asPng();
  mkdirSync(outDir, { recursive: true });
  writeFileSync(path.join(outDir, outFile), png);
  console.log(`wrote ${path.join(path.basename(outDir), outFile)} (${size}x${size})`);
}

render(iconSvg, 512, publicDir, 'icon-512.png');
render(iconSvg, 192, publicDir, 'icon-192.png');
render(iconSvg, 180, publicDir, 'apple-touch-icon.png');
render(iconSvg, 32, publicDir, 'favicon-32.png');
render(maskableSvg, 512, publicDir, 'icon-maskable-512.png');

// Source assets for @capacitor/assets (native icon + splash generation)
const capacitorAssetsDir = path.join(dir, '..', 'assets');
render(iconSvg, 1024, capacitorAssetsDir, 'icon.png');
render(maskableSvg, 1024, capacitorAssetsDir, 'icon-foreground.png');
render(iconBgSvg, 1024, capacitorAssetsDir, 'icon-background.png');
render(splashSvg, 2732, capacitorAssetsDir, 'splash.png');
render(splashSvg, 2732, capacitorAssetsDir, 'splash-dark.png');

console.log('done');
