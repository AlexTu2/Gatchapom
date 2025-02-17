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

        // Check if timerSettings exists and is valid JSON
        if (prefs.timerSettings) {
          try {
            savedSettings = JSON.parse(prefs.timerSettings);
          } catch (e) {
            console.error('Invalid timer settings JSON:', e);
          }
        }

        // Only update settings if we have valid saved settings
        if (savedSettings && 
            typeof savedSettings.work === 'number' &&
            typeof savedSettings.shortBreak === 'number' &&
            typeof savedSettings.longBreak === 'number' &&
            typeof savedSettings.longBreakInterval === 'number') {
          const cleanSettings: TimerSettings = {
            work: savedSettings.work,
            shortBreak: savedSettings.shortBreak,
            longBreak: savedSettings.longBreak,
            longBreakInterval: savedSettings.longBreakInterval,
            currentMode: savedSettings.currentMode || 'work'
          };
          setSettings(cleanSettings);
          setMode(cleanSettings.currentMode);
        }
      } catch (error) {
        console.error('Error loading timer settings:', error);
      } finally {
        setIsLoading(false);
      }
    }

    loadSettings();
  }, [user.current?.$id]);

  // Save settings to user preferences
  const updateSettings = async (newSettings: TimerSettings) => {
    if (!user?.current) return;

    try {
      const updatedPrefs = await account.updatePrefs({
        ...user.current.prefs,
        timerSettings: JSON.stringify(newSettings)
      });
      
      setSettings(newSettings);
      setMode(newSettings.currentMode);
      
      user.updateUser({
        ...user.current,
        prefs: updatedPrefs
      });
    } catch (error) {
      console.error('Error saving timer settings:', error);
      throw error;
    }
  };

  // Update mode and save to settings
  const handleModeChange = async (newMode: TimerMode) => {
    const newSettings = { ...settings, currentMode: newMode };
    setMode(newMode);
    await updateSettings(newSettings);
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