import { createContext, useContext, ReactNode, useState, useEffect } from "react";
import { useUser } from "./user";
import { account } from "../appwrite";

export type TimerMode = 'work' | 'shortBreak' | 'longBreak';

interface TimerContextType {
  mode: TimerMode;
  setMode: (mode: TimerMode) => void;
  isLoading: boolean;
  settings: TimerSettings;
  updateSettings: (newSettings: TimerSettings) => Promise<void>;
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
  const user = useUser();

  // Load timer settings from user preferences
  useEffect(() => {
    async function loadSettings() {
      if (!user?.current) {
        setIsLoading(false);
        return;
      }

      try {
        const prefs = user.current.prefs;
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
          await user.updateUser({
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
  }, [user?.current]);

  // Save settings to user preferences
  const updateSettings = async (newSettings: TimerSettings) => {
    if (!user?.current) return;

    try {
      // Only update the timerSettings field
      await user.updateUser({
        timerSettings: JSON.stringify(newSettings)
      });
      
      setSettings(newSettings);
      setMode(newSettings.currentMode);
    } catch (error) {
      console.error('Error saving timer settings:', error);
      throw error;
    }
  };

  // Update mode and save to settings
  const handleModeChange = async (newMode: TimerMode) => {
    try {
      // Get fresh user data to avoid overwriting other fields
      const currentUser = await account.get();
      const currentPrefs = currentUser.prefs;
      
      // Only update the timerSettings field
      const newSettings = { ...settings, currentMode: newMode };
      await user.updateUser({
        ...currentPrefs, // Keep all existing preferences
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
      updateSettings
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
function isValidTimerSettings(settings: any): settings is TimerSettings {
  return (
    typeof settings === 'object' &&
    typeof settings.work === 'number' &&
    typeof settings.shortBreak === 'number' &&
    typeof settings.longBreak === 'number' &&
    typeof settings.longBreakInterval === 'number' &&
    (!settings.currentMode || typeof settings.currentMode === 'string')
  );
} 