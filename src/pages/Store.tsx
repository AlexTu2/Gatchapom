import { useState, useCallback, useMemo } from "react";
import { useUser } from "@/lib/context/user";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { account } from "@/lib/appwrite";
import confetti from 'canvas-confetti';
import { Lock } from "lucide-react";
import { useStickers } from '@/lib/hooks/useStickers';
import { uploadStickers } from '@/lib/uploadStickers';

const BOOSTER_PACK_COST = 100;

export function Store() {
  const user = useUser();
  const [isOpening, setIsOpening] = useState(false);
  const [showReward, setShowReward] = useState(false);
  const [currentSticker, setCurrentSticker] = useState<string | null>(null);
  const [isUploading, setIsUploading] = useState(false);
  
  const microLeons = Number(user.current?.prefs.microLeons) || 0;
  const unlockedStickers = user.current?.prefs.unlockedStickers ? 
    JSON.parse(user.current.prefs.unlockedStickers) : [];

  const { stickers, isLoading, getStickerUrl } = useStickers();

  const microLeonSticker = useMemo(() => 
    stickers.find(s => s.name === 'microLeon.png'),
    [stickers]
  );

  // Create a map to count sticker quantities
  const stickerCounts = useMemo(() => {
    const counts: { [key: string]: number } = {};
    unlockedStickers.forEach((sticker: string) => {
      counts[sticker] = (counts[sticker] || 0) + 1;
    });
    return counts;
  }, [unlockedStickers]);

  const openBoosterPack = useCallback(async () => {
    if (!user.current || microLeons < BOOSTER_PACK_COST || !stickers.length) return;

    setIsOpening(true);
    
    try {
      // Select a random sticker
      const randomSticker = stickers[Math.floor(Math.random() * stickers.length)];
      
      // Update user preferences
      const newMicroLeons = microLeons - BOOSTER_PACK_COST;
      const newUnlockedStickers = [...unlockedStickers, randomSticker.$id];
      
      const updatedPrefs = {
        ...user.current.prefs,
        microLeons: newMicroLeons.toString(),
        unlockedStickers: JSON.stringify(newUnlockedStickers)
      };
      
      await account.updatePrefs(updatedPrefs);
      user.updateUser({
        ...user.current,
        prefs: updatedPrefs
      });
      
      setCurrentSticker(randomSticker.$id);
      setShowReward(true);
      
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
  }, [user, microLeons, unlockedStickers, stickers]);

  const handleUpload = async () => {
    if (isUploading) return;
    setIsUploading(true);
    try {
      await uploadStickers();
    } catch (error) {
      console.error('Upload failed:', error);
    } finally {
      setIsUploading(false);
    }
  };

  if (isLoading) {
    return <div>Loading stickers...</div>;
  }

  return (
    <div className="container mx-auto px-4 py-8">
      <Card className="w-full max-w-md mx-auto">
        <CardHeader>
          <div className="flex justify-between items-center">
            <CardTitle className="text-2xl font-bold">Sticker Store</CardTitle>
            <Button 
              variant="outline" 
              onClick={handleUpload}
              disabled={isUploading}
            >
              {isUploading ? 'Uploading...' : 'Upload Stickers'}
            </Button>
          </div>
          <CardDescription>
            Unlock new stickers to show off in chat!
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-6">
            <div className="flex items-center justify-between p-4 bg-gray-100 rounded-lg">
              <div className="flex items-center gap-2">
                {microLeonSticker && (
                  <img 
                    src={getStickerUrl(microLeonSticker.$id)}
                    alt="Micro Leon" 
                    className="h-8 w-8"
                  />
                )}
                <span className="font-medium">{microLeons} micro leons</span>
              </div>
            </div>

            <div className="p-6 border rounded-lg text-center space-y-4">
              <h3 className="text-lg font-semibold">Booster Pack</h3>
              <p className="text-sm text-gray-600">
                Contains one random sticker
              </p>
              <div className="flex items-center justify-center gap-2">
                {microLeonSticker && (
                  <img 
                    src={getStickerUrl(microLeonSticker.$id)}
                    alt="Cost" 
                    className="h-6 w-6"
                  />
                )}
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
                {stickers.map((sticker) => {
                  const count = stickerCounts[sticker.$id] || 0;
                  const isUnlocked = count > 0;
                  
                  return (
                    <div 
                      key={sticker.$id}
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
                          src={getStickerUrl(sticker.$id)}
                          alt={sticker.name}
                          className={`
                            w-full h-full object-contain
                            ${isUnlocked ? '' : 'opacity-30 grayscale'}
                            transition-all duration-200
                          `}
                        />
                        {!isUnlocked && (
                          <div className="absolute inset-0 flex items-center justify-center bg-black/5 rounded-lg">
                            <Lock className="w-4 h-4 text-gray-400" />
                          </div>
                        )}
                        {count > 1 && (
                          <div className="absolute top-1 right-1 bg-blue-500 text-white rounded-full w-5 h-5 flex items-center justify-center text-xs font-medium">
                            {count}
                          </div>
                        )}
                      </div>
                      <span className={`
                        text-xs text-center truncate w-full
                        ${isUnlocked ? 'text-gray-700' : 'text-gray-400'}
                      `}>
                        {sticker.name.replace('.png', '').split('-').join(' ')}
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
            <DialogDescription asChild>
              <div className="space-y-2">
                <div>You've unlocked a new sticker for your collection!</div>
                <div className="font-medium text-yellow-600 flex items-center gap-2">
                  <img 
                    src="/learnwithleon/microLeon.png" 
                    alt="Micro Leon" 
                    className="h-16 w-16"
                  />
                  You spent {BOOSTER_PACK_COST} micro leons!
                </div>
              </div>
            </DialogDescription>
          </DialogHeader>
          {currentSticker && (
            <div className="flex flex-col items-center gap-4 py-4">
              <div className="w-32 h-32 flex items-center justify-center">
                <img 
                  src={getStickerUrl(currentSticker)}
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