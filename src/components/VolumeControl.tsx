import { Slider } from "@/components/ui/slider";
import { Volume2 } from "lucide-react";
import { useAudio } from "@/lib/context/audio";

export function VolumeControl() {
  const { volume, setVolume, commitVolume } = useAudio();

  return (
    <div className="flex items-center gap-2">
      <Volume2 className="h-4 w-4" />
      <div className="w-24">
        <Slider
          defaultValue={[volume]}
          value={[volume]}
          max={1}
          step={0.1}
          onValueChange={(value: number[]) => setVolume(value[0])}
          onValueCommit={(value: number[]) => commitVolume(value[0])}
          className="relative flex h-5 w-full touch-none select-none items-center"
        />
      </div>
    </div>
  );
} 