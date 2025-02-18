import { createContext, useContext, useEffect, useState, ReactNode } from "react";
import { account, BUCKET_ID, ID, storage } from "../appwrite";
import { Models } from "appwrite";
import { useNavigate } from 'react-router-dom';

interface UserContextType {
  current: Models.User<Models.Preferences> | null;
  isLoading: boolean;
  login: (email: string, password: string) => void;
  logout: () => void;
  register: (username: string, email: string, password: string) => void;
  updateAvatar: (fileId: string) => void;
  updateUser: (updates: Partial<Models.Preferences>) => void;
}

const UserContext = createContext<UserContextType | undefined>(undefined);

const DEFAULT_SETTINGS = {
  work: 25,
  shortBreak: 5,
  longBreak: 15,
  longBreakInterval: 4,
  currentMode: 'work'
};

export function UserProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<Models.User<Models.Preferences> | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const navigate = useNavigate();

  useEffect(() => {
    let isMounted = true;

    // Check if user is logged in
    const checkUser = async () => {
      // Don't check user on login or register pages
      if (window.location.pathname === '/login' || window.location.pathname === '/register') {
        setIsLoading(false);
        return;
      }

      try {
        const response = await account.get();
        
        if (!isMounted) return;

        // For completely new users with no prefs
        if (!response.prefs) {
          const defaultTimerSettings = {
            work: 25,
            shortBreak: 5,
            longBreak: 15,
            longBreakInterval: 4,
            currentMode: 'work'
          };

          const initialPrefs = {
            avatarUrl: null,
            microLeons: "0",
            unlockedStickers: "[]",
            timerSettings: JSON.stringify(defaultTimerSettings),
            volume: "0.5"
          };

          await account.updatePrefs(initialPrefs);
          const updatedUser = await account.get();
          if (isMounted) setUser(updatedUser);
        } else {
          // For existing users, ensure timerSettings exists
          const currentPrefs = response.prefs;
          let needsUpdate = false;
          const updatedPrefs = { ...currentPrefs };

          // Initialize missing preferences
          if (!currentPrefs.microLeons) {
            updatedPrefs.microLeons = "0";
            needsUpdate = true;
          }

          if (!currentPrefs.unlockedStickers) {
            updatedPrefs.unlockedStickers = "[]";
            needsUpdate = true;
          }

          if (!currentPrefs.volume) {
            updatedPrefs.volume = "0.5";
            needsUpdate = true;
          }

          // Only update if we need to
          if (needsUpdate) {
            await account.updatePrefs(updatedPrefs);
            const updatedUser = await account.get();
            if (isMounted) setUser(updatedUser);
          } else {
            if (isMounted) setUser(response);
          }
        }
      } catch (error: unknown) {
        // Handle unauthorized or missing scope errors silently
        if (
          (error as { code?: number })?.code === 401 || 
          (error as { message?: string })?.message?.includes('missing scope (account)')
        ) {
          if (isMounted) {
            setUser(null);
            // Only navigate if we're not already on the login or register page
            const currentPath = window.location.pathname;
            if (currentPath !== '/login' && currentPath !== '/register') {
              navigate('/login');
            }
          }
        } else {
          // Log other types of errors
          console.error('Error getting user:', error);
          if (isMounted) setUser(null);
        }
      } finally {
        if (isMounted) setIsLoading(false);
      }
    };

    checkUser();

    return () => {
      isMounted = false;
    };
  }, [navigate]);

  async function updateAvatar(fileId: string) {
    if (!user) {
      throw new Error('No user logged in');
    }

    try {
      // Get fresh user data first
      const currentUser = await account.get();
      
      // Merge existing preferences with avatar updates
      const updatedPrefs = {
        ...currentUser.prefs,
        avatarId: fileId,
        avatarUrl: fileId ? storage.getFileView(BUCKET_ID, fileId).toString() : undefined
      };

      await account.updatePrefs(updatedPrefs);
      const freshUser = await account.get();
      
      return {
        avatarId: freshUser.prefs.avatarId,
        avatarUrl: freshUser.prefs.avatarUrl
      };
    } catch (error) {
      console.error('Update avatar error:', error);
      throw error;
    }
  }

  const login = async (email: string, password: string) => {
    try {
      await account.createEmailPasswordSession(email, password);
      const response = await account.get();
      setUser(response);
      navigate('/');  // Use navigate instead of window.location
    } catch (error) {
      console.error('Login error:', error);
      throw error;
    }
  };

  const logout = async () => {
    try {
      await account.deleteSession('current');
      setUser(null);
      navigate('/login');  // Use navigate instead of window.location
    } catch (error) {
      console.error('Error logging out:', error);
    }
  };

  const register = async (username: string, email: string, password: string) => {
    try {
      await account.create(ID.unique(), email, password, username);
      await account.createEmailPasswordSession(email, password);
      
      const defaultTimerSettings = {
        work: 25,
        shortBreak: 5,
        longBreak: 15,
        longBreakInterval: 4,
        currentMode: 'work'
      };

      // Only include the essential preference fields
      const initialPrefs = {
        avatarUrl: null,
        microLeons: "1000",
        unlockedStickers: "[]",
        timerSettings: JSON.stringify(defaultTimerSettings),
        volume: "0.5"
      };

      await account.updatePrefs(initialPrefs);
      const finalUser = await account.get();
      setUser(finalUser);
      navigate('/');
    } catch (error) {
      console.error('Registration error:', error);
      throw error;
    }
  };

  const updateUser = async (updates: Partial<Models.Preferences>) => {
    try {
      // Get fresh user data first
      const currentUser = await account.get();
      
      // Ensure all required fields exist with defaults if not present
      const basePrefs = {
        ...currentUser.prefs,  // Spread existing prefs FIRST
        // Then ensure these required fields exist with defaults if missing
        microLeons: currentUser.prefs.microLeons || "0",
        unlockedStickers: currentUser.prefs.unlockedStickers || "[]",
        timerSettings: currentUser.prefs.timerSettings || JSON.stringify(DEFAULT_SETTINGS),
        volume: currentUser.prefs.volume || "0.5"
      };

      // Merge with updates
      const mergedPrefs = {
        ...basePrefs,
        ...updates
      };

      // Update preferences with merged object
      await account.updatePrefs(mergedPrefs);
      
      // Get fresh user data after update
      const freshUser = await account.get();
      console.log('User preferences updated:', {
        before: currentUser.prefs,
        updates,
        after: freshUser.prefs,
        merged: mergedPrefs
      });

      setUser(freshUser);
    } catch (error) {
      console.error('Error updating user:', error);
      throw error;
    }
  };

  return (
    <UserContext.Provider value={{ 
      current: user, 
      isLoading,
      login, 
      logout,
      register,
      updateAvatar: async (fileId: string) => {
        await updateAvatar(fileId);
        return;
      },
      updateUser
    }}>
      {children}
    </UserContext.Provider>
  );
}

export function useUser() {
  const context = useContext(UserContext);
  if (!context) {
    throw new Error("useUser must be used within a UserProvider");
  }
  return context;
}
