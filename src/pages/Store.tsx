import { useState, useCallback } from "react";
import { useUser } from "@/lib/context/user";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { account } from "@/lib/appwrite";
import confetti from 'canvas-confetti';
import { Lock } from "lucide-react";

const BOOSTER_PACK_COST = 100;

// Get all PNG files from the learnwithleon directory
const stickerFiles = import.meta.glob('/public/learnwithleon/*.png', { 
  as: 'url',
  eager: true 
});

// Convert paths to filenames
const STICKER_OPTIONS = Object.keys(stickerFiles)
  .map(path => path.split('/').pop() || '')
  .filter(filename => filename !== '');

export function Store() {
  const user = useUser();
  const [isOpening, setIsOpening] = useState(false);
  const [showReward, setShowReward] = useState(false);
  const [currentSticker, setCurrentSticker] = useState<string | null>(null);
  
  const microLeons = Number(user.current?.prefs.microLeons) || 0;
  const unlockedStickers = user.current?.prefs.unlockedStickers ? 
    JSON.parse(user.current.prefs.unlockedStickers) : [];

  const openBoosterPack = useCallback(async () => {
    if (!user.current || microLeons < BOOSTER_PACK_COST) return;

    setIsOpening(true);
    
    try {
      // Select a random sticker
      const randomSticker = STICKER_OPTIONS[Math.floor(Math.random() * STICKER_OPTIONS.length)];
      
      // Update user preferences
      const newMicroLeons = microLeons - BOOSTER_PACK_COST;
      const newUnlockedStickers = [...unlockedStickers, randomSticker];
      
      const updatedPrefs = {
        ...user.current.prefs,
        microLeons: newMicroLeons.toString(),
        unlockedStickers: JSON.stringify([...new Set(newUnlockedStickers)])
      };
      
      await account.updatePrefs(updatedPrefs);
      
      // Update local state
      user.updateUser({
        ...user.current,
        prefs: updatedPrefs
      });
      
      setCurrentSticker(randomSticker);
      setShowReward(true);
      
      // Trigger confetti animation
      confetti({
        particleCount: 100,
        spread: 70,
        origin: { y: 0.6 }
      });
    } catch (error) {
      console.error('Error opening booster pack:', error);
    } finally {
      setIsOpening(false);
    }
  }, [user, microLeons, unlockedStickers]);

  return (
    <div className="container mx-auto px-4 py-8">
      <Card className="w-full max-w-md mx-auto">
        <CardHeader>
          <CardTitle className="text-2xl font-bold">Sticker Store</CardTitle>
          <CardDescription>
            Unlock new stickers to show off in chat!
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-6">
            <div className="flex items-center justify-between p-4 bg-gray-100 rounded-lg">
              <div className="flex items-center gap-2">
                <img 
                  src="/learnwithleon/microLeon.png" 
                  alt="Micro Leon" 
                  className="h-8 w-8"
                />
                <span className="font-medium">{microLeons} micro leons</span>
              </div>
            </div>

            <div className="p-6 border rounded-lg text-center space-y-4">
              <h3 className="text-lg font-semibold">Booster Pack</h3>
              <p className="text-sm text-gray-600">
                Contains one random sticker
              </p>
              <div className="flex items-center justify-center gap-2">
                <img 
                  src="/learnwithleon/microLeon.png" 
                  alt="Cost" 
                  className="h-6 w-6"
                />
                <span>{BOOSTER_PACK_COST}</span>
              </div>
              <Button
                onClick={openBoosterPack}
                disabled={isOpening || microLeons < BOOSTER_PACK_COST}
                className="w-full"
              >
                {isOpening ? 'Opening...' : 'Open Pack'}
              </Button>
            </div>

            <div className="space-y-2">
              <h3 className="font-medium">Your Collection</h3>
              <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-4">
                {STICKER_OPTIONS.map((sticker) => {
                  const isUnlocked = unlockedStickers.includes(sticker);
                  return (
                    <div 
                      key={sticker}
                      className="flex flex-col items-center gap-2"
                    >
                      <div 
                        className={`
                          aspect-square rounded-lg border p-2 
                          flex items-center justify-center
                          ${isUnlocked ? 'bg-white' : 'bg-gray-100'}
                          transition-all duration-200
                          relative
                        `}
                      >
                        <img 
                          src={`/learnwithleon/${sticker}`}
                          alt={sticker.replace('.png', '')}
                          className={`
                            w-full h-full object-contain
                            ${isUnlocked ? '' : 'opacity-30 grayscale'}
                            transition-all duration-200
                          `}
                          onError={(e) => {
                            console.error(`Failed to load sticker: ${sticker}`);
                            e.currentTarget.src = '/learnwithleon/microLeon.png';
                          }}
                        />
                        {!isUnlocked && (
                          <div className="absolute inset-0 flex items-center justify-center bg-black/5 rounded-lg">
                            <Lock className="w-4 h-4 text-gray-400" />
                          </div>
                        )}
                      </div>
                      <span className={`
                        text-xs text-center truncate w-full
                        ${isUnlocked ? 'text-gray-700' : 'text-gray-400'}
                      `}>
                        {sticker.replace('.png', '').split('-').join(' ')}
                      </span>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      <Dialog open={showReward} onOpenChange={setShowReward}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>New Sticker Unlocked! 🎉</DialogTitle>
            <DialogDescription>
              You've unlocked a new sticker for your collection!
            </DialogDescription>
          </DialogHeader>
          {currentSticker && (
            <div className="flex flex-col items-center gap-4 py-4">
              <div className="w-32 h-32 flex items-center justify-center">
                <img 
                  src={`/learnwithleon/${currentSticker}`}
                  alt="New Sticker"
                  className="w-full h-full object-contain"
                />
              </div>
            </div>
          )}
          <div className="flex justify-end">
            <Button onClick={() => setShowReward(false)}>
              Nice!
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
} 