import { Login } from "./pages/Login";  
import { Home } from "./pages/Home";  
import { Profile } from "./pages/Profile";
import { UserProvider } from "./lib/context/user";
import { IdeasProvider } from "./lib/context/ideas";
import { Navbar } from "@/components/Navbar";
import { useEffect } from "react";
import { useUser } from "./lib/context/user";

function AppRoutes(): JSX.Element {
  const user = useUser();
  const isLoginPage = window.location.pathname === "/login";
  const isProfilePage = window.location.pathname === "/profile";

  if (!user.current && !isLoginPage) {
    window.location.replace("/login");
    return <></>;
  }

  return isLoginPage ? <Login /> : 
         isProfilePage ? <Profile /> : 
         <Home />;
}

function AppContent(): JSX.Element {
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

function App(): JSX.Element {
  return (
    <UserProvider>
      <IdeasProvider>
        <AppContent />
      </IdeasProvider>
    </UserProvider>
  );
}

export default App;
