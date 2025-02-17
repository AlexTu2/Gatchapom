import { useState, useEffect, useCallback, useRef, useMemo } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useUser } from "../lib/context/user";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { databases, DATABASE_ID, account } from "../lib/appwrite";
import { ID, Query, Models } from "appwrite";
import { useTimer } from "@/lib/context/timer";
import { ScrollArea } from "@/components/ui/scroll-area";
import { ChevronDown } from "lucide-react";
import { Client } from "appwrite";
import { StickerPicker } from "@/components/StickerPicker";
import { useStickers } from '@/lib/hooks/useStickers';
import { cn } from "@/lib/utils";

// Define interfaces
type TimerMode = 'work' | 'shortBreak' | 'longBreak';

interface TimerSettings {
  work: number;
  shortBreak: number;
  longBreak: number;
  longBreakInterval: number;
}

const DEFAULT_SETTINGS: TimerSettings = {
  work: 25,
  shortBreak: 5,
  longBreak: 15,
  longBreakInterval: 4
};

// Create a custom hook for timer logic
function useTimerLogic(settings: TimerSettings, isDevMode: boolean, mode: TimerMode) {
  const [timeLeft, setTimeLeft] = useState(settings[mode] * (isDevMode ? 1 : 60));
  const [isActive, setIsActive] = useState(false);
  const [isRunning, setIsRunning] = useState(false);
  const [completedPomodoros, setCompletedPomodoros] = useState(0);
  const alarmSound = useRef(new Audio('/alarm.mp3'));

  // Add this effect to handle timer completion
  useEffect(() => {
    if (timeLeft === 0 && isActive) {
      setIsActive(false);
      setIsRunning(false);
      // Play the alarm sound
      alarmSound.current.play().catch(error => {
        console.error('Failed to play alarm sound:', error);
      });
      
      if (mode === 'work') {
        setCompletedPomodoros(prev => prev + 1);
      }
    }
  }, [timeLeft, isActive, mode]);

  // Add this effect to preload the audio
  useEffect(() => {
    // Preload the audio file
    alarmSound.current.load();
    
    // Clean up on unmount
    return () => {
      alarmSound.current.pause();
      alarmSound.current.currentTime = 0;
    };
  }, []);

  const resetTimer = useCallback(() => {
    setIsActive(false);
    setIsRunning(false);
    setTimeLeft(settings[mode] * (isDevMode ? 1 : 60));
    // Stop alarm if it's playing
    alarmSound.current.pause();
    alarmSound.current.currentTime = 0;
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
      
      // Update only the microLeons field
      await user.updateUser({
        microLeons: newLeons.toString()
      });

      // Verify the update
      const verifyUser = await account.get();
      console.log('MicroLeons update:', {
        before: currentLeons,
        awarded: amount,
        after: Number(verifyUser.prefs.microLeons)
      });

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

    // Create WebSocket connection immediately
    wsClient = new Client()
      .setEndpoint('https://cloud.appwrite.io/v1')
      .setProject(import.meta.env.VITE_APPWRITE_PROJECT_ID);
    
    try {
      // Subscribe with error handling
      unsubscribe = wsClient.subscribe([
        `databases.${DATABASE_ID}.collections.messages.documents`
      ], response => {
        if (response.events.includes('databases.*.collections.*.documents.*.create')) {
          const newMessage = response.payload as AppwriteMessage;
          setMessages(prev => [...prev, newMessage]);
        }
      });

      // Add error handler
      wsClient.subscribe('error', (error) => {
        console.error('WebSocket error:', error);
        // Attempt to reconnect
        if (unsubscribe) {
          unsubscribe();
          unsubscribe = wsClient?.subscribe([
            `databases.${DATABASE_ID}.collections.messages.documents`
          ], response => {
            if (response.events.includes('databases.*.collections.*.documents.*.create')) {
              const newMessage = response.payload as AppwriteMessage;
              setMessages(prev => [...prev, newMessage]);
            }
          });
        }
      });

    } catch (error) {
      console.error('Error setting up WebSocket:', error);
    }

    // Cleanup function
    return () => {
      if (unsubscribe) {
        try {
          unsubscribe();
        } catch (error) {
          console.error('Error cleaning up WebSocket:', error);
        }
      }
      wsClient = null;
    };
  }, []); // Empty dependency array means this runs once on mount

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
function useSettings(user: ReturnType<typeof useUser>) {
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
function useUnlockedStickers(user: ReturnType<typeof useUser>, stickers: Models.File[]) {
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
  const [isDevMode, setIsDevMode] = useState(() => localStorage.getItem('devMode') === 'true');
  const [showCompletionDialog, setShowCompletionDialog] = useState(false);
  const { getStickerUrl, stickers } = useStickers();
  const [isNearBottom, setIsNearBottom] = useState(true);
  const scrollAreaRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const {
    settings,
    setSettings,
    isSettingsLoading,
    isSettingsOpen,
    setIsSettingsOpen,
    saveSettings
  } = useSettings(user);

  const {
    timeLeft,
    setTimeLeft,
    isRunning,
    setIsRunning,
    completedPomodoros,
    setCompletedPomodoros,
    resetTimer,
    toggleTimer,
    alarmSound
  } = useTimerLogic(settings, isDevMode, mode);

  const { handleModeChange, awardMicroLeons } = useModeTransition();

  const parsedUnlockedStickers = useUnlockedStickers(user, stickers);

  // Pass the parsed stickers to useChat
  const chat = useChat(user, mode, parsedUnlockedStickers);

  // Find microLeon sticker ID
  const microLeonSticker = useMemo(() => ({
    $id: '67b27bbc001cba8f5ed9',
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

  // Don't render until everything is loaded
  if (isSettingsLoading) {
    return null;
  }

  return (
    <div className="container mx-auto px-4 py-8">
      <Card className="w-full max-w-md mx-auto">
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle className="text-2xl font-bold">Pomodoro Timer</CardTitle>
          <div className="flex items-center gap-2">
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setIsDevMode(!isDevMode)}
              className="text-xs"
            >
              {isDevMode ? '🐛 Dev' : '⏰ Normal'}
            </Button>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setIsSettingsOpen(!isSettingsOpen)}
            >
              ⚙️ Settings
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          {isSettingsOpen ? (
            <div className="space-y-4">
              {Object.entries(settings).map(([key, value]) => (
                key !== 'currentMode' && (
                  <div key={key} className="flex flex-col space-y-2">
                    <Label htmlFor={key}>
                      {key.replace(/([A-Z])/g, ' $1').replace(/^./, str => str.toUpperCase())} 
                      Duration ({isDevMode ? 'seconds' : 'minutes'})
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
                          const newSettings = { ...settings, [key]: newValue };
                          setSettings(newSettings);
                        }
                      }}
                    />
                  </div>
                )
              ))}
              <Button 
                className="w-full mt-4"
                onClick={() => {
                  saveSettings(settings);
                  setIsSettingsOpen(false);
                }}
              >
                Save Settings
              </Button>
            </div>
          ) : (
            <div className="space-y-6">
              <div className="flex justify-center space-x-4">
                {(['work', 'shortBreak', 'longBreak'] as TimerMode[]).map((timerMode) => (
                  <Button
                    key={timerMode}
                    onClick={() => handleModeChange(timerMode)}
                    variant={mode === timerMode ? "default" : "outline"}
                  >
                    {timerMode.replace(/([A-Z])/g, ' $1').replace(/^./, str => str.toUpperCase())}
                  </Button>
                ))}
              </div>

              <div className="text-center">
                <div className={`text-6xl font-bold mb-8 rounded-lg p-8 ${
                  mode === 'work' ? 'bg-red-500' :
                  mode === 'shortBreak' ? 'bg-green-500' : 'bg-blue-500'
                } bg-opacity-10`}>
                  {formatTime(timeLeft)}
                </div>

                <div className="space-x-4">
                  <Button
                    onClick={toggleTimer}
                    variant="default"
                    size="lg"
                  >
                    {isRunning ? 'Pause' : 'Start'}
                  </Button>
                  <Button
                    onClick={resetTimer}
                    variant="outline"
                    size="lg"
                  >
                    Reset
                  </Button>
                </div>

                <div className="mt-6 text-sm text-gray-600">
                  Completed Pomodoros: {completedPomodoros}
                </div>
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Chat Section - Only show during breaks */}
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

      <Dialog open={showCompletionDialog} onOpenChange={setShowCompletionDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Pomodoro Complete!</DialogTitle>
            <DialogDescription asChild>
              <div className="space-y-2">
                <div>Great job! You've completed a work session.</div>
                <div className="font-medium text-yellow-600 flex items-center gap-2">
                  {microLeonSticker && (
                    <img 
                      src={getStickerUrl(microLeonSticker.$id)}
                      alt="Micro Leon" 
                      className="h-16 w-16"
                    />
                  )}
                  You earned {completedPomodoros % settings.longBreakInterval === 0 ? '50' : '10'} micro leons!
                </div>
              </div>
            </DialogDescription>
          </DialogHeader>
          <div className="flex justify-end">
            <Button onClick={handleCompletionDismiss}>
              Close
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
