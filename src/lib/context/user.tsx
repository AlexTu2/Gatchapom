import { ID } from "appwrite";
import { createContext, useContext, useEffect, useState, ReactNode } from "react";
import { account, BUCKET_ID, storage } from "../appwrite";
import type { UserPrefs } from '../types/user';
import { Models } from "appwrite";
import { useNavigate } from 'react-router-dom';
import { TimerSettings } from './timer';

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

// Add DEFAULT_SETTINGS definition
const DEFAULT_SETTINGS: TimerSettings = {
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
            timerSettings: JSON.stringify(defaultTimerSettings)
          };

          await account.updatePrefs(initialPrefs);
          const updatedUser = await account.get();
          if (isMounted) setUser(updatedUser);
        } else {
          // For existing users, ensure timerSettings exists
          const currentPrefs = response.prefs;
          let needsUpdate = false;
          let updatedPrefs = { ...currentPrefs };

          // Initialize missing preferences
          if (!currentPrefs.microLeons) {
            updatedPrefs.microLeons = "0";
            needsUpdate = true;
          }

          if (!currentPrefs.unlockedStickers) {
            updatedPrefs.unlockedStickers = "[]";
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
      } catch (error: any) {
        // Handle unauthorized or missing scope errors silently
        if (error?.code === 401 || 
            error?.message?.includes('missing scope (account)') ||
            error?.message?.includes('Unauthorized')) {
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
      const updatedPrefs = await account.updatePrefs({
        ...user.prefs,
        avatarId: fileId,
        avatarUrl: fileId ? storage.getFileView(BUCKET_ID, fileId).toString() : undefined
      });
      const typedPrefs = updatedPrefs as unknown as UserPrefs;
      setUser({ ...user, prefs: typedPrefs });
      return {
        avatarId: typedPrefs.avatarId,
        avatarUrl: typedPrefs.avatarUrl
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
        microLeons: "0",
        unlockedStickers: "[]",
        timerSettings: JSON.stringify(defaultTimerSettings)
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
      if (!user) throw new Error('No user logged in');

      console.log('UpdateUser called with:', {
        currentUser: user,
        updates,
        currentPrefs: user.prefs
      });

      // Get current prefs
      const currentPrefs = user.prefs;
      
      // Create clean updates object with only allowed fields
      const cleanUpdates: Partial<Models.Preferences> = { ...currentPrefs };
      
      // Only update fields that are actually provided in updates
      Object.keys(updates).forEach(key => {
        if (key in updates) {
          cleanUpdates[key] = updates[key];
        }
      });

      console.log('Clean updates:', cleanUpdates);

      // Update preferences with clean data
      await account.updatePrefs(cleanUpdates);
      
      // Get fresh user data
      const freshUser = await account.get();
      console.log('Fresh user after update:', {
        freshUser,
        freshPrefs: freshUser.prefs
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
