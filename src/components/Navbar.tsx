import { useUser } from "@/lib/context/user";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { useEffect, useState } from "react";

export function Navbar() {
  const user = useUser();
  const [avatarUrl, setAvatarUrl] = useState<string | null>(null);

  useEffect(() => {
    if (user.current?.prefs?.avatarUrl) {
      setAvatarUrl(user.current.prefs.avatarUrl.toString());
    } else {
      setAvatarUrl(null);
    }
  }, [user.current?.prefs?.avatarUrl]);

  return (
    <nav className="border-b bg-white">
      <div className="flex justify-between items-center p-4 container mx-auto">
        <div className="flex items-center gap-4">
          <Button 
            variant="ghost" 
            className="text-xl font-bold"
            onClick={() => window.location.href = '/'}
          >
            Pomodoro Timer
          </Button>
          <Button
            variant="ghost"
            onClick={() => window.location.href = '/chat'}
          >
            Chat
          </Button>
        </div>
        
        {user.current && (
          <div className="flex items-center gap-3">
            <span className="text-sm font-medium">{user.current.name}</span>
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="ghost" className="relative h-8 w-8 rounded-full overflow-hidden p-0">
                  {avatarUrl ? (
                    <img
                      key={avatarUrl}
                      src={avatarUrl}
                      alt="Profile"
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
                <DropdownMenuItem onClick={() => window.location.href = '/profile'}>
                  Profile
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