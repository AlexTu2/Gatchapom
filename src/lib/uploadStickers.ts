import { storage, databases } from './appwrite';
import { ID, Permission, Role } from 'appwrite';
import { type StickerMetadata } from './types/sticker';

// Add database and collection IDs
export const STICKERS_BUCKET_ID = 'stickers';
export const DATABASE_ID = 'idea-tracker'; // Replace with your database ID
export const STICKER_METADATA_COLLECTION_ID = 'sticker_metadata'; // Replace with your collection ID

const STICKER_PATHS = [
    '/secret/test/4ball.png'
];

// You might want to define which stickers go in which collection
const STICKER_COLLECTION_MAP: Record<string, StickerMetadata['collection']> = {
  '4ball.png': '100DevsDiscord',
  'learnw1Wink.png': '100DevsTwitch',
  'learnw1First.png': '100DevsTwitch',
  // ... add mappings for all your stickers
};

export async function uploadStickers() {
  console.log('Starting sticker upload...');
  let successCount = 0;
  let failCount = 0;

  for (const path of STICKER_PATHS) {
    try {
      // Fetch the sticker file
      const response = await fetch(path);
      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }
      const blob = await response.blob();
      
      // Create a File object from the blob
      const filename = path.split('/').pop()!;
      const file = new File([blob], filename, { type: 'image/png' });
      
      // Upload to Appwrite stickers bucket
      const fileUpload = await storage.createFile(
        STICKERS_BUCKET_ID,
        ID.unique(),
        file,
        [
          Permission.read(Role.any()),
          Permission.write(Role.users()),
          Permission.delete(Role.users())
        ]
      );
      
      // Create metadata entry in database
      await databases.createDocument(
        DATABASE_ID,
        STICKER_METADATA_COLLECTION_ID,
        ID.unique(),
        {
          fileId: fileUpload.$id,
          fileName: filename,
          collection: STICKER_COLLECTION_MAP[filename] || '100DevsTwitch'
        }
      );
      
      console.log(`[SUCCESS] Uploaded ${filename}`);
      successCount++;
    } catch (error) {
      console.error(`[ERROR] Failed to upload ${path}:`, error);
      failCount++;
    }
  }

  console.log(`
Upload complete!
Successfully uploaded: ${successCount}
Failed: ${failCount}
Total files: ${STICKER_PATHS.length}
  `);
}
