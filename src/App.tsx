import { Login } from "@/pages/Login";  
import { Home } from "@/pages/Home";  
import { Profile } from "@/pages/Profile";
import { UserProvider } from "./lib/context/user";
import { TimerProvider } from "./lib/context/timer";
import { Navbar } from "@/components/Navbar";
import { useEffect } from "react";
import { useUser } from "./lib/context/user";
import { Chat } from "@/pages/Chat";
import { BrowserRouter } from "react-router-dom";

function AppRoutes() {
  const user = useUser();
  const isLoginPage = window.location.pathname === "/login";
  const isProfilePage = window.location.pathname === "/profile";
  const isChatPage = window.location.pathname === "/chat";

  if (!user.current && !isLoginPage) {
    window.location.replace("/login");
    return null;
  }

  return isLoginPage ? <Login /> : 
         isProfilePage ? <Profile /> :
         isChatPage ? <Chat /> :
         <Home />;
}

function AppContent() {
  const user = useUser();

  // Request notification permission when app loads
  useEffect(() => {
    if ("Notification" in window) {
      Notification.requestPermission();
    }
  }, []);

  if (!user.current && window.location.pathname !== "/login") {
    return <Login />;
  }

  return (
    <div className="min-h-screen bg-gray-50">
      {user.current && <Navbar />}
      <main className="container mx-auto px-4 py-8">
        <AppRoutes />
      </main>
    </div>
  );
}

function App() {
  return (
    <BrowserRouter>
      <UserProvider>
        <TimerProvider>
          <AppContent />
        </TimerProvider>
      </UserProvider>
    </BrowserRouter>
  );
}

export default App;
