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

/** Free pack art is ~4× Sierra furniture; scale down to match the 16px grid. */
const FREE_FURNITURE_SCALE = 0.25;

function catalogEntry({ id, file, name, category, size, scale = 1 }) {
  const width = Math.round(size.width * scale);
  const height = Math.round(size.height * scale);
  const footX = Math.floor(width / 2);
  const footY = height;
  const collisionH = Math.min(8, height);
  return {
    id,
    file,
    name,
    category,
    ...(scale !== 1 ? { scale } : {}),
    width,
    height,
    footX,
    footY,
    collision: {
      x: Math.max(0, footX - 8),
      y: footY - collisionH,
      w: Math.min(16, width),
      h: collisionH,
    },
  };
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
      return catalogEntry({
        id: `${prefix}_slice_${sliceNum}`,
        file: `sierrassets/${folder}/${file}`,
        name: `${category} ${sliceNum}`,
        category,
        size,
      });
    })
    .filter(Boolean);
}

function scanFreeFurniture() {
  const dir = path.join(root, 'assets', 'free-furniture-sprites');
  if (!fs.existsSync(dir)) return [];

  return fs
    .readdirSync(dir)
    .filter((f) => f.endsWith('.png'))
    .map((file) => {
      const size = pngSize(path.join(dir, file));
      if (!size) return null;
      const slug = file.replace(/\.png$/i, '').replace(/-/g, '_');
      return catalogEntry({
        id: `free_furniture_${slug}`,
        file: `free-furniture-sprites/${file}`,
        name: file.replace(/\.png$/i, '').replace(/-/g, ' '),
        // Own category so the large free pack gets a dedicated editor tab
        // instead of being buried behind the Sierra furniture list.
        category: 'free',
        size,
        scale: FREE_FURNITURE_SCALE,
      });
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
    ...scanFreeFurniture(),
    ...scanFolder('floors', 'floors', 'floor'),
    ...scanFolder('pets', 'pets', 'pet'),
  ],
};

const outPath = path.join(root, 'src', 'data', 'asset-catalog.json');
fs.writeFileSync(outPath, JSON.stringify(catalog, null, 2));
console.log(`Wrote ${catalog.items.length} catalog entries to ${outPath}`);
