import React, { useState, useEffect, useRef } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { useAudio } from '@/lib/context/audio';
import { PlayCircle, PauseCircle, SkipForward, SkipBack } from 'lucide-react';
import { Slider } from '@/components/ui/slider';
import { getPlaylistVideos } from '@/lib/youtube';
import { PRESET_PLAYLISTS } from '@/lib/playlists';
import { ScrollArea } from "@/components/ui/scroll-area";

interface VideoInfo {
  id: string;
  title: string;
  thumbnail: string;
  duration?: number;
}

interface YouTubePlayer {
  playVideo: () => void;
  pauseVideo: () => void;
  seekTo: (seconds: number) => void;
  getCurrentTime: () => number;
  getDuration: () => number;
  getPlayerState: () => number;
  setVolume: (volume: number) => void;
  destroy: () => void;
}

interface YouTubeEvent {
  target: YouTubePlayer;
  data: number;
}

declare global {
  interface Window {
    YT: {
      Player: new (
        element: string,
        config: {
          height: string | number;
          width: string | number;
          videoId: string;
          playerVars: {
            autoplay: number;
            controls: number;
            disablekb: number;
            enablejsapi: number;
            loop: number;
            modestbranding: number;
            playsinline: number;
            rel: number;
            showinfo: number;
            mute: number;
          };
          events: {
            onReady: (event: YouTubeEvent) => void;
            onStateChange: (event: YouTubeEvent) => void;
            onError: (event: YouTubeEvent) => void;
          };
        }
      ) => YouTubePlayer;
      loaded: number;
      PlayerState: {
        UNSTARTED: number; // -1
        ENDED: number;     // 0
        PLAYING: number;   // 1
        PAUSED: number;    // 2
        BUFFERING: number; // 3
      };
    };
    onYouTubeIframeAPIReady: () => void;
  }
}

const loadYouTubeAPI = (): Promise<void> => {
  return new Promise((resolve) => {
    if (window.YT) {
      resolve();
      return;
    }

    const tag = document.createElement('script');
    tag.src = 'https://www.youtube.com/iframe_api';
    const firstScriptTag = document.getElementsByTagName('script')[0];
    firstScriptTag.parentNode?.insertBefore(tag, firstScriptTag);

    window.onYouTubeIframeAPIReady = () => {
      resolve();
    };
  });
};

