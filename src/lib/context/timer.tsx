import { createContext, useContext, ReactNode, useState, useEffect } from "react";
import { databases, DATABASE_ID } from "../appwrite";
import { Query } from "appwrite";
import { useUser } from "./user";

export type TimerMode = 'work' | 'shortBreak' | 'longBreak';

interface TimerContextType {
  mode: TimerMode;
  setMode: (mode: TimerMode) => void;
}

const TimerContext = createContext<TimerContextType | undefined>(undefined);

export function TimerProvider({ children }: { children: ReactNode }) {
  const [mode, setMode] = useState<TimerMode>('work');
  const user = useUser();

  // Load timer state from Appwrite when user logs in
  useEffect(() => {
    async function loadTimerState() {
      if (!user?.current?.$id) return;

      try {
        const response = await databases.listDocuments(
          DATABASE_ID,
          'timer_settings',
          [Query.equal('userId', user.current.$id)]
        );

        if (response.documents.length > 0) {
          const settings = JSON.parse(response.documents[0].settings);
          setMode(settings.currentMode || 'work');
        }
      } catch (error) {
        console.error('Error loading timer state:', error);
      }
    }

    loadTimerState();
  }, [user.current]);

  // Save timer state to Appwrite when it changes
  useEffect(() => {
    async function saveTimerState() {
      if (!user?.current?.$id) return;

      try {
        const response = await databases.listDocuments(
          DATABASE_ID,
          'timer_settings',
          [Query.equal('userId', user.current.$id)]
        );

        const settings = response.documents.length > 0
          ? JSON.parse(response.documents[0].settings)
          : {};

        settings.currentMode = mode;

        if (response.documents.length > 0) {
          await databases.updateDocument(
            DATABASE_ID,
            'timer_settings',
            response.documents[0].$id,
            { settings: JSON.stringify(settings) }
          );
        }
      } catch (error) {
        console.error('Error saving timer state:', error);
      }
    }

    if (user?.current?.$id) {
      saveTimerState();
    }
  }, [mode, user.current]);

  return (
    <TimerContext.Provider value={{ mode, setMode }}>
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