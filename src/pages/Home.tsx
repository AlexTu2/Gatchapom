import { useState, useEffect, useCallback, useRef, useMemo } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useUser } from "../lib/context/user";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { databases, DATABASE_ID, account } from "../lib/appwrite";
import { useTimer } from "@/lib/context/timer";
import { ScrollArea } from "@/components/ui/scroll-area";
import { ChevronDown } from "lucide-react";
import { StickerPicker } from "@/components/StickerPicker";
import { useStickers } from '@/lib/hooks/useStickers';
import { cn } from "@/lib/utils";
import { storage } from '@/lib/appwrite';
import * as audio from '@/lib/audio';
import { useAudio } from "@/lib/context/audio";
import { ID, Query, Client } from "appwrite";
import { YouTubeAudioPlayer } from '@/components/YouTubeAudioPlayer';
import { motion } from "framer-motion";
import { useScroll } from "framer-motion";
import { MICRO_LEON_STICKER_ID } from '../config/constants';

// Define interfaces
type TimerMode = 'work' | 'shortBreak' | 'longBreak';

interface TimerSettings {
  work: number;
  shortBreak: number;
  longBreak: number;
  longBreakInterval: number;
  currentMode: TimerMode;
}

// Create a custom hook for timer logic
function useTimerLogic(settings: TimerSettings, isDevMode: boolean, mode: TimerMode) {
  const { volume } = useAudio();
  const [timeLeft, setTimeLeft] = useState(settings[mode] * (isDevMode ? 1 : 60));
  const [isActive, setIsActive] = useState(false);
  const [isRunning, setIsRunning] = useState(false);
  const [completedPomodoros, setCompletedPomodoros] = useState(0);
  const alarmSound = useRef<HTMLAudioElement | null>(null);
  const [isAudioLoaded, setIsAudioLoaded] = useState(false);

  // Initialize and load audio once
  useEffect(() => {
    const loadAudio = async () => {
      if (alarmSound.current) {
        alarmSound.current.volume = volume;
        return;
      }

      try {
        // Get audio URL directly from storage
        const audioUrl = storage.getFileView(audio.AUDIO_BUCKET_ID, 'alarm');
        
        if (audioUrl) {
          const audioElement = new Audio(audioUrl.toString());
          audioElement.volume = volume; // Set initial volume
          
          // Set up event listeners
          audioElement.addEventListener('canplaythrough', () => {
            console.log('Audio loaded successfully');
            setIsAudioLoaded(true);
          });

          audioElement.addEventListener('error', (e) => {
            console.error('Audio loading error:', e);
            // Fallback to local file if Appwrite fails
            const localAudio = new Audio('/alarm.wav');
            localAudio.volume = volume; // Set volume for fallback audio
            localAudio.addEventListener('canplaythrough', () => {
              console.log('Local audio loaded successfully');
              setIsAudioLoaded(true);
            });
            alarmSound.current = localAudio;
          });

          // Store the audio element in the ref
          alarmSound.current = audioElement;
          audioElement.load();
        }
      } catch (error) {
        console.error('Failed to load audio:', error);
        // Fallback to local file
        const localAudio = new Audio('/alarm.wav');
        localAudio.volume = volume; // Set volume for fallback audio
        localAudio.addEventListener('canplaythrough', () => {
          console.log('Local audio loaded successfully');
          setIsAudioLoaded(true);
        });
        alarmSound.current = localAudio;
        localAudio.load();
      }
    };

    loadAudio();

    // Cleanup
    return () => {
      if (alarmSound.current) {
        alarmSound.current.pause();
        alarmSound.current = null;
      }
    };
  }, [volume]); // Add volume to dependencies

  // Handle timer completion
  useEffect(() => {
    if (timeLeft === 0 && isActive && isAudioLoaded && alarmSound.current) {
      setIsActive(false);
      setIsRunning(false);
      
      // Ensure volume is set before playing
      alarmSound.current.volume = volume;
      alarmSound.current.currentTime = 0;
      alarmSound.current.play().catch(error => {
        console.error('Failed to play alarm sound:', error);
      });
      
      if (mode === 'work') {
        setCompletedPomodoros(prev => prev + 1);
      }
    }
  }, [timeLeft, isActive, mode, isAudioLoaded, volume]);

  const resetTimer = useCallback(() => {
    setIsActive(false);
    setIsRunning(false);
    setTimeLeft(settings[mode] * (isDevMode ? 1 : 60));
    // Stop alarm if it's playing
    if (alarmSound.current) {
      alarmSound.current.pause();
      alarmSound.current.currentTime = 0;
    }
  }, [settings, mode, isDevMode]);

  const toggleTimer = useCallback(() => {
    setIsActive(prev => !prev);
    setIsRunning(prev => !prev);
  }, []);

  // Update timeLeft when settings or mode changes
  useEffect(() => {
    setIsActive(false);
    setIsRunning(false);
    setTimeLeft(settings[mode] * (isDevMode ? 1 : 60));
  }, [mode, settings, isDevMode]);

  // Timer countdown logic
  useEffect(() => {
    let interval: NodeJS.Timeout;

    if (isActive && timeLeft > 0) {
      interval = setInterval(() => {
        setTimeLeft(time => time - 1);
      }, 1000);
    }

    return () => clearInterval(interval);
  }, [isActive, timeLeft]);

  // In the useTimerLogic hook, update the volume when it changes
  useEffect(() => {
    if (alarmSound.current) {
      alarmSound.current.volume = volume;
    }
  }, [volume]);

  return {
    timeLeft,
    setTimeLeft,
    isRunning,
    setIsRunning,
    completedPomodoros,
    setCompletedPomodoros,
    resetTimer,
    toggleTimer,
    alarmSound
  };
}

