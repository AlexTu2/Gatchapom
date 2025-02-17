import { storage } from '../appwrite';
import { useEffect, useState } from 'react';
import { Models } from 'appwrite';
import { STICKERS_BUCKET_ID } from '../uploadStickers';

interface StickerMap {
  [key: string]: string; // filename -> fileId
}

export function useStickers() {
  const [stickers, setStickers] = useState<Models.File[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [stickerNameToId, setStickerNameToId] = useState<StickerMap>({});
  const [stickerIdToName, setStickerIdToName] = useState<StickerMap>({});
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let mounted = true;
    const controller = new AbortController();

    async function loadStickers() {
      try {
        const response = await storage.listFiles(STICKERS_BUCKET_ID);
        
        if (!mounted) return;

        const nameToId: StickerMap = {};
        const idToName: StickerMap = {};
        
        response.files.forEach(file => {
          const fullName = file.name;
          const baseName = file.name.replace('.png', '');
          
          // Store only the base name and full name
          nameToId[fullName] = file.$id;
          nameToId[baseName] = file.$id;
          
          // Store the base name for ID lookup
          idToName[file.$id] = baseName;
        });

        setStickers(response.files);
        setStickerNameToId(nameToId);
        setStickerIdToName(idToName);
        setError(null);
      } catch (error) {
        if (!mounted) return;
        console.error('Failed to load stickers:', error);
        setError('Failed to load stickers');
      } finally {
        if (mounted) {
          setIsLoading(false);
        }
      }
    }

    loadStickers();

    return () => {
      mounted = false;
      controller.abort();
    };
  }, []);

  const getStickerId = (name: string) => {
    if (isLoading) return undefined;

    // Try both with and without .png
    const baseName = name.replace('.png', '');
    return stickerNameToId[name] || stickerNameToId[baseName];
  };

  const getStickerUrl = (nameOrId: string) => {
    try {
      const fileId = stickerNameToId[nameOrId] || nameOrId;
      return storage.getFileView(STICKERS_BUCKET_ID, fileId);
    } catch (error) {
      console.error('Failed to get sticker URL');
      return '/fallback-sticker.png';
    }
  };

  const getStickerName = (fileId: string) => {
    return stickerIdToName[fileId];
  };

  // Debug function to check mappings
  const debugMappings = () => {
    console.log('Name to ID mappings:', stickerNameToId);
    console.log('ID to Name mappings:', stickerIdToName);
    console.log('All stickers:', stickers);
  };

  return {
    stickers,
    isLoading,
    getStickerUrl,
    getStickerName,
    getStickerId,
    error,
    debugMappings
  };
} 