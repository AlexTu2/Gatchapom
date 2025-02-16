import { Login } from "@/pages/Login";  
import { Home } from "@/pages/Home";  
import { Profile } from "@/pages/Profile";
import { UserProvider } from "./lib/context/user";
import { TimerProvider } from "./lib/context/timer";
import { Navbar } from "@/components/Navbar";
import { useEffect } from "react";
import { useUser } from "./lib/context/user";
import { BrowserRouter } from "react-router-dom";
import { Store } from "./pages/Store";

function AppRoutes() {
  const user = useUser();
  const path = window.location.pathname;

  if (!user.current && path !== "/login") {
    window.location.replace("/login");
    return null;
  }

  switch (path) {
    case "/login":
      return <Login />;
    case "/profile":
      return <Profile />;
    case "/store":
      return <Store />;
    default:
      return <Home />;
  }
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
