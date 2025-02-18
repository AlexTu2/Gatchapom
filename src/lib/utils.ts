import { clsx, type ClassValue } from "clsx"
import { twMerge } from "tailwind-merge"
import { stickerSounds, type StickerCollection } from '../config/stickerSounds'

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

export function openBoosterPack(collection: StickerCollection) {
  // Filter stickers by collection before selecting random ones
  const collectionStickers = stickerSounds.filter(
    (sticker: { collection: StickerCollection }) => sticker.collection === collection
  );
  
  return collectionStickers; // or use them in your random selection logic
}