// Create a custom hook for mode transition logic
function useModeTransition() {
  const { setMode } = useTimer();
  const user = useUser();

  const handleModeChange = useCallback(async (newMode: TimerMode) => {
    setMode(newMode);
  }, [setMode]);

  const awardMicroLeons = useCallback(async (amount: number) => {
    if (!user?.current?.$id) return;
    
    try {
      // Get fresh user data first
      const currentUser = await account.get();
      const currentLeons = Number(currentUser.prefs.microLeons) || 0;
      const newLeons = currentLeons + amount;
      
      // Preserve all existing preferences while updating microLeons
      const updatedPrefs = {
        ...currentUser.prefs,  // Keep all existing preferences
        microLeons: newLeons.toString()
      };

      // Update preferences with merged object
      await account.updatePrefs(updatedPrefs);

      // Verify the update
      const verifyUser = await account.get();
      console.log('MicroLeons update:', {
        before: currentLeons,
        awarded: amount,
        after: Number(verifyUser.prefs.microLeons),
        currentPrefs: verifyUser.prefs
      });

      // Update the user context with the new prefs
      user.updateUser(verifyUser.prefs);

    } catch (error) {
      console.error('Error awarding micro leons:', error);
    }
  }, [user]);

  return {
    handleModeChange,
    awardMicroLeons
  };
}

// Create a proper Message type that extends Models.Document
interface AppwriteMessage {
  $id: string;
  $collectionId: string;
  $databaseId: string;
  $createdAt: string;
  $updatedAt: string;
  $permissions: string[];
  content: string;
  userId: string;
  userName: string;
  userAvatar?: string;
  createdAt: string;
  type: 'text' | 'sticker';
}

