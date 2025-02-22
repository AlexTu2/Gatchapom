import { useUser } from "@/lib/context/user";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { useEffect, useMemo } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useStickers } from '@/lib/hooks/useStickers';
import { useAvatar } from '@/lib/context/avatar';
import { VolumeControl } from './VolumeControl';
import { MICRO_LEON_STICKER_ID } from '../config/constants';

export function Navbar() {
  const user = useUser();
  const navigate = useNavigate();
  const { getStickerUrl } = useStickers();
  const { avatarUrl, setAvatarUrl } = useAvatar();
  const microLeons = Number(user.current?.prefs.microLeons) || 0;

  useEffect(() => {
    if (user.current?.prefs.avatarUrl) {
      const url = new URL(user.current.prefs.avatarUrl);
      url.searchParams.set('t', Date.now().toString());
      setAvatarUrl(url.toString());
    } else {
      setAvatarUrl(null);
    }
  }, [user.current?.prefs.avatarUrl, setAvatarUrl, user]);

  // Find microLeon sticker
  const microLeonSticker = useMemo(() => ({
    $id: '67b27bbc001cba8f5ed9',
    name: 'microLeon.png'
  }), []);

  const handleLogout = async () => {
    await user.logout();
    navigate('/login');
  };

  return (
    <nav className="border-b bg-gradient-to-r from-[#2ea44f] to-[#3b82f6] text-white shadow-md">
      <div className="flex justify-between items-center p-4 container mx-auto">
        <div className="flex items-center gap-4">
          <Link to="/">
            <Button 
              variant="ghost" 
              className="text-xl font-bold text-white hover:text-white/90 hover:bg-white/10"
            >
              Pomodoro Timer
            </Button>
          </Link>
          <Link 
            to="/store" 
            className="text-sm font-medium text-white/90 hover:text-white"
          >
            Store
          </Link>
        </div>
        
        {user.current && (
          <div className="flex items-center gap-3">
            <VolumeControl />
            <div className="flex items-center gap-2 bg-white/10 px-3 py-1.5 rounded-full">
              <img 
                src={getStickerUrl(MICRO_LEON_STICKER_ID)}
                alt="Micro Leon" 
                className="h-8 w-8"
                onError={(e) => {
                  console.error('Failed to load microLeon sticker');
                  e.currentTarget.src = '/microLeon.png';
                }}
              />
              <span className="font-medium text-white">{microLeons}</span>
            </div>
            <span className="text-sm font-medium text-white/90">{user.current.name}</span>
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="ghost" className="relative h-8 w-8 rounded-full overflow-hidden p-0">
                  {avatarUrl ? (
                    <img
                      key={avatarUrl}
                      src={avatarUrl}
                      alt={user.current?.name}
                      className="h-full w-full object-cover"
                      onError={() => setAvatarUrl(null)}
                    />
                  ) : (
                    <div className="h-full w-full bg-gray-200 flex items-center justify-center text-sm font-medium">
                      {user.current?.name?.charAt(0).toUpperCase()}
                    </div>
                  )}
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                <DropdownMenuItem asChild>
                  <Link to="/profile">Profile</Link>
                </DropdownMenuItem>
                <DropdownMenuItem onClick={handleLogout}>
                  Logout
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        )}
      </div>
    </nav>
  );
} 