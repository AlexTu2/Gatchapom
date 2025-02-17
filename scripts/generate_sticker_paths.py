import os
from pathlib import Path

def generate_sticker_paths():
    # Assuming the script is run from the project root
    sticker_dir = Path('public/learnwithleon')
    
    # Get all PNG files in the directory
    sticker_files = sorted([
        f"/learnwithleon/{f.name}" 
        for f in sticker_dir.glob('*.png')
    ])
    
    # Generate TypeScript code
    ts_code = """import { storage } from './appwrite';
import { ID } from 'appwrite';

// Create a separate bucket ID for stickers
export const STICKERS_BUCKET_ID = 'stickers'; // Replace with your actual stickers bucket ID

const STICKER_PATHS = [
"""
    
    # Add each path with proper formatting
    for path in sticker_files:
        ts_code += f"  '{path}',\n"
    
    ts_code += """];

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
      
      // Upload to Appwrite
      await storage.createFile(
        STICKERS_BUCKET_ID,
        ID.unique(),
        file
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
"""
    
    # Write to uploadStickers.ts with UTF-8 encoding
    output_path = Path('src/lib/uploadStickers.ts')
    with open(output_path, 'w', encoding='utf-8') as f:
        f.write(ts_code)
    
    print(f"Found {len(sticker_files)} sticker files")
    print(f"Generated {output_path}")
    print("\nSticker paths:")
    for path in sticker_files:
        print(f"  {path}")

if __name__ == "__main__":
    generate_sticker_paths() 