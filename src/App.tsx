import { Login } from "./pages/Login";  
import { Home } from "./pages/Home";  
import { UserProvider } from "./lib/context/user";
import { IdeasProvider } from "./lib/context/ideas";
import { useUser } from "./lib/context/user";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { useEffect } from "react";

function App(): JSX.Element {
  const isLoginPage = window.location.pathname === "/login";
  
  // Request notification permission when app loads
  useEffect(() => {
    if ("Notification" in window) {
      Notification.requestPermission();
    }
  }, []);

  return (
    <div>
    <UserProvider>
      <IdeasProvider>
        <Navbar />
        <main>{isLoginPage ? <Login /> : <Home />}</main>
      </IdeasProvider>
    </UserProvider>
  </div>
  );
}

function Navbar(): JSX.Element {
  const user = useUser();

  return (
    <nav className="border-b">
      <div className="container flex h-14 items-center px-4 max-w-7xl mx-auto">
        <a href="/" className="font-semibold text-lg">
          Gatchapom
        </a>
        <div className="ml-auto flex items-center gap-4">
          {user.current ? (
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="ghost" className="relative">
                  <span>{user.current.email}</span>
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                <DropdownMenuItem onClick={() => user.logout()}>
                  Logout
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          ) : (
            <Button asChild variant="default">
              <a href="/login">Login</a>
            </Button>
          )}
        </div>
      </div>
    </nav>
  );
}

export default App;
