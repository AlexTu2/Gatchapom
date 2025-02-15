import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useUser } from "../lib/context/user";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { databases } from "../lib/appwrite";
import { ID } from "appwrite";

type TimerMode = 'work' | 'shortBreak' | 'longBreak';

interface TimerSettings {
  work: number;
  shortBreak: number;
  longBreak: number;
}

const DEFAULT_SETTINGS: TimerSettings = {
  work: 25,
  shortBreak: 5,
  longBreak: 15,
};

const alarmSound = new Audio("/alarm.mp3"); // You'll need to add an alarm sound file to your public folder

export function Home() {
  const user = useUser();
  const [mode, setMode] = useState<TimerMode>('work');
  const [settings, setSettings] = useState<TimerSettings>(() => {
    // Start with default settings until we load from Appwrite
    return DEFAULT_SETTINGS;
  });
  const [isDevMode, setIsDevMode] = useState(() => {
    return localStorage.getItem('devMode') === 'true';
  });
  const [timeLeft, setTimeLeft] = useState(settings[mode] * (isDevMode ? 1 : 60));
  const [isActive, setIsActive] = useState(false);
  const [completedPomodoros, setCompletedPomodoros] = useState(0);
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [showCompletionDialog, setShowCompletionDialog] = useState(false);

  // Load settings from Appwrite when user logs in
  useEffect(() => {
    async function loadSettings() {
      if (!user?.id) return;
      
      try {
        const doc = await databases.getDocument(
          import.meta.env.VITE_DATABASE_ID,
          'timer_settings',
          user.id
        );
        setSettings(JSON.parse(doc.settings));
      } catch (error) {
        // If document doesn't exist, create it with default settings
        try {
          const doc = await databases.createDocument(
            import.meta.env.VITE_DATABASE_ID,
            'timer_settings',
            user.id,
            { settings: JSON.stringify(DEFAULT_SETTINGS) }
          );
          setSettings(JSON.parse(doc.settings));
        } catch (e) {
          console.error('Error creating settings:', e);
        }
      }
    }

    loadSettings();
  }, [user?.id]);

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
    alarmSound.play();
    setShowCompletionDialog(true);

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
    alarmSound.pause();
    alarmSound.currentTime = 0;  // Reset the audio to the beginning
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
    
    if (user?.id) {
      try {
        await databases.updateDocument(
          import.meta.env.VITE_DATABASE_ID,
          'timer_settings',
          user.id,
          { settings: JSON.stringify(newSettings) }
        );
      } catch (error) {
        console.error('Error saving settings:', error);
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

  return (
    <>
      <div className="min-h-screen flex flex-col items-center justify-center bg-gray-50 p-4">
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
                          updateSettings({ ...settings, [key]: newValue });
                        }
                      }}
                    />
                  </div>
                ))}
                <Button 
                  className="w-full mt-4"
                  onClick={() => setIsSettingsOpen(false)}
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
                      onClick={() => {
                        setMode(timerMode);
                        setTimeLeft(settings[timerMode] * (isDevMode ? 1 : 60));
                        setIsActive(false);
                      }}
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
      </div>
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
    </>
  );
}
