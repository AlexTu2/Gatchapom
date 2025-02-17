import { useMusic } from '../lib/context/music';
import { Button } from '../components/ui/button';
import { Play, Pause } from 'lucide-react';

export function MusicControl() {
  const { isPlaying, currentTrack, togglePlayback, isReady } = useMusic();

  return (
    <div className="flex items-center gap-4">
      <Button 
        variant="ghost" 
        size="icon"
        onClick={() => {
          console.log('Music control clicked:', { isPlaying, isReady });
          togglePlayback();
        }}
        className="h-8 w-8"
        disabled={!isReady}
      >
        {isPlaying ? <Pause className="h-4 w-4" /> : <Play className="h-4 w-4" />}
      </Button>
      <div className="flex flex-col">
        {currentTrack && (
          <span className="text-sm text-muted-foreground truncate max-w-[200px]">
            {currentTrack}
          </span>
        )}
        <span className="text-xs text-muted-foreground">
          {isReady ? 'Ready' : 'Loading...'}
        </span>
      </div>
    </div>
  );
} 