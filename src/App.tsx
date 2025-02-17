import { Login } from "@/pages/Login";  
import { Home } from "@/pages/Home";  
import { Profile } from "@/pages/Profile";
import { Store } from "./pages/Store";
import { UserProvider, useUser } from "./lib/context/user";
import { TimerProvider } from "./lib/context/timer";
import { Navbar } from "@/components/Navbar";
import { useEffect } from "react";
import { BrowserRouter, Routes, Route, Navigate, useLocation } from "react-router-dom";
import { AvatarProvider } from '@/lib/context/avatar';

function RequireAuth({ children }: { children: React.ReactNode }) {
  const { current: user, isLoading } = useUser();
  const location = useLocation();
  
  // Show nothing while checking authentication
  if (isLoading) {
    return null;
  }

  if (!user) {
    // Redirect them to the /login page, but save the current location they were
    // trying to go to when they were redirected. This allows us to send them
    // along to that page after they login, which is a nicer user experience
    // than dropping them off on the home page.
    return <Navigate to="/login" state={{ from: location }} replace />;
  }

  return <>{children}</>;
}

function AppContent() {
  const { current: user, isLoading } = useUser();

  // Request notification permission when app loads
  useEffect(() => {
    if ("Notification" in window) {
      Notification.requestPermission();
    }
  }, []);

  // Show nothing while checking authentication
  if (isLoading) {
    return null;
  }

  return (
    <div className="min-h-screen bg-gray-50">
      {user && <Navbar />}
      <main className="container mx-auto px-4 py-8">
        <Routes>
          <Route path="/login" element={
            user ? <Navigate to="/" replace /> : <Login />
          } />
          <Route path="/" element={
            <RequireAuth>
              <Home />
            </RequireAuth>
          } />
          <Route path="/profile" element={
            <RequireAuth>
              <Profile />
            </RequireAuth>
          } />
          <Route path="/store" element={
            <RequireAuth>
              <Store />
            </RequireAuth>
          } />
        </Routes>
      </main>
    </div>
  );
}

function App() {
  return (
    <BrowserRouter>
      <UserProvider>
        <AvatarProvider>
          <TimerProvider>
            <AppContent />
          </TimerProvider>
        </AvatarProvider>
      </UserProvider>
    </BrowserRouter>
  );
}

export default App;
