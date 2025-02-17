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
  const [justUnlocked, setJustUnlocked] = useState<string | null>(null);
  
  const microLeons = Number(user.current?.prefs.microLeons) || 0;
  const { stickers, isLoading, getStickerUrl } = useStickers();

  // Parse unlocked stickers first
  const unlockedStickers = useMemo(() => {
    try {
      return user.current?.prefs.unlockedStickers ? 
        JSON.parse(user.current.prefs.unlockedStickers) : {};
    } catch (e) {
      console.error('Failed to parse unlockedStickers:', e);
      return {};
    }
  }, [user.current?.prefs.unlockedStickers]);

  // Then create the check function using the parsed data
  const checkIfUnlocked = useCallback((stickerId: string) => {
    const stickerFile = stickers.find(s => s.$id === stickerId);
    return stickerFile ? (unlockedStickers[stickerFile.name] || 0) > 0 : false;
  }, [stickers, unlockedStickers]);

  const microLeonSticker = useMemo(() => ({
    $id: '67b27bbc001cba8f5ed9',
    name: 'microLeon.png'
  }), []);

  // Create a map to count sticker quantities
  const stickerCounts = useMemo(() => {
    const counts: { [key: string]: number } = {};
    Object.entries(unlockedStickers).forEach(([sticker, count]) => {
      counts[sticker] = count;
    });
    return counts;
  }, [unlockedStickers]);

  const openBoosterPack = useCallback(async () => {
    if (!user.current || microLeons < BOOSTER_PACK_COST || !stickers.length) return;

    setIsOpening(true);
    
    try {
      // Select a random sticker
      const randomSticker = stickers[Math.floor(Math.random() * stickers.length)];
      const stickerName = randomSticker.name;
      
      // Update user preferences
      const updatedMicroLeons = microLeons - BOOSTER_PACK_COST;
      
      // Update the sticker count in the dictionary
      const updatedStickers = {
        ...unlockedStickers,
        [stickerName]: (unlockedStickers[stickerName] || 0) + 1
      };

      const updatedPrefs = {
        ...user.current.prefs,
        microLeons: updatedMicroLeons.toString(),
        unlockedStickers: JSON.stringify(updatedStickers)
      };

      // Update Appwrite
      await account.updatePrefs(updatedPrefs);

      // Update local user context
      user.updateUser({
        ...user.current,
        prefs: updatedPrefs
      });

      setCurrentSticker(randomSticker.$id);
      setJustUnlocked(randomSticker.$id);
      setShowReward(true);

      // Trigger confetti effect
      confetti({
        particleCount: 100,
        spread: 70,
        origin: { y: 0.6 }
      });
    } catch (error) {
      console.error('Failed to open booster pack:', error);
    } finally {
      setIsOpening(false);
    }
  }, [user, microLeons, stickers, unlockedStickers]);

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

  // Handle dialog close
  const handleRewardClose = () => {
    setShowReward(false);
    // Start the fade out after dialog is closed
    setTimeout(() => {
      setJustUnlocked(null);
    }, 1000); // Shorter duration since user has already seen it
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
                  const isUnlocked = checkIfUnlocked(sticker.$id);
                  const count = unlockedStickers[sticker.name] || 0;
                  
                  return (
                    <div 
                      key={sticker.$id}
                      className="flex flex-col items-center gap-2"
                    >
                      <div 
                        className={`
                          aspect-square rounded-lg p-2 
                          flex items-center justify-center
                          ${isUnlocked 
                            ? justUnlocked === sticker.$id
                              ? 'bg-background border-2 border-yellow-400/50 shadow-[0_0_10px_rgba(250,204,21,0.3)] dark:shadow-[0_0_15px_rgba(250,204,21,0.2)]'
                              : 'bg-background border-2 border-primary/50'
                            : 'bg-muted border border-border'
                          }
                          transition-colors duration-300
                          relative
                        `}
                      >
                        <img 
                          src={getStickerUrl(sticker.$id)}
                          alt={sticker.name}
                          className={`
                            w-full h-full object-contain
                            ${isUnlocked 
                              ? 'opacity-100' 
                              : 'opacity-30 grayscale'
                            }
                            transition-opacity duration-300
                          `}
                        />
                        {!isUnlocked && (
                          <div className="absolute inset-0 flex items-center justify-center bg-background/5 rounded-lg">
                            <Lock className="w-4 h-4 text-muted-foreground" />
                          </div>
                        )}
                        {count > 1 && (
                          <div className="absolute top-1 right-1 bg-primary text-primary-foreground rounded-full w-5 h-5 flex items-center justify-center text-xs font-medium">
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

      <Dialog open={showReward} onOpenChange={handleRewardClose}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>New Sticker Unlocked! 🎉</DialogTitle>
            <DialogDescription asChild>
              <div className="space-y-2">
                <div>You've unlocked a new sticker for your collection!</div>
                <div className="font-medium text-yellow-600 flex items-center gap-2">
                  {microLeonSticker && (
                    <img 
                      src={getStickerUrl(microLeonSticker.$id)}
                      alt="Micro Leon" 
                      className="h-16 w-16"
                      onError={(e) => {
                        console.error('Failed to load microLeon sticker');
                        e.currentTarget.src = '/fallback-sticker.png';
                      }}
                    />
                  )}
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
                  onError={(e) => {
                    console.error('Failed to load new sticker');
                    e.currentTarget.src = '/fallback-sticker.png';
                  }}
                />
              </div>
            </div>
          )}
          <div className="flex justify-end">
            <Button onClick={handleRewardClose}>
              Nice!
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
} 