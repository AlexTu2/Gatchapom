import { storage, databases, ID, Permission, Role } from '../src/lib/appwrite';
import { STICKERS_BUCKET_ID, DATABASE_ID, STICKER_METADATA_COLLECTION_ID } from '../src/lib/uploadStickers';
import fs from 'fs';
import path from 'path';
import type { StickerCollection } from '../src/config/stickerSounds';

// Function to get all image files from a directory
function getImageFiles(directory: string): string[] {
  return fs.readdirSync(directory)
    .filter(file => {
      const ext = path.extname(file).toLowerCase();
      return ext === '.png' || ext === '.gif' || ext === '.jpg' || ext === '.jpeg';
    })
    .map(file => path.join(directory, file));
}

async function uploadStickersWithMetadata(
  directory: string, 
  collection: StickerCollection
) {
  console.log(`Starting upload from ${directory} to collection ${collection}`);
  const imageFiles = getImageFiles(directory);
  
  let successCount = 0;
  let failCount = 0;

  for (const filePath of imageFiles) {
    try {
      const fileName = path.basename(filePath);
      const fileNameWithoutExt = path.parse(fileName).name;
      const fileId = fileNameWithoutExt; // Use filename without extension as ID
      
      // Read the file
      const fileBuffer = fs.readFileSync(filePath);
      const file = new File([fileBuffer], fileName, { 
        type: `image/${path.extname(fileName).slice(1)}` 
      });

      console.log(`Uploading ${fileName}...`);

      // Upload to storage with specific ID
      await storage.createFile(
        STICKERS_BUCKET_ID,
        fileId,
        file,
        [
          Permission.read(Role.any()),
          Permission.write(Role.users()),
          Permission.delete(Role.users())
        ]
      );

      // Create metadata entry
      await databases.createDocument(
        DATABASE_ID,
        STICKER_METADATA_COLLECTION_ID,
        ID.unique(),
        {
          fileId,
          fileName,
          collection
        },
        [
          Permission.read(Role.any()),
          Permission.write(Role.users()),
          Permission.delete(Role.users())
        ]
      );

      console.log(`✅ Successfully uploaded ${fileName}`);
      successCount++;
    } catch (error) {
      console.error(`❌ Failed to upload ${filePath}:`, error);
      failCount++;
    }
  }

  console.log(`
Upload Summary:
--------------
Successfully uploaded: ${successCount}
Failed: ${failCount}
Total files: ${imageFiles.length}
  `);
}

// Example usage:
// You can call this with different directories and collections
async function main() {
  const args = process.argv.slice(2);
  const directory = args[0];
  const collection = args[1] as StickerCollection;

  if (!directory || !collection) {
    console.error(`
Usage: ts-node uploadStickersWithMetadata.ts <directory> <collection>

Example: 
  ts-node uploadStickersWithMetadata.ts ./discord-stickers 100DevsDiscord
  ts-node uploadStickersWithMetadata.ts ./twitch-stickers 100DevsTwitch
    `);
    process.exit(1);
  }

  if (!fs.existsSync(directory)) {
    console.error(`Directory ${directory} does not exist`);
    process.exit(1);
  }

  if (!['100DevsTwitch', '100DevsDiscord'].includes(collection)) {
    console.error(`Invalid collection: ${collection}. Must be either '100DevsTwitch' or '100DevsDiscord'`);
    process.exit(1);
  }

  await uploadStickersWithMetadata(directory, collection);
}

main().catch(console.error); 