// Create a custom hook for chat functionality
function useChat(
  user: ReturnType<typeof useUser>, 
  mode: TimerMode,
  unlockedStickers: { [key: string]: number }
) {
  const [messages, setMessages] = useState<AppwriteMessage[]>([]);
  const [newMessage, setNewMessage] = useState("");
  const [cursorPosition, setCursorPosition] = useState<number>(0);
  const [showScrollButton, setShowScrollButton] = useState(false);
  const [isNearBottom, setIsNearBottom] = useState(true);
  const scrollAreaRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const scrollToBottom = useCallback(() => {
    if (scrollAreaRef.current) {
      const scrollContainer = scrollAreaRef.current.querySelector('[data-radix-scroll-area-viewport]');
      if (scrollContainer) {
        scrollContainer.scrollTop = scrollContainer.scrollHeight;
      }
    }
  }, []);

  const handleScroll = useCallback(() => {
    if (scrollAreaRef.current) {
      const scrollContainer = scrollAreaRef.current.querySelector('[data-radix-scroll-area-viewport]');
      if (scrollContainer) {
        const { scrollTop, scrollHeight, clientHeight } = scrollContainer;
        const isBottom = scrollHeight - scrollTop - clientHeight < 100;
        setIsNearBottom(isBottom);
      }
    }
  }, []);

  const loadMessages = useCallback(async () => {
    try {
      const response = await databases.listDocuments<AppwriteMessage>(
        DATABASE_ID,
        'messages',
        [
          Query.orderDesc('createdAt'),
          Query.limit(50)
        ]
      );
      setMessages(response.documents.reverse());
    } catch (error) {
      console.error('Error loading messages:', error);
    }
  }, []);

  const insertSticker = useCallback((sticker: string) => {
    if (cursorPosition === null) return;
    
    const stickerText = `:${sticker}:`;
    const before = newMessage.slice(0, cursorPosition);
    const after = newMessage.slice(cursorPosition);
    const updatedMessage = before + stickerText + after;
    setNewMessage(updatedMessage);
    
    // Update cursor position after sticker
    const newPosition = cursorPosition + stickerText.length;
    setCursorPosition(newPosition);
    
    // Focus input and set cursor position
    setTimeout(() => {
      if (inputRef.current) {
        inputRef.current.focus();
        inputRef.current.setSelectionRange(newPosition, newPosition);
      }
    }, 0);
  }, [newMessage, cursorPosition]);

  const handleInputChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    setNewMessage(e.target.value);
    setCursorPosition(e.target.selectionStart || 0);
  }, []);

  const sendMessage = useCallback(async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newMessage.trim() || !user.current) return;

    try {
      const content = newMessage.trim();
      
      // Check if message contains stickers and validate permissions
      const stickerMatches = content.match(/(:[\w-]+:)/g);
      if (stickerMatches) {
        for (const match of stickerMatches) {
          const stickerName = match.replace(/:/g, '') + '.png';
          if (!(unlockedStickers[stickerName] > 0)) {
            // Show error message in the input
            setNewMessage(`You haven't unlocked the ${stickerName} sticker yet! Visit the store to unlock it.`);
            if (inputRef.current) {
              inputRef.current.select(); // Select the text so user can easily delete it
            }
            return;
          }
        }
      }
      
      await databases.createDocument(
        DATABASE_ID,
        'messages',
        ID.unique(),
        {
          content,
          userId: user.current.$id,
          userName: user.current.name,
          userAvatar: user.current.prefs.avatarUrl,
          createdAt: new Date().toISOString(),
        }
      );
      setNewMessage("");
      setCursorPosition(0);
    } catch (error) {
      console.error('Error sending message:', error);
    }
  }, [newMessage, user.current, unlockedStickers]);

  // Move WebSocket setup to a top-level useEffect
  useEffect(() => {
    let wsClient: Client | null = null;
    let unsubscribe: (() => void) | null = null;
    let reconnectTimeout: NodeJS.Timeout;

    const setupWebSocket = async () => {
      try {
        if (wsClient) {
          // Check if disconnect method exists before calling
          if (typeof wsClient.disconnect === 'function') {
            wsClient.disconnect();
          }
        }

        wsClient = new Client()
          .setEndpoint('https://cloud.appwrite.io/v1')
          .setProject(import.meta.env.VITE_APPWRITE_PROJECT_ID);

        // Clean up any existing subscription
        if (unsubscribe) {
          unsubscribe();
          unsubscribe = null;
        }

        // Set up new subscription
        unsubscribe = wsClient.subscribe([
          `databases.${DATABASE_ID}.collections.messages.documents`
        ], response => {
          if (response.events.includes('databases.*.collections.*.documents.*.create')) {
            const newMessage = response.payload as AppwriteMessage;
            setMessages(prev => [...prev, newMessage]);
            
            if (isNearBottom) {
              setTimeout(scrollToBottom, 100);
            } else {
              setShowScrollButton(true);
            }
          }
        });

      } catch (error) {
        console.error('WebSocket connection error:', error);
        // Attempt to reconnect after 5 seconds
        reconnectTimeout = setTimeout(setupWebSocket, 5000);
      }
    };

    setupWebSocket();

    // Cleanup function
    return () => {
      if (reconnectTimeout) {
        clearTimeout(reconnectTimeout);
      }
      if (unsubscribe) {
        unsubscribe();
      }
      if (wsClient && typeof wsClient.disconnect === 'function') {
        wsClient.disconnect();
      }
    };
  }, []); // Empty dependency array since we want this to run once

  // Separate useEffect for loading messages when entering break mode
  useEffect(() => {
    if (mode === 'shortBreak' || mode === 'longBreak') {
      loadMessages();
    }
  }, [mode, loadMessages]);

  // Auto-scroll chat when new messages arrive
  useEffect(() => {
    if (isNearBottom) {
      setTimeout(scrollToBottom, 100);
    } else {
      setShowScrollButton(true);
    }
  }, [messages, isNearBottom, scrollToBottom]);

  useEffect(() => {
    console.log('Current messages:', messages);
    console.log('Current user:', user.current);
    console.log('Current unlockedStickers:', unlockedStickers);
  }, [messages, user.current, unlockedStickers]);

  return {
    messages,
    newMessage,
    setNewMessage,
    cursorPosition,
    setCursorPosition: (pos: number) => {
      setCursorPosition(pos);
    },
    showScrollButton,
    isNearBottom,
    scrollAreaRef,
    scrollToBottom,
    handleScroll,
    sendMessage,
    setShowScrollButton,
    insertSticker,
    handleInputChange,
    inputRef
  };
}

