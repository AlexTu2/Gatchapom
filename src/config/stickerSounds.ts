// Map sticker names to their corresponding sound files
export const STICKER_SOUND_MAP: Record<string, string> = {
  'learnw1Getgot.png': 'big_eyyy',
  'learnw1Wink.png': 'yuh',
  'learnw1First.png': 'first_try',
  'learnw1Goget.png': 'lets_go',
  'learnw1Smile.png': 'small_eyyy',
  'learnw1Spicy.png': 'thats_wild',
  'learnw1Hypeleon.png': 'boats_and_logs',
  'learnw1Nuns.png': 'what',
  // Add more mappings as needed
};

// Add a type for collections
export type StickerCollection = '100DevsTwitch' | '100DevsDiscord';

// Update the sticker type to include collection
export interface StickerSound {
  id: string;
  name: string;
  sound: string;
  collection: StickerCollection;
  // ... other existing properties
}

// Modify the existing stickers to include collection
export const stickerSounds: StickerSound[] = [
  {
    id: "1",
    name: "existing sticker",
    sound: "path/to/sound",
    collection: "100DevsTwitch",
    // ... other properties
  },
  // Add some Discord collection stickers
  {
    id: "discord1",
    name: "discord sticker",
    sound: "path/to/sound",
    collection: "100DevsDiscord",
    // ... other properties
  },
  // ... existing stickers with collection added
]; 