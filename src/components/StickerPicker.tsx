import { Button } from "@/components/ui/button";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Smile } from "lucide-react";
import { ScrollArea } from "@/components/ui/scroll-area";

interface StickerPickerProps {
  unlockedStickers: string[];
  onStickerSelect: (sticker: string) => void;
}

export function StickerPicker({ unlockedStickers, onStickerSelect }: StickerPickerProps) {
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
      <PopoverContent 
        className="w-[280px] p-3" 
        align="start"
        side="top"
      >
        <div className="text-sm font-medium mb-2">Your Stickers</div>
        <ScrollArea className="h-[300px]">
          <div className="grid grid-cols-4 gap-2">
            {unlockedStickers.length === 0 ? (
              <div className="col-span-4 text-center text-sm text-muted-foreground py-4">
                No stickers yet! Unlock them in the store.
              </div>
            ) : (
              unlockedStickers.map((sticker) => (
                <button
                  key={sticker}
                  onClick={() => onStickerSelect(sticker)}
                  className="aspect-square rounded-lg hover:bg-accent p-2 transition-colors"
                >
                  <img
                    src={`/learnwithleon/${sticker}`}
                    alt={sticker.replace('.png', '')}
                    className="w-full h-full object-contain"
                  />
                </button>
              ))
            )}
          </div>
        </ScrollArea>
      </PopoverContent>
    </Popover>
  );
} 