// Create a custom hook for settings management
function useSettings() {
  const { settings, updateSettings } = useTimer();
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);

  const saveSettings = useCallback(async (newSettings: TimerSettings) => {
    try {
      await updateSettings(newSettings);
    } catch (error) {
      console.error('Error saving settings:', error);
    }
  }, [updateSettings]);

  return {
    settings,
    setSettings: updateSettings,
    isSettingsLoading: false,
    isSettingsOpen,
    setIsSettingsOpen,
    saveSettings
  };
}

function MessageContent({ content, isOwnMessage }: { content: string, isOwnMessage: boolean }) {
  const { getStickerUrl, getStickerId } = useStickers();

  // Split content by sticker pattern (:stickername:)
  const parts = content.split(/(:[\w-]+:)/g);

  return (
    <div className={cn(
      "rounded-lg px-3 py-2 text-sm",
      isOwnMessage ? "bg-primary text-primary-foreground" : "bg-muted"
    )}>
      {parts.map((part, index) => {
        // Check if this part matches sticker pattern
        const stickerMatch = part.match(/^:([\w-]+):$/);
        
        if (stickerMatch) {
          const stickerName = stickerMatch[1];
          const stickerId = getStickerId(`${stickerName}.png`);
          
          // If sticker exists, show the image
          if (stickerId) {
            return (
              <img 
                key={index}
                src={getStickerUrl(stickerId)}
                alt={`:${stickerName}:`}
                className="inline-block h-6 w-6 align-middle"
                onError={(e) => {
                  console.error('Failed to load sticker:', stickerName);
                  e.currentTarget.style.display = 'none';
                }}
              />
            );
          }
          
          // If sticker doesn't exist, show the text
          return <span key={index}>{part}</span>;
        }
        
        // Regular text
        return <span key={index}>{part}</span>;
      })}
    </div>
  );
}

