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
import { MICRO_LEON_STICKER_ID } from '../config/constants';

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
  const [selectedPack, setSelectedPack] = useState<StickerCollection>('100DevsTwitch');
  
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
        console.log('Loading sticker sounds...');
        for (const [stickerName, soundFile] of Object.entries(STICKER_SOUND_MAP)) {
          try {
            console.log(`Loading sound for ${stickerName}: ${soundFile}`);
            const soundUrl = storage.getFileView(AUDIO_BUCKET_ID, soundFile);
            const audio = new Audio(soundUrl.toString());
            
            stickerSounds.current[stickerName] = audio;
            
            await audio.load();
            console.log(`Successfully loaded sound for ${stickerName}`);
          } catch (error) {
            console.error(`Failed to load sound for ${stickerName}:`, error);
          }
        }
        setSoundsLoaded(true);
        console.log('All sounds loaded:', Object.keys(stickerSounds.current));
      } catch (error) {
        console.error('Error loading sticker sounds:', error);
      }
    };

    loadStickerSounds();
  }, [soundsLoaded]);

  const playStickersSequentially = useCallback(async (stickers: string[]) => {
    console.log('Playing stickers:', stickers);
    for (const stickerName of stickers) {
      console.log('Checking sticker:', stickerName, 'Sound mapping:', STICKER_SOUND_MAP[stickerName]);
      if (STICKER_SOUND_MAP[stickerName]) {
        await new Promise<void>((resolve) => {
          const audio = stickerSounds.current[stickerName];
          console.log('Audio object:', audio);
          if (audio) {
            setPlayingSticker(stickerName);
            audio.currentTime = 0;
            audio.volume = volume;
            audio.onended = () => {
              console.log('Audio ended');
              setPlayingSticker(null);
              resolve();
            };
            audio.play().catch(error => {
              console.error('Error playing sticker sound:', error);
              setPlayingSticker(null);
              resolve();
            });
          } else {
            console.log('No audio found for sticker');
            resolve();
          }
        });
      }
    }
  }, [volume]);

  // Parse unlocked stickers first
  const unlockedStickers = useMemo(() => {
    try {
      if (!user.current?.prefs.unlockedStickers) return {};
      
      const parsed = JSON.parse(user.current.prefs.unlockedStickers);
      console.log('Parsed unlockedStickers:', parsed);
      
      // If it's an array (old format), convert to object
      if (Array.isArray(parsed)) {
        const converted: { [key: string]: number } = {};
        parsed.forEach(stickerId => {
          const sticker = stickers.find(s => s.$id === stickerId);
          if (sticker) {
            converted[sticker.name] = (converted[sticker.name] || 0) + 1;
          }
        });
        return converted;
      }
      
      // Return parsed object if it's already in the new format
      return parsed;
    } catch (e) {
      console.error('Failed to parse unlockedStickers:', e);
      return {};
    }
  }, [user.current?.prefs.unlockedStickers, stickers]);

  // Then create the check function using the parsed data
  const checkIfUnlocked = useCallback((stickerId: string) => {
    const stickerFile = stickers.find(s => s.$id === stickerId);
    const count = stickerFile ? (unlockedStickers[stickerFile.name] || 0) : 0;
    return count > 0;
  }, [stickers, unlockedStickers]);

  const microLeonSticker = useMemo(() => ({
    $id: MICRO_LEON_STICKER_ID,
    name: 'microLeon.png',
    $createdAt: new Date().toISOString(),
    $updatedAt: new Date().toISOString()
  }), []);

  const openBoosterPack = useCallback(async () => {
    const totalCost = BOOSTER_PACK_COST * packCount;
    if (!user.current || microLeons < totalCost || !stickers.length) return;

    setIsOpening(true);
    
    try {
      // Select random stickers from the current pack
      const packStickers = stickers.filter(s => 
        s.pack === selectedPack || (!s.pack && selectedPack === '100DevsTwitch')
      );

      if (!packStickers.length) {
        console.error('No stickers available in this pack');
        return;
      }

      const selectedStickers = [];
      for (let i = 0; i < packCount; i++) {
        const randomSticker = packStickers[Math.floor(Math.random() * packStickers.length)];
        selectedStickers.push(randomSticker);
      }

      // Debug: Log initial state
      console.log('Initial state:', {
        currentUserPrefs: user.current.prefs,
        microLeons,
        selectedStickers: selectedStickers.map(s => s.name)
      });

      // Get current user to ensure we have latest prefs
      const currentUser = await account.get();
      console.log('Current user prefs:', currentUser.prefs);

      let currentUnlockedStickers;
      try {
        currentUnlockedStickers = JSON.parse(currentUser.prefs.unlockedStickers || '{}');
        if (Array.isArray(currentUnlockedStickers)) {
          // Convert old array format to new object format
          const converted: { [key: string]: number } = {};
          currentUnlockedStickers.forEach(stickerId => {
            const sticker = stickers.find(s => s.$id === stickerId);
            if (sticker) {
              converted[sticker.name] = (converted[sticker.name] || 0) + 1;
            }
          });
          currentUnlockedStickers = converted;
        }
      } catch (e) {
        console.error('Error parsing current unlocked stickers:', e);
        currentUnlockedStickers = {};
      }

      console.log('Current unlocked stickers:', currentUnlockedStickers);

      // Update the unlocked stickers list with new stickers
      selectedStickers.forEach(sticker => {
        currentUnlockedStickers[sticker.name] = (currentUnlockedStickers[sticker.name] || 0) + 1;
      });

      console.log('Updated unlocked stickers:', currentUnlockedStickers);

      const updatedPrefs = {
        microLeons: (microLeons - totalCost).toString(),
        unlockedStickers: JSON.stringify(currentUnlockedStickers)
      };

      // Update user preferences
      await user.updateUser(updatedPrefs);

      // Force a re-render of the sticker grid
      setOpenedStickers(selectedStickers);
      setShowReward(true);

      // Play sounds for new stickers
      await playStickersSequentially(selectedStickers.map(s => s.name));

      // Trigger confetti
      confetti({
        particleCount: 100 * packCount,
        spread: 70,
        origin: { y: 0.6 }
      });

    } catch (error) {
      console.error('Error opening booster pack:', error);
      alert('Failed to update preferences. Please try again.');
    } finally {
      setIsOpening(false);
    }
  }, [user, microLeons, stickers, packCount, selectedPack, playStickersSequentially]);

  const handleUpload = async () => {
    // Create a hidden file input
    const input = document.createElement('input');
    input.type = 'file';
    input.multiple = true;
    input.accept = '.png';

    input.onchange = async (e) => {
      if (!e.target || !(e.target as HTMLInputElement).files) return;
      
      const files = Array.from((e.target as HTMLInputElement).files!);
      console.log('Files selected:', files);

      if (isUploading) return;
      setIsUploading(true);
      
      try {
        await uploadStickers(files);
      } catch (error) {
        console.error('Upload failed:', error);
      } finally {
        setIsUploading(false);
      }
    };

    // Trigger file selection
    input.click();
  };

  // Handle dialog close
  const handleRewardClose = () => {
    setShowReward(false);
  };

  // Filter stickers by pack
  const twichStickers = useMemo(() => 
    stickers.filter(sticker => sticker.pack === '100DevsTwitch' || !sticker.pack),
    [stickers]
  );

  const discordStickers = useMemo(() => 
    stickers.filter(sticker => sticker.pack === '100DevsDiscord'),
    [stickers]
  );

  // Render a sticker grid section with icon
  const StickerGrid = useMemo(() => {
    const GridComponent = ({ 
      title, 
      stickers, 
      icon 
    }: { 
      title: string, 
      stickers: typeof twichStickers,
      icon: React.ReactNode 
    }) => (
      <Card className="w-full">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            {icon}
            {title}
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-4">
            {stickers.map((sticker) => {
              const isUnlocked = checkIfUnlocked(sticker.$id);
              const count = unlockedStickers[sticker.name] || 0;
              
              return (
                <div 
                  key={sticker.$id}
                  className="flex flex-col items-center gap-2"
                  onClick={() => {
                    console.log('Sticker clicked:', {
                      name: sticker.name,
                      isUnlocked,
                      hasSound: !!STICKER_SOUND_MAP[sticker.name],
                      playingSticker
                    });
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
                        ${isUnlocked ? 'opacity-100' : 'opacity-30 grayscale'}
                        transition-opacity duration-300
                      `}
                    />
                    {!isUnlocked && (
                      <div className="absolute inset-0 flex items-center justify-center bg-background/5 rounded-lg">
                        <Lock className="w-4 h-4 text-muted-foreground" />
                      </div>
                    )}
                    {count > 1 && (
                      <span className="absolute bottom-1 right-1 bg-primary text-primary-foreground rounded-full text-xs px-1 min-w-[1.25rem] text-center">
                        {count}
                      </span>
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
        </CardContent>
      </Card>
    );
    
    return GridComponent;
  }, [checkIfUnlocked, unlockedStickers, playStickersSequentially, playingSticker]);

  if (isLoading) {
    return <div>Loading stickers...</div>;
  }

  return (
    <div className="container mx-auto px-4 py-8">
      <Card className="w-full max-w-md mx-auto mb-8">
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
              
              <div className="flex justify-center gap-2 mb-4">
                <Button
                  variant={selectedPack === '100DevsTwitch' ? 'default' : 'outline'}
                  size="sm"
                  onClick={() => setSelectedPack('100DevsTwitch')}
                  className="flex items-center gap-2"
                >
                  <svg className="w-4 h-4 text-purple-500" viewBox="0 0 24 24" fill="currentColor">
                    <path d="M11.571 4.714h1.715v5.143H11.57zm4.715 0H18v5.143h-1.714zM6 0L1.714 4.286v15.428h5.143V24l4.286-4.286h3.428L22.286 12V0zm14.571 11.143l-3.428 3.428h-3.429l-3 3v-3H6.857V1.714h13.714Z"/>
                  </svg>
                  Twitch Pack
                </Button>
                <Button
                  variant={selectedPack === '100DevsDiscord' ? 'default' : 'outline'}
                  size="sm"
                  onClick={() => setSelectedPack('100DevsDiscord')}
                  className="flex items-center gap-2"
                >
                  <svg className="w-4 h-4 text-indigo-500" viewBox="0 0 24 24" fill="currentColor">
                    <path d="M20.317 4.37a19.791 19.791 0 0 0-4.885-1.515a.074.074 0 0 0-.079.037c-.21.375-.444.864-.608 1.25a18.27 18.27 0 0 0-5.487 0a12.64 12.64 0 0 0-.617-1.25a.077.077 0 0 0-.079-.037A19.736 19.736 0 0 0 3.677 4.37a.07.07 0 0 0-.032.027C.533 9.046-.32 13.58.099 18.057a.082.082 0 0 0 .031.057a19.9 19.9 0 0 0 5.993 3.03a.078.078 0 0 0 .084-.028a14.09 14.09 0 0 0 1.226-1.994a.076.076 0 0 0-.041-.106a13.107 13.107 0 0 1-1.872-.892a.077.077 0 0 1-.008-.128a10.2 10.2 0 0 0 .372-.292a.074.074 0 0 1 .077-.01c3.928 1.793 8.18 1.793 12.062 0a.074.074 0 0 1 .078.01c.12.098.246.198.373.292a.077.077 0 0 1-.006.127a12.299 12.299 0 0 1-1.873.892a.077.077 0 0 0-.041.107c.36.698.772 1.362 1.225 1.993a.076.076 0 0 0 .084.028a19.839 19.839 0 0 0 6.002-3.03a.077.077 0 0 0 .032-.054c.5-5.177-.838-9.674-3.549-13.66a.061.061 0 0 0-.031-.03z"/>
                  </svg>
                  Discord Pack
                </Button>
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
                {isOpening ? 'Opening...' : `Open ${selectedPack === '100DevsTwitch' ? 'Twitch' : 'Discord'} Booster Pack`}
              </Button>
            </div>

            {/* Commenting out Your Collection section for future use
            <div className="space-y-2">
              <h3 className="font-medium">Your Collection</h3>
              <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-4">
                {twichStickers.map((sticker) => {
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
                          <span className="absolute bottom-1 right-1 bg-primary text-primary-foreground rounded-full text-xs px-1 min-w-[1.25rem] text-center">
                            {count}
                          </span>
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
            */}
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

      {/* Sticker Collections */}
      <div className="space-y-8">
        <StickerGrid 
          title="100 Devs Twitch Collection" 
          stickers={twichStickers}
          icon={
            <svg className="w-5 h-5 text-purple-500" viewBox="0 0 24 24" fill="currentColor">
              <path d="M11.571 4.714h1.715v5.143H11.57zm4.715 0H18v5.143h-1.714zM6 0L1.714 4.286v15.428h5.143V24l4.286-4.286h3.428L22.286 12V0zm14.571 11.143l-3.428 3.428h-3.429l-3 3v-3H6.857V1.714h13.714Z"/>
            </svg>
          }
        />
        
        <StickerGrid 
          title="100 Devs Discord Collection" 
          stickers={discordStickers}
          icon={
            <svg className="w-5 h-5 text-indigo-500" viewBox="0 0 24 24" fill="currentColor">
              <path d="M20.317 4.37a19.791 19.791 0 0 0-4.885-1.515a.074.074 0 0 0-.079.037c-.21.375-.444.864-.608 1.25a18.27 18.27 0 0 0-5.487 0a12.64 12.64 0 0 0-.617-1.25a.077.077 0 0 0-.079-.037A19.736 19.736 0 0 0 3.677 4.37a.07.07 0 0 0-.032.027C.533 9.046-.32 13.58.099 18.057a.082.082 0 0 0 .031.057a19.9 19.9 0 0 0 5.993 3.03a.078.078 0 0 0 .084-.028a14.09 14.09 0 0 0 1.226-1.994a.076.076 0 0 0-.041-.106a13.107 13.107 0 0 1-1.872-.892a.077.077 0 0 1-.008-.128a10.2 10.2 0 0 0 .372-.292a.074.074 0 0 1 .077-.01c3.928 1.793 8.18 1.793 12.062 0a.074.074 0 0 1 .078.01c.12.098.246.198.373.292a.077.077 0 0 1-.006.127a12.299 12.299 0 0 1-1.873.892a.077.077 0 0 0-.041.107c.36.698.772 1.362 1.225 1.993a.076.076 0 0 0 .084.028a19.839 19.839 0 0 0 6.002-3.03a.077.077 0 0 0 .032-.054c.5-5.177-.838-9.674-3.549-13.66a.061.061 0 0 0-.031-.03zM8.02 15.33c-1.183 0-2.157-1.085-2.157-2.419c0-1.333.956-2.419 2.157-2.419c1.21 0 2.176 1.096 2.157 2.42c0 1.333-.956 2.418-2.157 2.418zm7.975 0c-1.183 0-2.157-1.085-2.157-2.419c0-1.333.955-2.419 2.157-2.419c1.21 0 2.176 1.096 2.157 2.42c0 1.333-.946 2.418-2.157 2.418z"/>
            </svg>
          }
        />
      </div>
    </div>
  );
}
