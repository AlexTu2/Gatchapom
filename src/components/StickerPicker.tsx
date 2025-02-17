import { Button } from "@/components/ui/button";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Smile } from "lucide-react";
import { ScrollArea } from "@/components/ui/scroll-area";
import { useStickers } from '@/lib/hooks/useStickers';
import { useMemo } from 'react';

interface StickerPickerProps {
  unlockedStickers: string[];  // Now contains file IDs instead of filenames
  onStickerSelect: (sticker: string) => void;
}

export function StickerPicker({ unlockedStickers, onStickerSelect }: StickerPickerProps) {
  const { stickers, isLoading, getStickerUrl } = useStickers();

  // Process the unlocked stickers
  const normalizedUnlocked = useMemo(() => 
    unlockedStickers.map(id => 
      id.endsWith('.png') ? id.replace('.png', '') : id
    ),
    [unlockedStickers]
  );
  
  const unlockedStickerFiles = useMemo(() => 
    stickers.filter(s => 
      normalizedUnlocked.includes(s.$id) || 
      normalizedUnlocked.includes(s.name.replace('.png', ''))
    ),
    [stickers, normalizedUnlocked]
  );

  return (
    <Popover>
      <PopoverTrigger asChild>
        <Button 
          variant="outline" 
          size="icon"
          className="h-10 w-10 shrink-0"
        >
          <Smile className="h-5 w-5" />
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-[280px] p-3">
        <div className="text-sm font-medium mb-2">Your Stickers</div>
        <ScrollArea className="h-[300px]">
          {isLoading ? (
            <div className="text-center py-4">Loading stickers...</div>
          ) : unlockedStickerFiles.length === 0 ? (
            <div className="text-center text-sm text-muted-foreground py-4">
              {stickers.length === 0 ? 'Error loading stickers' : 'No stickers yet! Unlock them in the store.'}
            </div>
          ) : (
            <div className="grid grid-cols-4 gap-2">
              {unlockedStickerFiles.map((sticker) => (
                <button
                  key={sticker.$id}
                  onClick={() => onStickerSelect(sticker.name.replace('.png', ''))}
                  className="aspect-square rounded-lg hover:bg-accent p-2 transition-colors"
                >
                  <img
                    src={getStickerUrl(sticker.$id)}
                    alt={sticker.name}
                    className="w-full h-full object-contain"
                    loading="lazy"
                  />
                </button>
              ))}
            </div>
          )}
        </ScrollArea>
      </PopoverContent>
    </Popover>
  );
} 