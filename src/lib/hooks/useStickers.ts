import { storage, databases } from '../appwrite';
import { useEffect, useState, useRef } from 'react';
import { STICKERS_BUCKET_ID, DATABASE_ID, STICKER_METADATA_COLLECTION_ID } from '../uploadStickers';
import type { StickerMetadata } from '../types/sticker';
import { Models } from 'appwrite';
import type { StickerCollection } from '../config/stickerSounds';

interface MetadataDocument {
  fileId: string;
  fileName: string;
  collection: StickerCollection;
}

export function useStickers() {
  const [nameToId, setNameToId] = useState<Record<string, string>>({});
  const [idToName, setIdToName] = useState<Record<string, string>>({});
  const [stickers, setStickers] = useState<(Models.File & StickerMetadata)[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const loadedRef = useRef(false);
  const loggedRef = useRef(false); // New ref to track if we've logged

  useEffect(() => {
    if (loadedRef.current) return;
    
    async function loadStickers() {
      try {
        // Get metadata from database
        const metadataResponse = await databases.listDocuments(
          DATABASE_ID,
          STICKER_METADATA_COLLECTION_ID
        );

        // Create a map of fileId to metadata
        const metadataMap = new Map(
          metadataResponse.documents.map((doc: MetadataDocument) => [doc.fileId, doc])
        );

        // Get files from storage
        const filesResponse = await storage.listFiles(STICKERS_BUCKET_ID);
        
        // Combine file data with metadata
        const stickerFiles = filesResponse.files
          .filter(file => file.name.endsWith('.png') || file.name.endsWith('.gif'))
          .map(file => ({
            ...file,
            ...metadataMap.get(file.$id)
          }));

        const newNameToId: Record<string, string> = {};
        const newIdToName: Record<string, string> = {};

        stickerFiles.forEach((file: { name: string; $id: string; }) => {
          const nameWithoutExt = file.name.replace(/\.[^/.]+$/, "");
          newNameToId[file.name] = file.$id;
          newNameToId[nameWithoutExt] = file.$id;
          newIdToName[file.$id] = nameWithoutExt;
        });

        setNameToId(newNameToId);
        setIdToName(newIdToName);
        setStickers(stickerFiles);
        
        // Log only once in development
        if (process.env.NODE_ENV === 'development' && !loggedRef.current) {
          console.debug('Sticker mappings loaded:', {
            count: stickerFiles.length,
            stickers: stickerFiles.map((s: { name: string; }) => s.name)
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

  const getStickerId = (name: string) => {
    if (isLoading) return undefined;
    const baseName = name.replace('.png', '');
    return nameToId[name] || nameToId[baseName];
  };

  const getStickerUrl = (nameOrId: string) => {
    try {
      const fileId = nameToId[nameOrId] || nameOrId;
      const url = storage.getFileView(STICKERS_BUCKET_ID, fileId);
      return url.toString();  // Convert URL to string
    } catch (error) {
      console.error('Failed to get sticker URL:', error);
      return '/fallback-sticker.png';
    }
  };

  const getStickerName = (fileId: string) => {
    return idToName[fileId];
  };

  return {
    stickers,
    isLoading,
    getStickerUrl,
    getStickerName,
    getStickerId
  };
} 