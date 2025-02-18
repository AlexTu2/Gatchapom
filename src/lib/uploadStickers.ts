import { storage, databases } from './appwrite';
import { ID, Permission, Role } from 'appwrite';
import { STICKER_SOUND_MAP } from '../config/stickerSounds';

// Constants
export const STICKERS_BUCKET_ID = 'stickers';
export const DATABASE_ID = 'idea-tracker';
export const STICKER_METADATA_COLLECTION_ID = 'sticker_metadata';

export async function uploadStickers(files: File[]) {
  console.log('Received files in uploadStickers:', files); // Debug log
  
  // Input validation with more detailed error
  if (!files) {
    throw new Error('Files parameter is undefined');
  }
  
  if (!Array.isArray(files)) {
    throw new Error(`Expected array of files, got ${typeof files}`);
  }
  
  if (files.length === 0) {
    throw new Error('No files provided (empty array)');
  }

  console.log('Starting sticker upload...');
  let successCount = 0;
  let failCount = 0;

  // Filter for PNG files
  const pngFiles = files.filter(file => file.name.toLowerCase().endsWith('.png'));
  console.log(`Found ${pngFiles.length} PNG files`);

  for (const file of pngFiles) {
    try {
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
      
      // Create metadata entry in database with explicit null for soundFileId
      await databases.createDocument(
        DATABASE_ID,
        STICKER_METADATA_COLLECTION_ID,
        ID.unique(),
        {
          fileId: fileUpload.$id,
          fileName: file.name,
          pack: '100DevsTwitch',
          soundFileId: STICKER_SOUND_MAP[file.name] ?? null // Use nullish coalescing
        }
      );
      
      console.log(`[SUCCESS] Uploaded ${file.name}`);
      successCount++;
    } catch (error) {
      console.error(`[ERROR] Failed to upload ${file.name}:`, error);
      failCount++;
    }
  }

  console.log(`
Upload complete!
Successfully uploaded: ${successCount}
Failed: ${failCount}
Total files: ${pngFiles.length}
  `);
}
