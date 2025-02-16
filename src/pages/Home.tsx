import { useState, useEffect, useCallback, useRef } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useUser } from "../lib/context/user";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { databases, DATABASE_ID, client, MESSAGES_COLLECTION_ID } from "../lib/appwrite";
import { ID, Permission, Role, Query, Models } from "appwrite";
import { useTimer } from "@/lib/context/timer";
import { useNavigate } from 'react-router-dom';
import { ScrollArea } from "@/components/ui/scroll-area";
import { ChevronDown } from "lucide-react";

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

export function Home() {
  const user = useUser();
  const navigate = useNavigate();
  const { mode, setMode } = useTimer();
  const [settings, setSettings] = useState<TimerSettings>(() => {
    return {} as TimerSettings;
  });
  const [isDevMode, setIsDevMode] = useState(() => {
    return localStorage.getItem('devMode') === 'true';
  });
  const [timeLeft, setTimeLeft] = useState(settings[mode] * (isDevMode ? 1 : 60));
  const [isActive, setIsActive] = useState(false);
  const [completedPomodoros, setCompletedPomodoros] = useState(0);
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [showCompletionDialog, setShowCompletionDialog] = useState(false);
  const [isRunning, setIsRunning] = useState(false);
  const [progress, setProgress] = useState(0);

  // Chat states
  const [messages, setMessages] = useState<Message[]>([]);
  const [newMessage, setNewMessage] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [showScrollButton, setShowScrollButton] = useState(false);
  const [isNearBottom, setIsNearBottom] = useState(true);
  const scrollAreaRef = useRef<HTMLDivElement>(null);

  // Create a single audio instance
  const alarmSound = useRef(new Audio('/alarm.mp3'));

  // Load settings from Appwrite
  useEffect(() => {
    async function loadSettings() {
      if (!user?.current?.$id) return;
      
      try {
        const response = await databases.listDocuments(
          DATABASE_ID,
          'timer_settings',
          [Query.equal('userId', user.current.$id)]
        );

        if (response.documents.length > 0) {
          const doc = response.documents[0];
          console.log('Found existing settings:', doc);
          const parsedSettings = JSON.parse(doc.settings);
          
          // Merge with default settings to ensure all fields exist
          const mergedSettings = {
            ...DEFAULT_SETTINGS,
            ...parsedSettings,
          };
          
          console.log('Merged settings:', mergedSettings);
          setSettings(mergedSettings);
          setTimeLeft(mergedSettings[mode] * (isDevMode ? 1 : 60));
        } else {
          console.log('Creating new settings with defaults:', DEFAULT_SETTINGS);
          const doc = await databases.createDocument(
            DATABASE_ID,
            'timer_settings',
            ID.unique(),
            {
              userId: user.current.$id,
              settings: JSON.stringify(DEFAULT_SETTINGS)
            },
            [
              Permission.read(Role.user(user.current.$id)),
              Permission.update(Role.user(user.current.$id)),
              Permission.delete(Role.user(user.current.$id))
            ]
          );
          setSettings(DEFAULT_SETTINGS);
          setTimeLeft(DEFAULT_SETTINGS[mode] * (isDevMode ? 1 : 60));
        }
      } catch (error) {
        console.error('Error loading settings:', error);
      }
    }

    loadSettings();
  }, [user.current, mode, isDevMode]);

  // Save settings to Appwrite when they change
  useEffect(() => {
    async function saveSettings() {
      if (!user?.current?.$id) return;

      try {
        const response = await databases.listDocuments(
          DATABASE_ID,
          'timer_settings',
          [Query.equal('userId', user.current.$id)]
        );

        if (response.documents.length > 0) {
          const doc = response.documents[0];
          const currentSettings = {
            ...settings,
            completedPomodoros,
            currentMode: mode
          };
          
          console.log('Saving settings:', currentSettings);
          await databases.updateDocument(
            DATABASE_ID,
            'timer_settings',
            doc.$id,
            {
              settings: JSON.stringify(currentSettings)
            }
          );
        }
      } catch (error) {
        console.error('Error saving settings:', error);
      }
    }

    saveSettings();
  }, [settings, completedPomodoros, mode, user.current]);

  useEffect(() => {
    let interval: NodeJS.Timeout;

    if (isActive && timeLeft > 0) {
      interval = setInterval(() => {
        setTimeLeft((time) => time - 1);
      }, 1000);
    } else if (timeLeft === 0) {
      handleTimerComplete();
    }

    return () => clearInterval(interval);
  }, [isActive, timeLeft]);

  const handleTimerComplete = () => {
    // Play sound
    alarmSound.current.currentTime = 0; // Reset to start
    alarmSound.current.play();

    // Show notification
    if (Notification.permission === "granted") {
      const notification = new Notification("Timer Complete!", {
        body: "Time to take a break!",
        icon: "/favicon.ico",
        requireInteraction: true
      });

      const clickHandler = () => {
        handleDismissDialog();
        notification.removeEventListener('click', clickHandler);
      };

      notification.addEventListener('click', clickHandler);
    }

    setIsActive(false);
    if (mode === 'work') {
      setCompletedPomodoros(prev => prev + 1);
      setMode(completedPomodoros % 4 === 3 ? 'longBreak' : 'shortBreak');
    } else {
      setMode('work');
    }
    setTimeLeft(settings[mode] * (isDevMode ? 1 : 60));
  };

  const handleDismissDialog = () => {
    setShowCompletionDialog(false);
    alarmSound.current.pause();
    alarmSound.current.currentTime = 0;  // Reset the audio to the beginning
  };

  const toggleTimer = () => {
    setIsActive(!isActive);
  };

  const resetTimer = () => {
    setIsActive(false);
    setTimeLeft(settings[mode] * (isDevMode ? 1 : 60));
  };

  const updateSettings = async (newSettings: TimerSettings) => {
    setSettings(newSettings);
    
    if (!user?.current?.$id) {
      console.log('No user ID found:', user);
      return;
    }
    
    try {
      console.log('Trying to create document...');
      const doc = await databases.createDocument(
        import.meta.env.VITE_DATABASE_ID,
        'timer_settings',
        user.current.$id,
        { 
          userId: user.current.$id,
          settings: JSON.stringify(newSettings) 
        },
        [
          Permission.read(Role.user(user.current.$id)),
          Permission.update(Role.user(user.current.$id)),
          Permission.delete(Role.user(user.current.$id))
        ]
      );
      console.log('Document created:', doc);
    } catch (error) {
      console.log('Create failed, trying update...', error);
      try {
        const doc = await databases.updateDocument(
          import.meta.env.VITE_DATABASE_ID,
          'timer_settings',
          user.current.$id,
          { 
            userId: user.current.$id,
            settings: JSON.stringify(newSettings) 
          }
        );
        console.log('Document updated:', doc);
      } catch (e) {
        console.error('Error saving settings:', e);
      }
    }
    
    setTimeLeft(newSettings[mode] * (isDevMode ? 1 : 60));
  };

  const toggleDevMode = () => {
    const newDevMode = !isDevMode;
    setIsDevMode(newDevMode);
    localStorage.setItem('devMode', String(newDevMode));
    // Adjust current time left when toggling
    setTimeLeft(prev => {
      const minutes = Math.ceil(prev / (isDevMode ? 1 : 60));
      return minutes * (newDevMode ? 1 : 60);
    });
  };

  const formatTime = (seconds: number): string => {
    if (isDevMode) {
      return seconds.toString().padStart(2, '0');
    }
    const minutes = Math.floor(seconds / 60);
    const remainingSeconds = seconds % 60;
    return `${minutes.toString().padStart(2, '0')}:${remainingSeconds.toString().padStart(2, '0')}`;
  };

  const handleModeChange = useCallback(async (newMode: TimerMode) => {
    setMode(newMode);
    setTimeLeft(settings[newMode] * (isDevMode ? 1 : 60));
    setIsRunning(false);
    setProgress(0);

    // Navigate to chat when break starts
    if (newMode === 'shortBreak' || newMode === 'longBreak') {
      setTimeout(() => navigate('/chat'), 0);
    }
  }, [navigate, settings, isDevMode, setMode]);

  // Add console logs to debug
  useEffect(() => {
    if (timeLeft === 0 && !isRunning) {
      // Start from beginning and play for 500ms (1/2 second)
      alarmSound.current.currentTime = 0;
      alarmSound.current.play();
      
      // Stop after 500ms
      setTimeout(() => {
        alarmSound.current.pause();
        alarmSound.current.currentTime = 0;
      }, 500);
      
      let nextMode: TimerMode;
      if (mode === 'work') {
        const newCompletedPomodoros = completedPomodoros + 1;
        console.log('Completed pomodoros:', newCompletedPomodoros);
        console.log('Long break interval:', settings.longBreakInterval);
        console.log('Is long break?', newCompletedPomodoros % settings.longBreakInterval === 0);
        
        setCompletedPomodoros(newCompletedPomodoros);
        
        if (newCompletedPomodoros % settings.longBreakInterval === 0) {
          console.log('Starting long break');
          nextMode = 'longBreak';
        } else {
          console.log('Starting short break');
          nextMode = 'shortBreak';
        }
        
        setShowCompletionDialog(true);
      } else {
        nextMode = 'work';
      }
      
      console.log('Next mode:', nextMode);
      handleModeChange(nextMode);
    }
  }, [timeLeft, isRunning, mode, completedPomodoros, settings.longBreakInterval]);

  // Clean up audio on unmount
  useEffect(() => {
    return () => {
      alarmSound.current.pause();
      alarmSound.current.currentTime = 0;
    };
  }, []);

  // Chat functions
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
      const response = await databases.listDocuments<Message>(
        DATABASE_ID,
        MESSAGES_COLLECTION_ID,
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

    setIsLoading(true);
    try {
      await databases.createDocument(
        DATABASE_ID,
        MESSAGES_COLLECTION_ID,
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
    } finally {
      setIsLoading(false);
    }
  }, [newMessage, user.current]);

  const formatMessageTime = useCallback((dateString: string) => {
    const date = new Date(dateString);
    return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  }, []);

  // Load messages when entering break mode
  useEffect(() => {
    if (mode === 'shortBreak' || mode === 'longBreak') {
      loadMessages();
      
      const unsubscribe = client.subscribe([
        `databases.${DATABASE_ID}.collections.${MESSAGES_COLLECTION_ID}.documents`
      ], response => {
        if (response.events.includes('databases.*.collections.*.documents.*.create')) {
          const newMessage = response.payload as Message;
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

  return (
    <div className="container mx-auto px-4 py-8">
      <Card className="w-full max-w-md">
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle className="text-2xl font-bold">Pomodoro Timer</CardTitle>
          <div className="flex items-center gap-2">
            <Button
              variant="ghost"
              size="sm"
              onClick={toggleDevMode}
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
                onClick={async () => {
                  await updateSettings(settings);
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
              ref={scrollAreaRef}
              onScrollCapture={handleScroll}
            >
              <div className="space-y-4">
                {messages.map((message) => (
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
                          {formatMessageTime(message.createdAt)}
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

            {showScrollButton && !isNearBottom && (
              <Button
                size="icon"
                variant="secondary"
                className="absolute bottom-16 right-8 rounded-full w-8 h-8 shadow-md"
                onClick={() => {
                  scrollToBottom();
                  setShowScrollButton(false);
                }}
              >
                <ChevronDown className="h-4 w-4" />
              </Button>
            )}

            <form onSubmit={sendMessage} className="flex gap-4">
              <Input 
                placeholder="Type your message..." 
                value={newMessage}
                onChange={(e) => setNewMessage(e.target.value)}
                disabled={isLoading}
                className="flex-1"
              />
              <Button type="submit" disabled={isLoading}>
                {isLoading ? "Sending..." : "Send"}
              </Button>
            </form>
          </CardContent>
        </Card>
      )}

      <Dialog open={showCompletionDialog} onOpenChange={handleDismissDialog}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Timer Complete!</DialogTitle>
          </DialogHeader>
          <div className="flex justify-center space-x-4 mt-4">
            <Button onClick={handleDismissDialog}>
              Dismiss
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
