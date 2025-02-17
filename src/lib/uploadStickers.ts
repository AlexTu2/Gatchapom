import { storage } from './appwrite';
import { ID, Permission, Role } from 'appwrite';

// Create a separate bucket ID for stickers
export const STICKERS_BUCKET_ID = 'stickers'; // Replace with your actual stickers bucket ID

const STICKER_PATHS = [
    '/learnwithleon/learnw11job.png',
    '/learnwithleon/learnw1Bob.png',
    '/learnwithleon/learnw1Edu.png',
    '/learnwithleon/learnw1End.png',
    '/learnwithleon/learnw1First.png',
    '/learnwithleon/learnw1Free.png',
    '/learnwithleon/learnw1Getgot.png',
    '/learnwithleon/learnw1Goget.png',
    '/learnwithleon/learnw1Hypebob.png',
    '/learnwithleon/learnw1Hypeleon.png',
    '/learnwithleon/learnw1John.png',
    '/learnwithleon/learnw1Leon.png',
    '/learnwithleon/learnw1Nuns.png',
    '/learnwithleon/learnw1Should.png',
    '/learnwithleon/learnw1Smile.png',
    '/learnwithleon/learnw1Spicy.png',
    '/learnwithleon/learnw1Wedont.png',
    '/learnwithleon/learnw1Wink.png',
    '/learnwithleon/microLeon.png'
];

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
      await storage.createFile(
        STICKERS_BUCKET_ID,
        ID.unique(),
        file,
        [
          Permission.read(Role.any()), // Anyone can view the sticker
          Permission.update(Role.users()), // Only users can update
          Permission.delete(Role.users()) // Only users can delete
        ]
      );
      
      successCount++;
    } catch (error) {
      console.error(`Failed to upload: ${path}`);
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
