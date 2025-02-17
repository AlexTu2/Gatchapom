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

        // Create mappings first
        const nameToId: StickerMap = {};
        const idToName: StickerMap = {};
        
        response.files.forEach(file => {
          const fullName = file.name;
          const baseName = file.name.replace('.png', '');
          
          // Store all variations of the name
          nameToId[fullName] = file.$id;
          nameToId[baseName] = file.$id;
          nameToId[fullName.toLowerCase()] = file.$id;
          nameToId[baseName.toLowerCase()] = file.$id;
          
          // Special case for microLeon - handle both the file name and ID
          if (file.name === 'microLeon.png' || file.$id === '67b27bbc001cba8f5ed9') {
            nameToId['microLeon'] = '67b27bbc001cba8f5ed9';
            nameToId['microLeon.png'] = '67b27bbc001cba8f5ed9';
            nameToId['microleon'] = '67b27bbc001cba8f5ed9';
            nameToId['microleon.png'] = '67b27bbc001cba8f5ed9';
            idToName['67b27bbc001cba8f5ed9'] = 'microLeon';
          }
          
          // Store the base name for ID lookup
          idToName[file.$id] = baseName;
        });

        // Set all state updates together
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
    // If we're still loading, wait
    if (isLoading) return undefined;

    // Try all variations of the name
    const variations = [
      name,                              // Original
      name.toLowerCase(),                // Lowercase
      name.endsWith('.png') ? name : `${name}.png`,  // With extension
      name.replace('.png', ''),         // Without extension
      name.toLowerCase().replace('.png', '') // Lowercase without extension
    ];

    for (const variation of variations) {
      const id = stickerNameToId[variation];
      if (id) return id;
    }

    // Only log if sticker is truly not found
    console.error(`Sticker not found: ${name}`);
    return undefined;
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