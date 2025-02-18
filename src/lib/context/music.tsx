import { createContext, useContext, ReactNode, useState, useCallback, useEffect, useRef } from 'react';

interface MusicContextType {
  isPlaying: boolean;
  currentTrack: string | null;
  togglePlayback: () => void;
  setVolume: (volume: number) => void;
  playPlaylist: (playlistId: string) => void;
  isReady: boolean;
}

interface YouTubePlayer {
  playVideo: () => void;
  pauseVideo: () => void;
  setVolume: (volume: number) => void;
}

const MusicContext = createContext<MusicContextType | null>(null);

const DEFAULT_VIDEO_ID = 'jfKfPfyJRdk'; // Lofi Girl radio

export function MusicProvider({ children }: { children: ReactNode }) {
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTrack, setCurrentTrack] = useState<string | null>("Lofi Girl Radio");
  const [isReady, setIsReady] = useState(false);
  const playerRef = useRef<YouTubePlayer | null>(null);

  useEffect(() => {
    const loadYouTubeAPI = () => {
      if (window.YT) return;
      
      const tag = document.createElement('script');
      tag.src = 'https://www.youtube.com/iframe_api';
      const firstScriptTag = document.getElementsByTagName('script')[0];
      firstScriptTag.parentNode?.insertBefore(tag, firstScriptTag);

      window.onYouTubeIframeAPIReady = () => {
        initializePlayer();
      };
    };

    const initializePlayer = () => {
      playerRef.current = new window.YT.Player('youtube-player', {
        height: '360',
        width: '640',
        videoId: DEFAULT_VIDEO_ID,
        playerVars: {
          autoplay: 1,
          controls: 1,
          disablekb: 1,
          enablejsapi: 1,
          loop: 0,
          modestbranding: 1,
          playsinline: 1,
          rel: 0,
          showinfo: 0,
          mute: 0,
          origin: window.location.origin
        },
        events: {
          onReady: () => setIsReady(true),
          onStateChange: (event) => {
            setIsPlaying(event.data === window.YT.PlayerState.PLAYING);
          },
          onError: (event) => {
            console.error('YouTube player error:', event);
            setIsReady(false);
          }
        }
      });
    };

    loadYouTubeAPI();
  }, []);

  const togglePlayback = useCallback(() => {
    if (!playerRef.current) return;
    
    if (isPlaying) {
      playerRef.current.pauseVideo();
    } else {
      playerRef.current.playVideo();
    }
  }, [isPlaying]);

  const setVolume = useCallback((volume: number) => {
    if (!playerRef.current || !isReady) return;
    playerRef.current.setVolume(Math.round(volume * 100));
  }, [isReady]);

  const playPlaylist = useCallback((playlistId: string) => {
    if (!playerRef.current || !isReady) return;
    setCurrentTrack(`Playlist: ${playlistId}`);
    // Implement playlist functionality here
  }, [isReady]);

  return (
    <MusicContext.Provider value={{
      isPlaying,
      currentTrack,
      togglePlayback,
      setVolume,
      playPlaylist,
      isReady
    }}>
      {children}
    </MusicContext.Provider>
  );
}

export function useMusic() {
  const context = useContext(MusicContext);
  if (!context) {
    throw new Error('useMusic must be used within a MusicProvider');
  }
  return context;
} 