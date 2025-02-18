import { storage, databases } from '../appwrite';
import { Query, type Models } from 'appwrite';
import { useEffect, useState, useRef } from 'react';
import { STICKERS_BUCKET_ID, DATABASE_ID, STICKER_METADATA_COLLECTION_ID } from '../uploadStickers';
import type { StickerCollection } from '../../config/stickerSounds';

interface MetadataDocument {
  $id: string;
  $createdAt: string;
  $updatedAt: string;
  $permissions: string[];
  $collectionId: string;
  $databaseId: string;
  fileId: string;
  fileName: string;
  pack: StickerCollection;
  soundFileId?: string;
}

export function useStickers() {
  const [stickers, setStickers] = useState<(Models.File & { pack?: StickerCollection })[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const loadedRef = useRef(false);

  useEffect(() => {
    if (loadedRef.current) return;
    
    async function loadStickers() {
      try {
        let allMetadataDocuments: MetadataDocument[] = [];
        let metadataLastId: string | undefined;
        const limit = 100;
        
        // Keep fetching until we get all documents
        while (true) {
          const queries = [Query.limit(limit)];
          if (metadataLastId) {
            queries.push(Query.cursorAfter(metadataLastId));
          }

          const metadataResponse = await databases.listDocuments<MetadataDocument>(
            DATABASE_ID,
            STICKER_METADATA_COLLECTION_ID,
            queries
          );

          allMetadataDocuments = [...allMetadataDocuments, ...metadataResponse.documents];
          
          console.log(`Fetched batch: size=${metadataResponse.documents.length}, total=${allMetadataDocuments.length}`);
          
          if (metadataResponse.documents.length < limit) {
            // We've got all documents
            break;
          }
          
          // Get the last document's ID for the next query
          metadataLastId = metadataResponse.documents[metadataResponse.documents.length - 1].$id;
        }

        console.log('Raw metadata response:', {
          total: allMetadataDocuments.length,
          documents: allMetadataDocuments.map(doc => ({
            fileId: doc.fileId,
            fileName: doc.fileName,
            pack: doc.pack
          }))
        });

        // Get all files from storage with pagination
        let allFiles: Models.File[] = [];
        let filesLastId: string | undefined;
        
        while (true) {
          const queries = [Query.limit(limit)];
          if (filesLastId) {
            queries.push(Query.cursorAfter(filesLastId));
          }

          const filesResponse = await storage.listFiles(
            STICKERS_BUCKET_ID,
            queries
          );

          console.log('Files batch:', {
            size: filesResponse.files.length,
            lastId: filesLastId
          });

          allFiles = [...allFiles, ...filesResponse.files];
          
          if (filesResponse.files.length < limit) {
            break;
          }
          
          filesLastId = filesResponse.files[filesResponse.files.length - 1].$id;
        }

        console.log('All files loaded:', {
          total: allFiles.length,
          files: allFiles.map(f => ({
            id: f.$id,
            name: f.name
          }))
        });

        // Create metadata map
        const metadataMap = new Map(
          allMetadataDocuments.map(doc => [doc.fileId, {
            pack: doc.pack,
            fileName: doc.fileName,
            soundFileId: doc.soundFileId
          }])
        );

        // Combine file data with metadata using all files
        const stickerFiles = allFiles
          .filter(file => file.name.endsWith('.png') || file.name.endsWith('.gif'))
          .map(file => {
            const metadata = metadataMap.get(file.$id);
            return {
              ...file,
              pack: metadata?.pack || '100DevsTwitch' // Default to Twitch if no pack specified
            };
          });

        setStickers(stickerFiles);
        
        // Debug log the final mapping
        console.log('Final sticker mapping:', {
          total: stickerFiles.length,
          byPack: {
            twitch: stickerFiles.filter(s => s.pack === '100DevsTwitch').length,
            discord: stickerFiles.filter(s => s.pack === '100DevsDiscord').length,
            undefined: stickerFiles.filter(s => !s.pack).length
          },
          stickers: stickerFiles.map(s => ({
            name: s.name,
            pack: s.pack || 'undefined'
          }))
        });

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

  const getStickerId = (stickerName: string) => {
    const sticker = stickers.find(s => s.name === stickerName);
    return sticker?.$id;
  };

  return {
    stickers,
    isLoading,
    getStickerUrl,
    getStickerId
  };
} 