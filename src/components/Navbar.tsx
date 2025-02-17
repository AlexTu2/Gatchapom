import { useUser } from "@/lib/context/user";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { useEffect, useState, useMemo } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useStickers } from '@/lib/hooks/useStickers';

export function Navbar() {
  const user = useUser();
  const navigate = useNavigate();
  const { getStickerUrl, stickers } = useStickers();
  const [avatarUrl, setAvatarUrl] = useState<string | null>(null);
  const microLeons = Number(user.current?.prefs.microLeons) || 0;

  useEffect(() => {
    if (user.current?.prefs) {
      setAvatarUrl(user.current.prefs.avatarUrl || null);
      
      if (process.env.NODE_ENV === 'development') {
        console.debug('User preferences updated:', {
          microLeons: user.current.prefs.microLeons,
          avatarUrl: user.current.prefs.avatarUrl
        });
      }
    }
  }, [user.current?.prefs]);

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
    <nav className="border-b bg-white">
      <div className="flex justify-between items-center p-4 container mx-auto">
        <div className="flex items-center gap-4">
          <Link to="/">
            <Button 
              variant="ghost" 
              className="text-xl font-bold"
            >
              Pomodoro Timer
            </Button>
          </Link>
          <Link 
            to="/store" 
            className="text-sm font-medium text-gray-500 hover:text-gray-900"
          >
            Store
          </Link>
        </div>
        
        {user.current && (
          <div className="flex items-center gap-3">
            <div className="flex items-center gap-2 text-yellow-600">
              {microLeonSticker && (
                <img 
                  src={getStickerUrl(microLeonSticker.$id)}
                  alt="Micro Leon" 
                  className="h-6 w-6"
                  onError={(e) => {
                    console.error('Failed to load microLeon sticker');
                    e.currentTarget.src = '/fallback-sticker.png';
                  }}
                />
              )}
              <span className="font-medium">{microLeons}</span>
            </div>
            <span className="text-sm font-medium">{user.current.name}</span>
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="ghost" className="relative h-8 w-8 rounded-full overflow-hidden p-0">
                  {avatarUrl ? (
                    <img
                      src={avatarUrl}
                      alt={user.current.name}
                      className="h-full w-full object-cover"
                    />
                  ) : (
                    <div className="h-full w-full bg-gray-200 flex items-center justify-center text-sm font-medium">
                      {user.current.name?.charAt(0).toUpperCase()}
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