import { useState, useCallback, useMemo, useEffect, useRef } from "react";
import { useUser } from "@/lib/context/user";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { account, storage } from "@/lib/appwrite";
import confetti from 'canvas-confetti';
import { Lock } from "lucide-react";
import { useStickers } from '@/lib/hooks/useStickers';
import { uploadStickers } from '@/lib/uploadStickers';
import { toast } from "@/components/ui/use-toast";
import { Models } from "appwrite";
import { AUDIO_BUCKET_ID } from "@/lib/audio";
import { STICKER_SOUND_MAP } from "@/config/stickerSounds";

const BOOSTER_PACK_COST = 100;
const STICKER_PRICE = 100; // Assuming a default STICKER_PRICE
const MAX_PACKS = 10;

interface StickerSounds {
  [key: string]: HTMLAudioElement;
}

export function Store() {
  const user = useUser();
  const [isOpening, setIsOpening] = useState(false);
  const [showReward, setShowReward] = useState(false);
  const [currentSticker, setCurrentSticker] = useState<string | null>(null);
  const [isUploading, setIsUploading] = useState(false);
  const [justUnlocked, setJustUnlocked] = useState<string | null>(null);
  const [packCount, setPackCount] = useState(1);
  const [openedStickers, setOpenedStickers] = useState<Models.File[]>([]);
  
  const microLeons = Number(user.current?.prefs.microLeons) || 0;
  const { stickers, isLoading, getStickerUrl } = useStickers();

  const stickerSounds = useRef<StickerSounds>({});
  const [soundsLoaded, setSoundsLoaded] = useState(false);
  const [playingSticker, setPlayingSticker] = useState<string | null>(null);

  useEffect(() => {
    const loadStickerSounds = async () => {
      if (soundsLoaded) return;

      try {
        for (const [stickerName, soundFile] of Object.entries(STICKER_SOUND_MAP)) {
          try {
            const soundUrl = storage.getFileView(AUDIO_BUCKET_ID, soundFile);
            const audio = new Audio(soundUrl.toString());
            
            stickerSounds.current[stickerName] = audio;
            
            await audio.load();
          } catch (error) {
            console.error(`Failed to load sound for ${stickerName}:`, error);
          }
        }
        setSoundsLoaded(true);
      } catch (error) {
        console.error('Error loading sticker sounds:', error);
      }
    };

    loadStickerSounds();
  }, [soundsLoaded]);

  const playStickersSequentially = useCallback(async (stickers: string[]) => {
    for (const stickerName of stickers) {
      if (STICKER_SOUND_MAP[stickerName]) {
        await new Promise<void>((resolve) => {
          const audio = stickerSounds.current[stickerName];
          if (audio) {
            setPlayingSticker(stickerName);
            audio.currentTime = 0;
            audio.onended = () => {
              setPlayingSticker(null);
              resolve();
            };
            audio.play().catch(error => {
              console.error('Error playing sticker sound:', error);
              setPlayingSticker(null);
              resolve();
            });
          } else {
            resolve();
          }
        });
      }
    }
  }, []);

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

  const retryOperation = async (operation: () => Promise<any>, maxAttempts = 3, delay = 1000) => {
    for (let attempt = 1; attempt <= maxAttempts; attempt++) {
      try {
        return await operation();
      } catch (error) {
        if (attempt === maxAttempts) throw error;
        console.log(`Attempt ${attempt} failed, retrying in ${delay}ms...`);
        await new Promise(resolve => setTimeout(resolve, delay));
      }
    }
  };

  const openBoosterPack = useCallback(async () => {
    const totalCost = BOOSTER_PACK_COST * packCount;
    if (!user.current || microLeons < totalCost || !stickers.length) return;

    setIsOpening(true);
    
    try {
      // Select random stickers
      const newStickers: Models.File[] = [];
      const updatedStickers = { ...unlockedStickers };
      const newStickerSounds: string[] = [];
      
      for (let i = 0; i < packCount; i++) {
        const randomSticker = stickers[Math.floor(Math.random() * stickers.length)];
        newStickers.push(randomSticker);
        const stickerName = randomSticker.name;
        updatedStickers[stickerName] = (updatedStickers[stickerName] || 0) + 1;
        
        if (!unlockedStickers[stickerName] && STICKER_SOUND_MAP[stickerName]) {
          newStickerSounds.push(stickerName);
        }
      }

      // Update user preferences with retry
      await retryOperation(async () => {
        const updatedMicroLeons = microLeons - totalCost;
        await user.updateUser({
          microLeons: updatedMicroLeons.toString(),
          unlockedStickers: JSON.stringify(updatedStickers)
        });
      });

      // Only show reward and play sounds if update was successful
      setOpenedStickers(newStickers);
      setShowReward(true);

      // Play sounds sequentially
      await playStickersSequentially(newStickerSounds);

      // Trigger confetti effect
      confetti({
        particleCount: 100 * packCount,
        spread: 70,
        origin: { y: 0.6 }
      });
    } catch (error) {
      console.error('Failed to open booster packs:', error);
      alert('Connection error. Please try again. If the problem persists, refresh the page.');
    } finally {
      setIsOpening(false);
    }
  }, [user, microLeons, stickers, unlockedStickers, packCount, playStickersSequentially]);

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

  const purchaseSticker = async (sticker: Models.File) => {
    if (!user.current) return;

    try {
      // Get fresh user data
      const currentUser = await account.get();
      
      // Parse current microLeons and unlockedStickers
      const currentLeons = Number(currentUser.prefs.microLeons) || 0;
      let unlockedStickers;
      try {
        unlockedStickers = JSON.parse(currentUser.prefs.unlockedStickers || '{}');
      } catch {
        unlockedStickers = {};
      }

      // Check if user can afford the sticker
      if (currentLeons < STICKER_PRICE) {
        alert("Not enough micro leons! You need " + STICKER_PRICE + " micro leons to purchase this sticker.");
        return;
      }

      // Update sticker count
      const stickerName = sticker.name;
      unlockedStickers[stickerName] = (unlockedStickers[stickerName] || 0) + 1;

      // Update user preferences with new values
      await user.updateUser({
        microLeons: (currentLeons - STICKER_PRICE).toString(),
        unlockedStickers: JSON.stringify(unlockedStickers)
      });

      alert("Sticker purchased! You can now use this sticker in chat.");

    } catch (error) {
      console.error('Error purchasing sticker:', error);
      alert("Purchase failed. There was an error purchasing the sticker.");
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
              <h3 className="text-lg font-semibold">Booster Pack{packCount > 1 ? 's' : ''}</h3>
              <p className="text-sm text-gray-600">
                Contains {packCount} random sticker{packCount > 1 ? 's' : ''}
              </p>
              <div className="flex items-center justify-center gap-2">
                {microLeonSticker && (
                  <img 
                    src={getStickerUrl(microLeonSticker.$id)}
                    alt="Cost" 
                    className="h-6 w-6"
                  />
                )}
                <span>{BOOSTER_PACK_COST * packCount}</span>
              </div>
              <div className="flex items-center justify-center gap-4 mb-4">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setPackCount(Math.max(1, packCount - 1))}
                >
                  -
                </Button>
                <span className="w-16 text-center">{packCount} pack{packCount > 1 ? 's' : ''}</span>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setPackCount(Math.min(MAX_PACKS, packCount + 1))}
                >
                  +
                </Button>
              </div>
              <Button
                onClick={openBoosterPack}
                disabled={isOpening || microLeons < (BOOSTER_PACK_COST * packCount)}
                className="w-full"
              >
                {isOpening ? 'Opening...' : `Open ${packCount} Pack${packCount > 1 ? 's' : ''}`}
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
                      onClick={() => {
                        if (isUnlocked && STICKER_SOUND_MAP[sticker.name]) {
                          playStickersSequentially([sticker.name]);
                        }
                      }}
                      style={{ cursor: isUnlocked && STICKER_SOUND_MAP[sticker.name] ? 'pointer' : 'default' }}
                    >
                      <div 
                        className={`
                          aspect-square rounded-lg p-2 
                          flex items-center justify-center
                          ${isUnlocked 
                            ? playingSticker === sticker.name
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
            <DialogTitle>New Sticker{openedStickers.length > 1 ? 's' : ''} Unlocked! 🎉</DialogTitle>
            <DialogDescription asChild>
              <div className="space-y-2">
                <div>You've unlocked {openedStickers.length} new sticker{openedStickers.length > 1 ? 's' : ''} for your collection!</div>
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
                  You spent {BOOSTER_PACK_COST * packCount} micro leons!
                </div>
              </div>
            </DialogDescription>
          </DialogHeader>
          <div className="grid grid-cols-2 gap-4 py-4">
            {openedStickers.map((sticker, index) => (
              <div 
                key={index} 
                className="flex flex-col items-center"
                onClick={() => {
                  if (STICKER_SOUND_MAP[sticker.name]) {
                    playStickersSequentially([sticker.name]);
                  }
                }}
                style={{ cursor: STICKER_SOUND_MAP[sticker.name] ? 'pointer' : 'default' }}
              >
                <div 
                  className={`
                    w-24 h-24 flex items-center justify-center
                    rounded-lg p-2
                    ${playingSticker === sticker.name
                      ? 'bg-background border-2 border-yellow-400/50 shadow-[0_0_10px_rgba(250,204,21,0.3)] dark:shadow-[0_0_15px_rgba(250,204,21,0.2)]'
                      : 'bg-background border-2 border-primary/50'
                    }
                    transition-colors duration-300
                  `}
                >
                  <img 
                    src={getStickerUrl(sticker.$id)}
                    alt={`New Sticker ${index + 1}`}
                    className="w-full h-full object-contain"
                    onError={(e) => {
                      console.error('Failed to load new sticker');
                      e.currentTarget.src = '/fallback-sticker.png';
                    }}
                  />
                </div>
                <span className="text-xs text-center mt-2">
                  {sticker.name.replace('.png', '').split('-').join(' ')}
                </span>
              </div>
            ))}
          </div>
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