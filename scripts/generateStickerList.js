const fs = require('fs');
const path = require('path');

const stickerDir = path.join(__dirname, '../public/learnwithleon');
const stickers = fs.readdirSync(stickerDir)
  .filter(file => file.endsWith('.png'));

const output = `export const STICKER_OPTIONS = ${JSON.stringify(stickers, null, 2)} as const;`;

fs.writeFileSync(
  path.join(__dirname, '../src/config/stickers.ts'),
  output
); 