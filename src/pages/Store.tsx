import { useState, useCallback, useMemo, useEffect, useRef } from "react";
import { useUser } from "../lib/context/user";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { storage } from "@/lib/appwrite";
import confetti from 'canvas-confetti';
import { Lock } from "lucide-react";
import { useStickers } from '@/lib/hooks/useStickers';
import { uploadStickers } from '@/lib/uploadStickers';
import { Models } from "appwrite";
import { AUDIO_BUCKET_ID } from "@/lib/audio";
import { STICKER_SOUND_MAP } from "@/config/stickerSounds";
import { useAudio } from "@/lib/context/audio";
import { account } from '../lib/appwrite';
import { type StickerCollection } from '../config/stickerSounds';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

const BOOSTER_PACK_COST = 100;
const MAX_PACKS = 10;

interface StickerSounds {
  [key: string]: HTMLAudioElement;
}

export function Store() {
  const user = useUser();
  const [isOpening, setIsOpening] = useState(false);
  const [showReward, setShowReward] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const [packCount, setPackCount] = useState(1);
  const [openedStickers, setOpenedStickers] = useState<Models.File[]>([]);
  const [selectedCollection, setSelectedCollection] = useState<StickerCollection>('100DevsTwitch');
  
  const microLeons = Number(user.current?.prefs.microLeons) || 0;
  const { stickers, isLoading, getStickerUrl } = useStickers();
  const { volume } = useAudio();

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
            audio.volume = volume;
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
  }, [volume]);

  // Parse unlocked stickers first
  const unlockedStickers = useMemo(() => {
    try {
      return user.current?.prefs.unlockedStickers ? 
        JSON.parse(user.current.prefs.unlockedStickers) : {};
    } catch (e) {
      console.error('Failed to parse unlockedStickers:', e);
      return {};
    }
  }, [user]);

  // Then create the check function using the parsed data
  const checkIfUnlocked = useCallback((stickerId: string) => {
    const stickerFile = stickers.find(s => s.$id === stickerId);
    return stickerFile ? (unlockedStickers[stickerFile.name] || 0) > 0 : false;
  }, [stickers, unlockedStickers]);

  const microLeonSticker = useMemo(() => ({
    $id: '67b27bbc001cba8f5ed9',
    name: 'microLeon.png',
    $createdAt: new Date().toISOString(),
    $updatedAt: new Date().toISOString()
  }), []);

  // Create a map to count sticker quantities

  const retryOperation = async <T,>(operation: () => Promise<T>, maxAttempts = 3, delay = 1000): Promise<T> => {
    for (let attempt = 1; attempt <= maxAttempts; attempt++) {
      try {
        return await operation();
      } catch (error) {
        if (attempt === maxAttempts) throw error;
        console.log(`Attempt ${attempt} failed, retrying in ${delay}ms...`);
        await new Promise(resolve => setTimeout(resolve, delay));
      }
    }
    throw new Error('Operation failed after all attempts');
  };

  const openBoosterPack = useCallback(async (selectedCollection: StickerCollection) => {
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
        // Get current user to ensure we have latest prefs
        const currentUser = await account.get();
        const updatedMicroLeons = microLeons - totalCost;
        
        // Merge with existing preferences
        await account.updatePrefs({
          ...currentUser.prefs,
          microLeons: updatedMicroLeons.toString(),
          unlockedStickers: JSON.stringify(updatedStickers)
        });

        // Update local user state
        user.updateUser({
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
  };

  // Filter stickers by collection
  const collectionStickers = useMemo(() => {
    return stickers.filter(sticker => sticker.collection === selectedCollection);
  }, [selectedCollection, stickers]);

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
                onClick={() => openBoosterPack(selectedCollection)}
                disabled={isOpening || microLeons < (BOOSTER_PACK_COST * packCount)}
                className="w-full"
              >
                {isOpening ? 'Opening...' : `Open ${selectedCollection} Booster Pack`}
              </Button>
            </div>

            <div className="space-y-2">
              <h3 className="font-medium">Your Collection</h3>
              <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-4">
                {collectionStickers.map((sticker) => {
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

      {/* Replace the basic collection selector with a styled one */}
      <div className="mt-8 mb-4 max-w-md mx-auto">
        <Select
          value={selectedCollection}
          onValueChange={(value) => setSelectedCollection(value as StickerCollection)}
        >
          <SelectTrigger className="w-full">
            <SelectValue placeholder="Select a collection" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="100DevsTwitch">100 Devs Twitch Collection</SelectItem>
            <SelectItem value="100DevsDiscord">100 Devs Discord Collection</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {/* Style the collection sections */}
      <div className="space-y-8 mt-8">
        {/* Twitch Collection */}
        <Card className="w-full">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <svg className="w-5 h-5 text-purple-500" viewBox="0 0 24 24" fill="currentColor">
                <path d="M11.571 4.714h1.715v5.143H11.57zm4.715 0H18v5.143h-1.714zM6 0L1.714 4.286v15.428h5.143V24l4.286-4.286h3.428L22.286 12V0zm14.571 11.143l-3.428 3.428h-3.429l-3 3v-3H6.857V1.714h13.714Z"/>
              </svg>
              100 Devs Twitch Collection
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-4">
              {stickers
                // Show all stickers in Twitch collection for now
                .filter(sticker => !sticker.collection || sticker.collection === '100DevsTwitch')
                .map(sticker => (
                  <div 
                    key={sticker.$id}
                    className="flex flex-col items-center gap-2"
                    onClick={() => {
                      if (checkIfUnlocked(sticker.$id) && STICKER_SOUND_MAP[sticker.name]) {
                        playStickersSequentially([sticker.name]);
                      }
                    }}
                    style={{ cursor: checkIfUnlocked(sticker.$id) && STICKER_SOUND_MAP[sticker.name] ? 'pointer' : 'default' }}
                  >
                    <div 
                      className={`
                        aspect-square rounded-lg p-2 
                        flex items-center justify-center
                        ${checkIfUnlocked(sticker.$id) 
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
                          ${checkIfUnlocked(sticker.$id) 
                            ? 'opacity-100' 
                            : 'opacity-30 grayscale'
                          }
                          transition-opacity duration-300
                        `}
                      />
                      {!checkIfUnlocked(sticker.$id) && (
                        <div className="absolute inset-0 flex items-center justify-center bg-background/5 rounded-lg">
                          <Lock className="w-4 h-4 text-muted-foreground" />
                        </div>
                      )}
                    </div>
                    <span className={`
                      text-xs text-center truncate w-full
                      ${checkIfUnlocked(sticker.$id) ? 'text-gray-700' : 'text-gray-400'}
                    `}>
                      {sticker.name.replace('.png', '').split('-').join(' ')}
                    </span>
                  </div>
                ))}
            </div>
          </CardContent>
        </Card>

        {/* Discord Collection */}
        <Card className="w-full">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <svg className="w-5 h-5 text-indigo-500" viewBox="0 0 24 24" fill="currentColor">
                <path d="M20.317 4.37a19.791 19.791 0 0 0-4.885-1.515a.074.074 0 0 0-.079.037c-.21.375-.444.864-.608 1.25a18.27 18.27 0 0 0-5.487 0a12.64 12.64 0 0 0-.617-1.25a.077.077 0 0 0-.079-.037A19.736 19.736 0 0 0 3.677 4.37a.07.07 0 0 0-.032.027C.533 9.046-.32 13.58.099 18.057a.082.082 0 0 0 .031.057a19.9 19.9 0 0 0 5.993 3.03a.078.078 0 0 0 .084-.028a14.09 14.09 0 0 0 1.226-1.994a.076.076 0 0 0-.041-.106a13.107 13.107 0 0 1-1.872-.892a.077.077 0 0 1-.008-.128a10.2 10.2 0 0 0 .372-.292a.074.074 0 0 1 .077-.01c3.928 1.793 8.18 1.793 12.062 0a.074.074 0 0 1 .078.01c.12.098.246.198.373.292a.077.077 0 0 1-.006.127a12.299 12.299 0 0 1-1.873.892a.077.077 0 0 0-.041.107c.36.698.772 1.362 1.225 1.993a.076.076 0 0 0 .084.028a19.839 19.839 0 0 0 6.002-3.03a.077.077 0 0 0 .032-.054c.5-5.177-.838-9.674-3.549-13.66a.061.061 0 0 0-.031-.03zM8.02 15.33c-1.183 0-2.157-1.085-2.157-2.419c0-1.333.956-2.419 2.157-2.419c1.21 0 2.176 1.096 2.157 2.42c0 1.333-.956 2.418-2.157 2.418zm7.975 0c-1.183 0-2.157-1.085-2.157-2.419c0-1.333.955-2.419 2.157-2.419c1.21 0 2.176 1.096 2.157 2.42c0 1.333-.946 2.418-2.157 2.418z"/>
              </svg>
              100 Devs Discord Collection
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-4">
              {stickers
                .filter(sticker => sticker.collection === '100DevsDiscord')
                .map(sticker => (
                  <div 
                    key={sticker.$id}
                    className="flex flex-col items-center gap-2"
                    onClick={() => {
                      if (checkIfUnlocked(sticker.$id) && STICKER_SOUND_MAP[sticker.name]) {
                        playStickersSequentially([sticker.name]);
                      }
                    }}
                    style={{ cursor: checkIfUnlocked(sticker.$id) && STICKER_SOUND_MAP[sticker.name] ? 'pointer' : 'default' }}
                  >
                    <div 
                      className={`
                        aspect-square rounded-lg p-2 
                        flex items-center justify-center
                        ${checkIfUnlocked(sticker.$id) 
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
                          ${checkIfUnlocked(sticker.$id) 
                            ? 'opacity-100' 
                            : 'opacity-30 grayscale'
                          }
                          transition-opacity duration-300
                        `}
                      />
                      {!checkIfUnlocked(sticker.$id) && (
                        <div className="absolute inset-0 flex items-center justify-center bg-background/5 rounded-lg">
                          <Lock className="w-4 h-4 text-muted-foreground" />
                        </div>
                      )}
                    </div>
                    <span className={`
                      text-xs text-center truncate w-full
                      ${checkIfUnlocked(sticker.$id) ? 'text-gray-700' : 'text-gray-400'}
                    `}>
                      {sticker.name.replace('.png', '').split('-').join(' ')}
                    </span>
                  </div>
                ))}
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
