import { createContext, useContext, ReactNode, useState, useEffect, useCallback } from 'react';
import { useUser } from './user';

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
    // Only try to update user prefs if we have a logged-in user
    if (!user.current) {
      setVolumeState(newVolume);
      localStorage.setItem('volume', newVolume.toString());
      return;
    }
    
    try {
      await user.updateUser({
        volume: newVolume.toString()
      });
    } catch (error) {
      console.error('Failed to update volume:', error);
      // On error, revert to the volume from user prefs or localStorage
      const savedVolume = user.current?.prefs?.volume || localStorage.getItem('volume');
      if (savedVolume) {
        setVolumeState(Number(savedVolume));
      }
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