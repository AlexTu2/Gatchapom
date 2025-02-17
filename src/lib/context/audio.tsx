import { createContext, useContext, ReactNode, useState, useEffect, useCallback } from 'react';
import { useUser } from './user';
import { account } from '../appwrite';

interface AudioContextType {
  volume: number;
  setVolume: (volume: number) => void;
  commitVolume: (volume: number) => Promise<void>;
}

const AudioContext = createContext<AudioContextType | null>(null);

export function AudioProvider({ children }: { children: ReactNode }) {
  const user = useUser();
  const [volume, setVolumeState] = useState(() => {
    // Try to get volume from localStorage as fallback
    const savedVolume = localStorage.getItem('volume');
    return savedVolume ? Number(savedVolume) : 0.5;
  });

  // Load volume from user prefs when available
  useEffect(() => {
    if (user.current?.prefs?.volume) {
      const newVolume = Number(user.current.prefs.volume);
      setVolumeState(newVolume);
      localStorage.setItem('volume', newVolume.toString());
    }
  }, [user.current?.prefs?.volume]);

  const setVolume = useCallback((newVolume: number) => {
    setVolumeState(newVolume);
    localStorage.setItem('volume', newVolume.toString());
  }, []);

  const commitVolume = useCallback(async (newVolume: number) => {
    if (!user.current) return;
    
    try {
      const currentUser = await account.get();
      await account.updatePrefs({
        ...currentUser.prefs,
        volume: newVolume.toString()
      });
    } catch (error) {
      console.error('Failed to update volume:', error);
      throw error;
    }
  }, [user]);

  return (
    <AudioContext.Provider value={{ volume, setVolume, commitVolume }}>
      {children}
    </AudioContext.Provider>
  );
}

export function useAudio() {
  const context = useContext(AudioContext);
  if (!context) {
    throw new Error('useAudio must be used within an AudioProvider');
  }
  return context;
} 