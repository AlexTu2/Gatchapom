import { useUser } from "@/lib/context/user";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { useEffect, useState } from "react";
import { Link } from "react-router-dom";

export function Navbar() {
  const user = useUser();
  const [avatarUrl, setAvatarUrl] = useState<string | null>(null);
  const [microLeons, setMicroLeons] = useState(0);

  useEffect(() => {
    console.log('Current user:', user.current);
    console.log('User prefs:', user.current?.prefs);
    console.log('Avatar URL from prefs:', user.current?.prefs?.avatarUrl);
    
    if (user.current?.prefs?.avatarUrl) {
      console.log('Setting avatar URL to:', user.current.prefs.avatarUrl);
      setAvatarUrl(user.current.prefs.avatarUrl);
    } else {
      console.log('No avatar URL found, setting to null');
      setAvatarUrl(null);
    }
  }, [user.current?.prefs?.avatarUrl]);

  useEffect(() => {
    console.log('Current microLeons from prefs:', user.current?.prefs?.microLeons);
    if (user.current?.prefs?.microLeons) {
      setMicroLeons(Number(user.current.prefs.microLeons) || 0);
    }
  }, [user.current?.prefs?.microLeons]);

  console.log('Current avatarUrl state:', avatarUrl);

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
              <img 
                src="/learnwithleon/microLeon.png" 
                alt="Micro Leon" 
                className="h-6 w-6"
              />
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
                <DropdownMenuItem onClick={() => user.logout()}>
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