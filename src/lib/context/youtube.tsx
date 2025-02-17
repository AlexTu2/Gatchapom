import React, { createContext, useContext, useState } from 'react';

interface YouTubePlayer {
  pauseVideo: () => void;
  playVideo: () => void;
  setVolume: (volume: number) => void;
}

interface YouTubeContextType {
  player: YouTubePlayer | null;
  setPlayer: (player: YouTubePlayer) => void;
  isSync: boolean;
  setIsSync: (sync: boolean) => void;
  playMode: 'work' | 'shortBreak' | 'longBreak' | 'all';
  setPlayMode: (mode: 'work' | 'shortBreak' | 'longBreak' | 'all') => void;
  volume: number;
  setVolume: (volume: number) => void;
}

const YouTubeContext = createContext<YouTubeContextType | undefined>(undefined);

export function YouTubeProvider({ children }: { children: React.ReactNode }) {
  const [player, setPlayer] = useState<YouTubePlayer | null>(null);
  const [isSync, setIsSync] = useState(true);
  const [playMode, setPlayMode] = useState<'work' | 'shortBreak' | 'longBreak' | 'all'>('all');
  const [volume, setVolume] = useState(50);

  return (
    <YouTubeContext.Provider
      value={{
        player,
        setPlayer,
        isSync,
        setIsSync,
        playMode,
        setPlayMode,
        volume,
        setVolume,
      }}
    >
      {children}
    </YouTubeContext.Provider>
  );
}

export function useYouTube() {
  const context = useContext(YouTubeContext);
  if (context === undefined) {
    throw new Error('useYouTube must be used within a YouTubeProvider');
  }
  return context;
} 