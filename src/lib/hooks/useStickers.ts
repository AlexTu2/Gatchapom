import { storage, databases } from '../appwrite';
import { useEffect, useState, useRef } from 'react';
import { STICKERS_BUCKET_ID, DATABASE_ID, STICKER_METADATA_COLLECTION_ID } from '../uploadStickers';
import type { Models } from 'appwrite';

interface MetadataDocument {
  $id: string;
  $createdAt: string;
  $updatedAt: string;
  $permissions: string[];
  $collectionId: string;
  $databaseId: string;
  fileId: string;
  fileName: string;
  pack: string;
  soundFileId?: string;
}

export function useStickers() {
  const [stickers, setStickers] = useState<(Models.File & { pack?: string })[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const loadedRef = useRef(false);
  const loggedRef = useRef(false);

  useEffect(() => {
    if (loadedRef.current) return;
    
    async function loadStickers() {
      try {
        // Get metadata from database
        const metadataResponse = await databases.listDocuments<MetadataDocument>(
          DATABASE_ID,
          STICKER_METADATA_COLLECTION_ID
        );

        // Create a map of fileId to metadata
        const metadataMap = new Map(
          metadataResponse.documents.map(doc => [doc.fileId, doc])
        );

        // Get files from storage
        const filesResponse = await storage.listFiles(STICKERS_BUCKET_ID);
        
        // Combine file data with metadata
        const stickerFiles = filesResponse.files
          .filter(file => file.name.endsWith('.png') || file.name.endsWith('.gif'))
          .map(file => ({
            ...file,
            pack: metadataMap.get(file.$id)?.pack
          }));

        setStickers(stickerFiles);
        
        if (process.env.NODE_ENV === 'development' && !loggedRef.current) {
          console.debug('Sticker mappings loaded:', {
            count: stickerFiles.length,
            stickers: stickerFiles.map(s => ({ name: s.name, pack: s.pack }))
          });
          loggedRef.current = true;
        }

      } catch (error) {
        console.error('Error loading stickers:', error);
      } finally {
        setIsLoading(false);
        loadedRef.current = true;
      }
    }

    loadStickers();
  }, []);

  const getStickerUrl = (fileId: string) => {
    try {
      const url = storage.getFileView(STICKERS_BUCKET_ID, fileId);
      return url.toString();
    } catch (error) {
      console.error('Failed to get sticker URL:', error);
      return '/fallback-sticker.png';
    }
  };

  return {
    stickers,
    isLoading,
    getStickerUrl
  };
} 