import { createContext, useContext, ReactNode, useState, useEffect } from "react";
import { account } from '../appwrite';

export type TimerMode = 'work' | 'shortBreak' | 'longBreak';

interface TimerContextType {
  mode: TimerMode;
  setMode: (mode: TimerMode) => void;
  isLoading: boolean;
  settings: TimerSettings;
  updateSettings: (newSettings: TimerSettings) => Promise<void>;
  status: 'running' | 'paused';
  setStatus: (status: 'running' | 'paused') => void;
}

export interface TimerSettings {
  work: number;
  shortBreak: number;
  longBreak: number;
  longBreakInterval: number;
  currentMode: TimerMode;
}

const DEFAULT_SETTINGS: TimerSettings = {
  work: 25,
  shortBreak: 5,
  longBreak: 15,
  longBreakInterval: 4,
  currentMode: 'work'
};

const TimerContext = createContext<TimerContextType | undefined>(undefined);

export function TimerProvider({ children }: { children: ReactNode }) {
  const [mode, setMode] = useState<TimerMode>('work');
  const [settings, setSettings] = useState<TimerSettings>(DEFAULT_SETTINGS);
  const [isLoading, setIsLoading] = useState(true);
  const [status, setStatus] = useState<'running' | 'paused'>('paused');

  // Load timer settings from user preferences
  useEffect(() => {
    async function loadSettings() {
      try {
        const user = await account.get();
        const prefs = user.prefs;
        let savedSettings: TimerSettings | null = null;

        if (typeof prefs.timerSettings === 'string') {
          try {
            savedSettings = JSON.parse(prefs.timerSettings);
          } catch (e) {
            console.error('Invalid timer settings JSON:', e);
          }
        }

        if (savedSettings && isValidTimerSettings(savedSettings)) {
          setSettings(savedSettings);
          setMode(savedSettings.currentMode || 'work');
        } else {
          // Reset to defaults if settings are invalid
          const defaultSettings = { ...DEFAULT_SETTINGS };
          await account.updatePrefs({
            timerSettings: JSON.stringify(defaultSettings)
          });
          setSettings(defaultSettings);
          setMode(defaultSettings.currentMode);
        }
      } catch (error) {
        console.error('Error loading timer settings:', error);
      } finally {
        setIsLoading(false);
      }
    }

    loadSettings();
  }, []);

  // Update settings to user preferences
  const updateSettings = async (newSettings: TimerSettings) => {
    try {
      // Get current user to preserve all preferences
      const currentUser = await account.get();
      await account.updatePrefs({
        ...currentUser.prefs,  // Preserve all existing preferences
        timerSettings: JSON.stringify(newSettings)
      });
      setSettings(newSettings);
    } catch (error) {
      console.error('Error updating timer settings:', error);
      throw error;
    }
  };

  // Update mode and save to settings
  const handleModeChange = async (newMode: TimerMode) => {
    try {
      const newSettings = { ...settings, currentMode: newMode };
      // Get current user to preserve all preferences
      const currentUser = await account.get();
      await account.updatePrefs({
        ...currentUser.prefs,  // Preserve all existing preferences
        timerSettings: JSON.stringify(newSettings)
      });
      
      setMode(newMode);
      setSettings(newSettings);
    } catch (error) {
      console.error('Error updating timer mode:', error);
    }
  };

  return (
    <TimerContext.Provider value={{ 
      mode, 
      setMode: handleModeChange, 
      isLoading,
      settings,
      updateSettings,
      status,
      setStatus
    }}>
      {children}
    </TimerContext.Provider>
  );
}

export function useTimer() {
  const context = useContext(TimerContext);
  if (!context) {
    throw new Error("useTimer must be used within a TimerProvider");
  }
  return context;
}

// Add helper function to validate timer settings
function isValidTimerSettings(settings: unknown): settings is TimerSettings {
  return (
    typeof settings === 'object' &&
    settings !== null &&
    typeof (settings as TimerSettings).work === 'number' &&
    typeof (settings as TimerSettings).shortBreak === 'number' &&
    typeof (settings as TimerSettings).longBreak === 'number' &&
    typeof (settings as TimerSettings).longBreakInterval === 'number' &&
    (!('currentMode' in settings) || typeof (settings as TimerSettings).currentMode === 'string')
  );
} 