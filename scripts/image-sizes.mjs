// Rozměry zmenšenin fotek (assets/img/foto/sm/*.webp) pro atributy width/height v <img>.
// Spuštění po přidání nebo výměně fotky v repozitáři: npm run images
// (zapíše functions/_lib/image-sizes.json; npm run check hlídá, že je aktuální)
import { readdirSync, readFileSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

const DIR = fileURLToPath(new URL('../public/assets/img/foto/sm/', import.meta.url));
export const OUT = fileURLToPath(new URL('../functions/_lib/image-sizes.json', import.meta.url));

// Šířka a výška z hlavičky WebP (formáty VP8, VP8L a VP8X)
function webpSize(buf) {
  if (buf.toString('ascii', 0, 4) !== 'RIFF' || buf.toString('ascii', 8, 12) !== 'WEBP') throw new Error('není WebP');
  const chunk = buf.toString('ascii', 12, 16);
  if (chunk === 'VP8 ') return [buf.readUInt16LE(26) & 0x3fff, buf.readUInt16LE(28) & 0x3fff];
  if (chunk === 'VP8L') {
    const b = buf.readUInt32LE(21);
    return [(b & 0x3fff) + 1, ((b >> 14) & 0x3fff) + 1];
  }
  if (chunk === 'VP8X') return [buf.readUIntLE(24, 3) + 1, buf.readUIntLE(27, 3) + 1];
  throw new Error(`neznámý typ ${chunk}`);
}

export function imageSizes() {
  const rows = readdirSync(DIR)
    .filter((f) => f.endsWith('.webp'))
    .sort()
    .map((file) => `  ${JSON.stringify(file)}: ${JSON.stringify(webpSize(readFileSync(DIR + file)))}`);
  return `{\n${rows.join(',\n')}\n}\n`;
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  writeFileSync(OUT, imageSizes());
  console.log('Zapsáno:', OUT);
}