// Add this hook at the top with other hooks
function useUnlockedStickers(user: ReturnType<typeof useUser>, stickers: { $id: string, name: string }[]) {
  return useMemo(() => {
    try {
      const parsed = JSON.parse(user.current?.prefs.unlockedStickers || '{}');
      // Handle old array format
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
}

export function Home() {
  const user = useUser();
  const { mode } = useTimer();
  const [isDevMode, setIsDevMode] = useState(() => {
    const saved = localStorage.getItem('isDevMode');
    return saved ? JSON.parse(saved) : false;
  });
  const [showCompletionDialog, setShowCompletionDialog] = useState(false);
  const { getStickerUrl, stickers } = useStickers();

  const {
    settings,
    setSettings,
    isSettingsLoading,
    isSettingsOpen,
    setIsSettingsOpen
  } = useSettings();

  const {
    timeLeft,
    setTimeLeft,
    isRunning,
    setIsRunning,
    completedPomodoros,
    setCompletedPomodoros,
    resetTimer,
    toggleTimer
  } = useTimerLogic(settings, isDevMode, mode);

  const { handleModeChange, awardMicroLeons } = useModeTransition();

  const parsedUnlockedStickers = useUnlockedStickers(user, stickers);

  // Pass the parsed stickers to useChat
  const chat = useChat(user, mode, parsedUnlockedStickers);

  // Find microLeon sticker ID
  const microLeonSticker = useMemo(() => ({
    $id: MICRO_LEON_STICKER_ID,
    name: 'microLeon.png'
  }), []); // Simplified since we know the ID

  // Add a ref to track if we're currently processing a completion
  const isProcessingCompletion = useRef(false);

  // Timer completion effect
  useEffect(() => {
    if (timeLeft === 0 && isRunning) {
      if (isProcessingCompletion.current) return;
      isProcessingCompletion.current = true;

      const handleCompletion = async () => {
        try {
          if (mode === 'work') {
            const newCompletedPomodoros = completedPomodoros + 1;
            // Award micro leons immediately
            const reward = newCompletedPomodoros % settings.longBreakInterval === 0 ? 50 : 10;
            await awardMicroLeons(reward);
            
            setCompletedPomodoros(newCompletedPomodoros);
            setShowCompletionDialog(true);
          } else {
            handleModeChange('work');
            setTimeLeft(settings.work * (isDevMode ? 1 : 60));
            setIsRunning(false);
          }
        } finally {
          // Reset processing flag after a short delay
          setTimeout(() => {
            isProcessingCompletion.current = false;
          }, 100);
        }
      };

      handleCompletion();
    }
  }, [timeLeft, mode, completedPomodoros, settings, isDevMode, showCompletionDialog, handleModeChange, setTimeLeft, setIsRunning, awardMicroLeons]);

  // Simplified handleCompletionDismiss
  const handleCompletionDismiss = useCallback(async () => {
    if (isProcessingCompletion.current) return;
    isProcessingCompletion.current = true;
    
    try {
      setShowCompletionDialog(false);
      if (mode === 'work') {
        const nextMode = completedPomodoros % settings.longBreakInterval === 0 ? 'longBreak' : 'shortBreak';
        handleModeChange(nextMode);
        setTimeLeft(settings[nextMode] * (isDevMode ? 1 : 60));
        setIsRunning(false);
      }
    } finally {
      isProcessingCompletion.current = false;
    }
  }, [completedPomodoros, settings, mode, isDevMode, handleModeChange, setTimeLeft, setIsRunning]);

  const formatTime = useCallback((seconds: number, isMessageTime?: boolean): string => {
    if (isMessageTime) {
      const date = new Date(seconds * 1000);
      return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    }
    
    if (isDevMode) {
      return seconds.toString().padStart(2, '0');
    }
    const minutes = Math.floor(seconds / 60);
    const remainingSeconds = seconds % 60;
    return `${minutes.toString().padStart(2, '0')}:${remainingSeconds.toString().padStart(2, '0')}`;
  }, [isDevMode]);

  // Add effect to save changes
  useEffect(() => {
    localStorage.setItem('isDevMode', JSON.stringify(isDevMode));
  }, [isDevMode]);

  const { scrollY } = useScroll();
  const [isScrolled, setIsScrolled] = useState(false);

  useEffect(() => {
    return scrollY.onChange((latest) => {
      setIsScrolled(latest > 100);
    });
  }, [scrollY]);

  // Don't render until everything is loaded
  if (isSettingsLoading) {
    return null;
  }

  return (
    <div className="container mx-auto px-4 py-8">
      <div className="flex gap-8">
        <div className="relative w-full max-w-md">
          <motion.div
            className={cn(
              "w-full transition-all duration-300 ease-in-out",
              isScrolled ? "sticky top-24" : "relative"
            )}
            initial={false} // Prevent initial animation
            animate={{ 
              opacity: 1,
              scale: isScrolled ? 0.95 : 1,
            }}
            transition={{
              type: "spring",
              stiffness: 100, // Reduced stiffness for smoother motion
              damping: 30,    // Increased damping to reduce bounce
              mass: 0.5       // Lighter mass for quicker response
            }}
          >
            <Card className="max-w-2xl mx-auto">
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-4">
                <CardTitle className="text-2xl font-bold">
                  Pomodoro Timer
                </CardTitle>
                <div className="flex items-center gap-2">
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => setIsDevMode(!isDevMode)}
                    className="text-muted-foreground hover:text-foreground"
                  >
                    {isDevMode ? '🐛 Dev' : '⏰ Normal'}
                  </Button>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => setIsSettingsOpen(!isSettingsOpen)}
                    className="text-muted-foreground hover:text-foreground"
                  >
                    ⚙️ Settings
                  </Button>
                </div>
              </CardHeader>
              
              <CardContent>
                {isSettingsOpen ? (
                  // Settings Panel
                  <div className="space-y-6">
                    <div className="grid gap-4">
                      {Object.entries(settings).map(([key, value]) => (
                        key !== 'currentMode' && (
                          <div key={key} className="space-y-2">
                            <Label 
                              htmlFor={key}
                              className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70"
                            >
                              {key.replace(/([A-Z])/g, ' $1').replace(/^./, str => str.toUpperCase())} 
                              <span className="text-muted-foreground ml-1">
                                ({isDevMode ? 'seconds' : 'minutes'})
                              </span>
                            </Label>
                            <Input
                              id={key}
                              type="number"
                              min="1"
                              max={isDevMode ? 300 : 60}
                              value={value}
                              onChange={(e) => {
                                const newValue = parseInt(e.target.value);
                                const maxValue = isDevMode ? 300 : 60;
                                if (newValue > 0 && newValue <= maxValue) {
                                  setSettings({ ...settings, [key]: newValue });
                                }
                              }}
                              className="h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-sm transition-colors"
                            />
                          </div>
                        )
                      ))}
                    </div>
                    <div className="flex justify-end space-x-2">
                      <Button 
                        variant="outline"
                        onClick={() => setIsSettingsOpen(false)}
                      >
                        Cancel
                      </Button>
                      <Button 
                        onClick={() => {
                          setSettings(settings);
                          setIsSettingsOpen(false);
                        }}
                        variant="default"
                      >
                        Save Settings
                      </Button>
                    </div>
                  </div>
                ) : (
                  // Timer Display
                  <div className="space-y-8">
                    {/* Mode Selection Buttons */}
                    <div className="flex justify-center gap-2">
                      {(['work', 'shortBreak', 'longBreak'] as TimerMode[]).map((timerMode) => (
                        <Button
                          key={timerMode}
                          onClick={() => handleModeChange(timerMode)}
                          variant={mode === timerMode ? "default" : "outline"}
                          className={cn(
                            "min-w-[120px] transition-all duration-200",
                            mode === timerMode && "shadow-md",
                            mode === 'work' && timerMode === 'work' && "bg-destructive text-destructive-foreground hover:bg-destructive/90",
                            mode === 'shortBreak' && timerMode === 'shortBreak' && "bg-emerald-500 text-white hover:bg-emerald-600",
                            mode === 'longBreak' && timerMode === 'longBreak' && "bg-blue-500 text-white hover:bg-blue-600"
                          )}
                        >
                          {timerMode.replace(/([A-Z])/g, ' $1').replace(/^./, str => str.toUpperCase())}
                        </Button>
                      ))}
                    </div>

                    {/* Timer Display */}
                    <div className="text-center">
                      <div className={cn(
                        "text-7xl font-bold mb-8 p-12 rounded-2xl transition-all duration-300",
                        "font-mono tracking-tight",
                        "shadow-lg backdrop-blur-sm",
                        mode === 'work' && "bg-red-500/10 text-red-500",
                        mode === 'shortBreak' && "bg-green-500/10 text-green-500",
                        mode === 'longBreak' && "bg-blue-500/10 text-blue-500"
                      )}>
                        {formatTime(timeLeft)}
                      </div>

                      {/* Control Buttons */}
                      <div className="flex justify-center gap-4">
                        <Button
                          onClick={toggleTimer}
                          variant="default"
                          size="lg"
                          className={cn(
                            "min-w-[120px] transition-all duration-200",
                            isRunning ? "bg-orange-500 hover:bg-orange-600" : "bg-green-500 hover:bg-green-600",
                            "shadow-lg"
                          )}
                        >
                          {isRunning ? 'Pause' : 'Start'}
                        </Button>
                        <Button
                          onClick={resetTimer}
                          variant="outline"
                          size="lg"
                          className="min-w-[120px] hover:bg-destructive hover:text-destructive-foreground"
                        >
                          Reset
                        </Button>
                      </div>

                      {/* Progress Display */}
                      <div className="mt-8 flex items-center justify-center gap-2">
                        <span className="text-sm text-muted-foreground">
                          Completed Pomodoros:
                        </span>
                        <span className="text-sm font-medium bg-accent/10 px-2 py-1 rounded">
                          {completedPomodoros}
                        </span>
                      </div>
                    </div>
                  </div>
                )}
              </CardContent>
            </Card>
          </motion.div>
        </div>

        <div className="flex-1">
          <YouTubeAudioPlayer />
          
          {/* Move chat below the player when in break mode */}
          {(mode === 'shortBreak' || mode === 'longBreak') && (
            <Card className="mt-8">
              <CardHeader>
                <CardTitle className="text-2xl font-bold">Chat Room</CardTitle>
              </CardHeader>
              <CardContent className="relative">
                <ScrollArea 
                  className="h-[500px] pr-4 mb-4"
                  ref={chat.scrollAreaRef}
                  onScrollCapture={chat.handleScroll}
                >
                  <div className="space-y-4">
                    {chat.messages.map((message) => (
                      <div 
                        key={message.$id}
                        className={`flex items-start gap-3 ${
                          message.userId === user.current?.$id ? 'flex-row-reverse' : ''
                        }`}
                      >
                        <div className="w-8 h-8 rounded-full bg-gray-200 flex items-center justify-center overflow-hidden">
                          {message.userAvatar ? (
                            <img 
                              src={message.userAvatar} 
                              alt={message.userName}
                              className="w-full h-full object-cover"
                            />
                          ) : (
                            <span className="text-sm font-medium">
                              {message.userName.charAt(0).toUpperCase()}
                            </span>
                          )}
                        </div>
                        <div className={`max-w-[70%] ${
                          message.userId === user.current?.$id ? 'text-right' : ''
                        }`}>
                          <div className="flex items-center gap-2">
                            <span className="font-semibold">{message.userName}</span>
                            <span className="text-xs text-muted-foreground">
                              {formatTime(new Date(message.createdAt).getTime() / 1000, true)}
                            </span>
                          </div>
                          <MessageContent 
                            content={message.content} 
                            isOwnMessage={message.userId === user.current?.$id}
                          />
                        </div>
                      </div>
                    ))}
                  </div>
                </ScrollArea>

                {chat.showScrollButton && !chat.isNearBottom && (
                  <Button
                    size="icon"
                    variant="secondary"
                    className="absolute bottom-16 right-8 rounded-full w-8 h-8 shadow-md"
                    onClick={() => {
                      chat.scrollToBottom();
                      chat.setShowScrollButton(false);
                    }}
                  >
                    <ChevronDown className="h-4 w-4" />
                  </Button>
                )}

                <form onSubmit={chat.sendMessage} className="flex items-center gap-2">
                  <StickerPicker 
                    unlockedStickers={parsedUnlockedStickers}
                    onStickerSelect={chat.insertSticker}
                  />
                  <Input 
                    ref={chat.inputRef}
                    placeholder="Type your message... Use stickers with the picker!" 
                    value={chat.newMessage}
                    onChange={chat.handleInputChange}
                    onSelect={(e) => {
                      const pos = e.currentTarget.selectionStart;
                      if (pos !== null) {
                        chat.setCursorPosition(pos);
                      }
                    }}
                    className="flex-1"
                  />
                  <Button type="submit">
                    Send
                  </Button>
                </form>
              </CardContent>
            </Card>
          )}
        </div>
      </div>

      <Dialog open={showCompletionDialog} onOpenChange={setShowCompletionDialog}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="text-2xl font-bold text-center bg-gradient-to-r from-green-500 to-emerald-500 bg-clip-text text-transparent">
              Pomodoro Complete! 🎉
            </DialogTitle>
            <DialogDescription className="text-center space-y-4 pt-4">
              <div className="text-lg font-medium">Great job! You've completed a work session.</div>
              <div className="font-medium text-yellow-500 dark:text-yellow-400 flex items-center justify-center gap-3 p-4 bg-yellow-50 dark:bg-yellow-950/30 rounded-lg">
                {microLeonSticker && (
                  <img 
                    src={getStickerUrl(microLeonSticker.$id)}
                    alt="Micro Leon" 
                    className="h-16 w-16 animate-bounce"
                  />
                )}
                <span className="text-lg">
                  You earned {completedPomodoros % settings.longBreakInterval === 0 ? '50' : '10'} micro leons!
                </span>
              </div>
            </DialogDescription>
          </DialogHeader>
          <div className="flex justify-center mt-4">
            <Button 
              onClick={handleCompletionDismiss}
              className="bg-gradient-to-r from-green-500 to-emerald-500 hover:from-green-600 hover:to-emerald-600 text-white shadow-lg"
            >
              Continue
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
