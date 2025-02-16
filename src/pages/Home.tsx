import { useState, useEffect, useCallback, useRef } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useUser } from "../lib/context/user";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { databases, DATABASE_ID, account } from "../lib/appwrite";
import { ID, Permission, Role, Query } from "appwrite";
import { useTimer } from "@/lib/context/timer";
import { useNavigate } from 'react-router-dom';
import { ScrollArea } from "@/components/ui/scroll-area";
import { ChevronDown } from "lucide-react";
import { Client } from "appwrite";

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

  const resetTimer = useCallback(() => {
    setIsActive(false);
    setIsRunning(false);
    setTimeLeft(settings[mode] * (isDevMode ? 1 : 60));
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
    isActive,
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
  const navigate = useNavigate();
  const { setMode } = useTimer();
  const user = useUser();

  const handleModeChange = useCallback(async (newMode: TimerMode) => {
    setMode(newMode);
    
    if (newMode === 'shortBreak' || newMode === 'longBreak') {
      navigate('/chat', { replace: true });
    }
  }, [navigate, setMode]);

  const awardMicroLeons = useCallback(async (amount: number) => {
    if (!user?.current?.$id) return;
    
    try {
      const currentLeons = Number(user.current.prefs.microLeons) || 0;
      const newLeons = currentLeons + amount;
      
      const updatedPrefs = {
        ...user.current.prefs,
        microLeons: newLeons.toString()
      };
      
      await account.updatePrefs(updatedPrefs);
      user.updateUser({
        ...user.current,
        prefs: updatedPrefs
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
}

// Create a custom hook for chat functionality
function useChat(user: ReturnType<typeof useUser>, mode: TimerMode) {
  const [messages, setMessages] = useState<AppwriteMessage[]>([]);
  const [newMessage, setNewMessage] = useState("");
  const [showScrollButton, setShowScrollButton] = useState(false);
  const [isNearBottom, setIsNearBottom] = useState(true);
  const scrollAreaRef = useRef<HTMLDivElement>(null);

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

  const sendMessage = useCallback(async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newMessage.trim() || !user.current) return;

    try {
      await databases.createDocument(
        DATABASE_ID,
        'messages',
        ID.unique(),
        {
          content: newMessage.trim(),
          userId: user.current.$id,
          userName: user.current.name,
          userAvatar: user.current.prefs.avatarUrl,
          createdAt: new Date().toISOString(),
        },
        [
          Permission.read(Role.any()),
          Permission.update(Role.user(user.current.$id)),
          Permission.delete(Role.user(user.current.$id)),
        ]
      );
      setNewMessage("");
    } catch (error) {
      console.error('Error sending message:', error);
    }
  }, [newMessage, user.current]);

  // Load messages when entering break mode
  useEffect(() => {
    if (mode === 'shortBreak' || mode === 'longBreak') {
      loadMessages();
      
      const client = new Client()
        .setEndpoint('https://cloud.appwrite.io/v1')
        .setProject(import.meta.env.VITE_APPWRITE_PROJECT_ID);
      
      const unsubscribe = client.subscribe([
        `databases.${DATABASE_ID}.collections.messages.documents`
      ], response => {
        if (response.events.includes('databases.*.collections.*.documents.*.create')) {
          const newMessage = response.payload as AppwriteMessage;
          setMessages(prev => [...prev, newMessage]);
        }
      });

      return () => {
        unsubscribe();
      };
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

  return {
    messages,
    newMessage,
    setNewMessage,
    showScrollButton,
    isNearBottom,
    scrollAreaRef,
    scrollToBottom,
    handleScroll,
    sendMessage,
    setShowScrollButton
  };
}

// Create a custom hook for settings management
function useSettings(user: ReturnType<typeof useUser>) {
  const [settings, setSettings] = useState<TimerSettings>(DEFAULT_SETTINGS);
  const [isSettingsLoading, setIsSettingsLoading] = useState(true);
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);

  // Load settings from Appwrite
  useEffect(() => {
    let mounted = true;
    
    async function loadSettings() {
      if (!user?.current?.$id) {
        if (mounted) setIsSettingsLoading(false);
        return;
      }
      
      try {
        const response = await databases.listDocuments(
          DATABASE_ID,
          'timer_settings',
          [Query.equal('userId', user.current.$id)]
        );

        if (!mounted) return;

        if (response.documents.length > 0) {
          const doc = response.documents[0];
          const parsedSettings = JSON.parse(doc.settings);
          
          const cleanSettings: TimerSettings = {
            work: parsedSettings.work ?? DEFAULT_SETTINGS.work,
            shortBreak: parsedSettings.shortBreak ?? DEFAULT_SETTINGS.shortBreak,
            longBreak: parsedSettings.longBreak ?? DEFAULT_SETTINGS.longBreak,
            longBreakInterval: parsedSettings.longBreakInterval ?? DEFAULT_SETTINGS.longBreakInterval
          };
          
          setSettings(cleanSettings);
        }
      } catch (error) {
        console.error('Error loading settings:', error);
      } finally {
        if (mounted) setIsSettingsLoading(false);
      }
    }

    loadSettings();
    return () => { mounted = false; };
  }, [user.current]);

  const saveSettings = useCallback(async (newSettings: TimerSettings) => {
    if (!user?.current?.$id) {
      console.warn('No user found, skipping settings save');
      return;
    }

    try {
      await databases.updateDocument(
        DATABASE_ID,
        'timer_settings',
        user.current.$id,
        { settings: JSON.stringify(newSettings) }
      );
    } catch (error) {
      console.error('Error saving settings:', error);
    }
  }, [user]);

  return {
    settings,
    setSettings,
    isSettingsLoading,
    isSettingsOpen,
    setIsSettingsOpen,
    saveSettings
  };
}

export function Home() {
  const user = useUser();
  const { mode } = useTimer();
  const [isDevMode, setIsDevMode] = useState(() => localStorage.getItem('devMode') === 'true');
  const [showCompletionDialog, setShowCompletionDialog] = useState(false);

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
    isActive,
    isRunning,
    setIsRunning,
    completedPomodoros,
    setCompletedPomodoros,
    resetTimer,
    toggleTimer,
    alarmSound
  } = useTimerLogic(settings, isDevMode, mode);

  const { handleModeChange, awardMicroLeons } = useModeTransition();

  const chat = useChat(user, mode);

  // Handle timer completion
  useEffect(() => {
    if (timeLeft === 0 && !showCompletionDialog) {
      alarmSound.current.currentTime = 0;
      alarmSound.current.play();
      
      setTimeout(() => {
        alarmSound.current.pause();
        alarmSound.current.currentTime = 0;
      }, 500);

      if (mode === 'work') {
        const newCompletedPomodoros = completedPomodoros + 1;
        setCompletedPomodoros(newCompletedPomodoros);
        
        const reward = newCompletedPomodoros % settings.longBreakInterval === 0 ? 50 : 10;
        awardMicroLeons(reward);
        setShowCompletionDialog(true);
      } else {
        handleModeChange('work');
        setTimeLeft(settings.work * (isDevMode ? 1 : 60));
        setIsRunning(false);
      }
    }
  }, [timeLeft, mode, completedPomodoros, settings, isDevMode, showCompletionDialog, handleModeChange, awardMicroLeons, setTimeLeft, setIsRunning]);

  const handleCompletionDismiss = useCallback(() => {
    setShowCompletionDialog(false);
    const nextMode = completedPomodoros % settings.longBreakInterval === 0 ? 'longBreak' : 'shortBreak';
    handleModeChange(nextMode);
    setTimeLeft(settings[nextMode] * (isDevMode ? 1 : 60));
    setIsRunning(false);
  }, [completedPomodoros, settings, isDevMode, handleModeChange, setTimeLeft, setIsRunning]);

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
                    {isActive ? 'Pause' : 'Start'}
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
                      <p className={`text-sm mt-1 p-3 rounded-lg ${
                        message.userId === user.current?.$id
                          ? 'bg-blue-500 text-white'
                          : 'bg-gray-100'
                      }`}>
                        {message.content}
                      </p>
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

            <form onSubmit={chat.sendMessage} className="flex gap-4">
              <Input 
                placeholder="Type your message..." 
                value={chat.newMessage}
                onChange={(e) => chat.setNewMessage(e.target.value)}
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
            <DialogDescription className="space-y-2">
              <p>Great job! You've completed a work session.</p>
              <p className="font-medium text-yellow-600 flex items-center gap-2">
                <img 
                  src="/learnwithleon/microLeon.png" 
                  alt="Micro Leon" 
                  className="h-16 w-16"
                />
                You earned {completedPomodoros % settings.longBreakInterval === 0 ? '50' : '10'} micro leons!
              </p>
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
