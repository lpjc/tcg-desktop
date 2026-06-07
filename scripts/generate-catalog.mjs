import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.join(__dirname, '..');
const assetsRoot = path.join(root, 'assets', 'sierrassets');

/** Read PNG dimensions from IHDR chunk (no native deps). */
function pngSize(filePath) {
  const buf = fs.readFileSync(filePath);
  if (buf.toString('ascii', 1, 4) !== 'PNG') return null;
  return { width: buf.readUInt32BE(16), height: buf.readUInt32BE(20) };
}

function scanFolder(folder, prefix, category) {
  const dir = path.join(assetsRoot, folder);
  if (!fs.existsSync(dir)) return [];

  return fs
    .readdirSync(dir)
    .filter((f) => f.endsWith('.png'))
    .map((file) => {
      const size = pngSize(path.join(dir, file));
      if (!size) return null;
      const sliceNum = file.match(/\d+/)?.[0] ?? '0';
      const id = `${prefix}_slice_${sliceNum}`;
      const footX = Math.floor(size.width / 2);
      const footY = size.height;
      const collisionH = Math.min(8, size.height);
      return {
        id,
        file: `sierrassets/${folder}/${file}`,
        name: `${category} ${sliceNum}`,
        category,
        width: size.width,
        height: size.height,
        footX,
        footY,
        collision: {
          x: Math.max(0, footX - 8),
          y: footY - collisionH,
          w: Math.min(16, size.width),
          h: collisionH,
        },
      };
    })
    .filter(Boolean);
}

const catalog = {
  version: 1,
  floorTiles: {
    convention: 'floors_slice_1',
    road: 'floors_slice_50',
    shop: 'floors_slice_30',
  },
  items: [
    ...scanFolder('furniture', 'furniture', 'furniture'),
    ...scanFolder('floors', 'floors', 'floor'),
    ...scanFolder('pets', 'pets', 'pet'),
  ],
};

const outPath = path.join(root, 'src', 'data', 'asset-catalog.json');
fs.writeFileSync(outPath, JSON.stringify(catalog, null, 2));
console.log(`Wrote ${catalog.items.length} catalog entries to ${outPath}`);