export function YouTubeAudioPlayer() {
  const [url, setUrl] = useState('');
  const [currentVideo, setCurrentVideo] = useState<VideoInfo | null>(null);
  const [playlist, setPlaylist] = useState<VideoInfo[]>([]);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [isPlaying, setIsPlaying] = useState(false);
  const [progress, setProgress] = useState(0);
  const [duration, setDuration] = useState(0);
  const [isPlayerReady, setIsPlayerReady] = useState(false);
  const { volume } = useAudio();
  const playerRef = useRef<YouTubePlayer | null>(null);
  const progressInterval = useRef<NodeJS.Timeout | null>(null);

  useEffect(() => {
    loadYouTubeAPI().then(() => {
      console.log('YouTube API loaded');
      if (currentVideo) {
        initializePlayer(currentVideo.id);
      }
    });

    return () => {
      if (playerRef.current) {
        playerRef.current.destroy();
      }
      if (progressInterval.current) {
        clearInterval(progressInterval.current);
      }
    };
  }, []);

  const initializePlayer = async (videoId: string) => {
    console.log('Initializing player with videoId:', videoId);
    await loadYouTubeAPI();

    if (!window.YT || !window.YT.Player) {
      console.error('YouTube API still not loaded');
      return;
    }

    if (playerRef.current) {
      console.log('Destroying existing player');
      playerRef.current.destroy();
      playerRef.current = null;
    }

    const playerElement = document.getElementById('youtube-player');
    if (!playerElement) {
      console.error('Player element not found');
      return;
    }

    try {
      console.log('Creating new player instance');
      playerRef.current = new window.YT.Player('youtube-player', {
        height: '360',
        width: '640',
        videoId: videoId,
        playerVars: {
          autoplay: 1,
          controls: 1,
          disablekb: 0,
          enablejsapi: 1,
          loop: 0,
          modestbranding: 1,
          playsinline: 1,
          rel: 0,
          showinfo: 0,
          mute: 0,
        },
        events: {
          onReady: (event: YouTubeEvent) => {
            console.log('Player ready event fired');
            setIsPlayerReady(true);
            event.target.setVolume(Math.round(volume * 100));
            event.target.playVideo();
            setDuration(event.target.getDuration());
            startProgressTracking();
            setIsPlaying(true);
          },
          onStateChange: (event: YouTubeEvent) => {
            console.log('Player state changed:', event.data);
            switch (event.data) {
              case window.YT.PlayerState.PLAYING:
                setIsPlaying(true);
                if (playerRef.current) {
                  playerRef.current.setVolume(Math.round(volume * 100));
                }
                break;
              case window.YT.PlayerState.PAUSED:
              case window.YT.PlayerState.ENDED:
                setIsPlaying(false);
                break;
            }
            
            if (event.data === window.YT.PlayerState.ENDED) {
              handleNext();
            }
          },
          onError: (event: YouTubeEvent) => {
            console.error('YouTube player error:', event);
            setIsPlayerReady(false);
            playerRef.current = null;
          }
        }
      });
    } catch (error) {
      console.error('Error initializing YouTube player:', error);
    }
  };

  const startProgressTracking = () => {
    if (progressInterval.current) {
      clearInterval(progressInterval.current);
    }

    progressInterval.current = setInterval(() => {
      if (playerRef.current) {
        try {
          const currentTime = playerRef.current.getCurrentTime();
          const duration = playerRef.current.getDuration();
          setProgress((currentTime / duration) * 100);
        } catch (error) {
          console.error('Error updating progress:', error);
        }
      }
    }, 1000);
  };

  const fetchVideoTitle = async (videoId: string): Promise<string> => {
    try {
      const response = await fetch(`https://noembed.com/embed?url=https://www.youtube.com/watch?v=${videoId}`);
      const data = await response.json();
      return data.title || 'Unknown Title';
    } catch (error) {
      console.error('Error fetching video title:', error);
      return 'Unknown Title';
    }
  };

  const extractVideoId = (url: string) => {
    const regExp = /^.*((youtu.be\/)|(v\/)|(\/?embed\/)|(\/?watch\?v=))([^#&?]*).*/;
    const match = url.match(regExp);
    return match && match[6].length === 11 ? match[6] : null;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    try {
      // Check if it's a playlist URL
      if (url.includes('list=')) {
        const playlistId = url.match(/[&?]list=([a-zA-Z0-9_-]+)/)?.[1];
        if (playlistId) {
          const videos = await getPlaylistVideos(playlistId);
          setPlaylist(videos);
          if (videos.length > 0 && !currentVideo) {
            setCurrentVideo(videos[0]);
            setCurrentIndex(0);
            if (window.YT && window.YT.Player) {
              initializePlayer(videos[0].id);
            }
          }
          setUrl('');
          return;
        }
      }

      // Handle single video
      const videoId = extractVideoId(url);
      if (videoId) {
        const title = await fetchVideoTitle(videoId);
        const newVideo = {
          id: videoId,
          title,
          thumbnail: `https://img.youtube.com/vi/${videoId}/maxresdefault.jpg`
        };

        setPlaylist(prev => [...prev, newVideo]);
        if (!currentVideo) {
          setCurrentVideo(newVideo);
          if (window.YT && window.YT.Player) {
            initializePlayer(videoId);
          }
        }
      }
    } catch (error) {
      console.error('Error processing URL:', error);
    }
    
    setUrl('');
  };

  const handlePlayPause = () => {
    console.log('Play/Pause clicked', { player: playerRef.current, isReady: isPlayerReady });
    if (!playerRef.current || !isPlayerReady) return;
    
    try {
      if (isPlaying) {
        console.log('Pausing video');
        playerRef.current.pauseVideo();
      } else {
        console.log('Playing video');
        playerRef.current.playVideo();
      }
    } catch (error) {
      console.error('Error controlling playback:', error);
    }
  };

  const handleNext = () => {
    if (currentIndex < playlist.length - 1) {
      const nextVideo = playlist[currentIndex + 1];
      setCurrentVideo(nextVideo);
      setCurrentIndex(prev => prev + 1);
      initializePlayer(nextVideo.id);
    }
  };

  const handlePrevious = () => {
    if (currentIndex > 0) {
      const prevVideo = playlist[currentIndex - 1];
      setCurrentVideo(prevVideo);
      setCurrentIndex(prev => prev - 1);
      initializePlayer(prevVideo.id);
    }
  };

  const handleSeek = (value: number[]) => {
    if (!playerRef.current || !duration) return;
    const newTime = (value[0] / 100) * duration;
    playerRef.current.seekTo(newTime);
  };

  useEffect(() => {
    if (playerRef.current) {
      playerRef.current.setVolume(Math.round(volume * 100));
    }
  }, [volume]);

  const formatTime = (seconds: number) => {
    const minutes = Math.floor(seconds / 60);
    const remainingSeconds = Math.floor(seconds % 60);
    return `${minutes}:${remainingSeconds.toString().padStart(2, '0')}`;
  };

  const loadPresetPlaylist = async (preset: typeof PRESET_PLAYLISTS[0]) => {
    try {
      if (preset.type === 'mixed') {
        const videos: VideoInfo[] = [];
        
        // Load individual videos
        for (const videoId of preset.content?.videos || []) {
          try {
            const title = await fetchVideoTitle(videoId);
            videos.push({
              id: videoId,
              title,
              thumbnail: `https://img.youtube.com/vi/${videoId}/maxresdefault.jpg`
            });
          } catch (error) {
            console.warn(`Video ${videoId} unavailable, skipping:`, error);
            continue;
          }
        }

        // Load videos from playlists
        for (const playlistId of preset.content?.playlists || []) {
          try {
            const playlistVideos = await getPlaylistVideos(playlistId);
            videos.push(...playlistVideos);
          } catch (error) {
            console.warn(`Playlist ${playlistId} unavailable, skipping:`, error);
            continue;
          }
        }

        if (videos.length > 0) {
          setPlaylist(videos);
          setCurrentVideo(videos[0]);
          setCurrentIndex(0);
          if (window.YT && window.YT.Player) {
            initializePlayer(videos[0].id);
          }
        } else {
          console.warn('No available videos found in preset');
        }
      } else {
        try {
          const videos = await getPlaylistVideos(preset.id);
          if (videos.length > 0) {
            setPlaylist(videos);
            setCurrentVideo(videos[0]);
            setCurrentIndex(0);
            if (window.YT && window.YT.Player) {
              initializePlayer(videos[0].id);
            }
          }
        } catch (error) {
          console.warn(`Playlist ${preset.id} unavailable:`, error);
        }
      }
    } catch (error) {
      console.error('Error loading preset playlist:', error);
    }
  };

  return (
    <Card>
      <CardContent className="space-y-4 p-6">
        {/* Preset Playlists */}
        <div className="space-y-2">
          <h3 className="font-medium">Preset Playlists</h3>
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-2">
            {PRESET_PLAYLISTS.map((preset) => (
              <Button
                key={preset.id}
                variant="outline"
                className="flex flex-col items-start p-4 h-auto space-y-1 text-left"
                onClick={() => loadPresetPlaylist(preset)}
              >
                <span className="font-medium">{preset.name}</span>
                <span className="text-sm text-gray-500">{preset.description}</span>
              </Button>
            ))}
          </div>
        </div>

        <div className="relative">
          <div className="absolute inset-0 flex items-center">
            <span className="w-full border-t" />
          </div>
          <div className="relative flex justify-center text-xs uppercase">
            <span className="bg-background px-2 text-muted-foreground">
              Or add your own
            </span>
          </div>
        </div>

        <form onSubmit={handleSubmit} className="space-y-2">
          <Input
            type="text"
            placeholder="Enter YouTube video URL"
            value={url}
            onChange={(e) => setUrl(e.target.value)}
            className="flex-1"
          />
          <p className="text-sm text-gray-500">
            Add your own videos or playlists using YouTube URLs
          </p>
          <Button type="submit" className="w-full">Add to Playlist</Button>
        </form>

        {currentVideo && (
          <div className="space-y-4">
            <div className="relative aspect-video rounded-lg overflow-hidden">
              <img 
                src={currentVideo.thumbnail}
                alt={currentVideo.title}
                className="w-full h-full object-cover"
              />
              <div 
                id="youtube-player"
                className="absolute top-0 left-0 w-full h-full opacity-0"
              />
            </div>
            
            <div className="space-y-2">
              <h3 className="font-medium text-lg">{currentVideo.title}</h3>
              
              <div className="flex items-center gap-4 justify-center">
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={handlePrevious}
                  disabled={currentIndex === 0}
                >
                  <SkipBack className="h-6 w-6" />
                </Button>
                
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={handlePlayPause}
                  disabled={!isPlayerReady}
                >
                  {isPlaying ? (
                    <PauseCircle className="h-8 w-8" />
                  ) : (
                    <PlayCircle className="h-8 w-8" />
                  )}
                </Button>
                
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={handleNext}
                  disabled={currentIndex === playlist.length - 1}
                >
                  <SkipForward className="h-6 w-6" />
                </Button>
              </div>

              <div className="space-y-2">
                <Slider
                  value={[progress]}
                  onValueChange={handleSeek}
                  max={100}
                  step={0.1}
                  className="w-full"
                />
                <div className="flex justify-between text-sm text-gray-500">
                  <span>{formatTime(duration * (progress / 100))}</span>
                  <span>{formatTime(duration)}</span>
                </div>
              </div>
            </div>
          </div>
        )}

        {playlist.length > 0 && (
          <div className="space-y-2">
            <h3 className="font-medium">Playlist</h3>
            <ScrollArea className="h-[300px] pr-4">
              <div className="space-y-2">
                {playlist.map((video, index) => (
                  <div
                    key={video.id}
                    className={`flex items-center gap-2 p-2 rounded-lg cursor-pointer hover:bg-gray-100 ${
                      index === currentIndex ? 'bg-gray-100' : ''
                    }`}
                    onClick={() => {
                      setCurrentVideo(video);
                      setCurrentIndex(index);
                      initializePlayer(video.id);
                    }}
                  >
                    <img
                      src={video.thumbnail}
                      alt={video.title}
                      className="w-16 h-9 object-cover rounded"
                    />
                    <span className="flex-1 truncate">{video.title}</span>
                  </div>
                ))}
              </div>
            </ScrollArea>
          </div>
        )}
      </CardContent>
    </Card>
  );
} 