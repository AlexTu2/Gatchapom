import { storage } from '../appwrite';
import { useEffect, useState, useRef } from 'react';
import { Models } from 'appwrite';
import { STICKERS_BUCKET_ID } from '../uploadStickers';

interface StickerMap {
  [key: string]: string; // filename -> fileId
}

export function useStickers() {
  const [nameToId, setNameToId] = useState<Record<string, string>>({});
  const [idToName, setIdToName] = useState<Record<string, string>>({});
  const [stickers, setStickers] = useState<Models.File[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const loadedRef = useRef(false);
  const loggedRef = useRef(false); // New ref to track if we've logged

  useEffect(() => {
    if (loadedRef.current) return;
    
    async function loadStickers() {
      try {
        const response = await storage.listFiles(STICKERS_BUCKET_ID);
        const stickerFiles = response.files.filter(file => 
          file.name.endsWith('.png') || file.name.endsWith('.gif')
        );

        const newNameToId: Record<string, string> = {};
        const newIdToName: Record<string, string> = {};

        stickerFiles.forEach(file => {
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
            stickers: stickerFiles.map(s => s.name)
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
      return storage.getFileView(STICKERS_BUCKET_ID, fileId);
    } catch (error) {
      console.error('Failed to get sticker URL');
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