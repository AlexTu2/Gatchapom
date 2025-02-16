import { ID } from "appwrite";
import { createContext, useContext, useEffect, useState, ReactNode } from "react";
import { account, BUCKET_ID, storage } from "../appwrite";
import type { UserPrefs, UserContextType } from '../types/user';
import { Models } from "appwrite";

interface UserContextType {
  current: Models.User<Models.Preferences> | null;
  login: (email: string, password: string) => void;
  logout: () => void;
  register: (username: string, email: string, password: string) => void;
  updateAvatar: (fileId: string) => void;
  updateUser: (user: Models.User<Models.Preferences>) => void;
}

const UserContext = createContext<UserContextType | undefined>(undefined);

export function UserProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<Models.User<Models.Preferences> | null>(null);

  useEffect(() => {
    // Check if user is logged in
    account.get()
      .then(async (response) => {
        // Initialize preferences if they don't exist
        if (!response.prefs?.avatarUrl && !response.prefs?.microLeons) {
          await account.updatePrefs({
            avatarUrl: null,
            microLeons: "0",
          });
          // Fetch updated user data
          const updatedUser = await account.get();
          setUser(updatedUser);
        } else {
          setUser(response);
        }
      })
      .catch(() => {
        setUser(null);
      });
  }, []);

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
      window.location.href = '/';
    } catch (error) {
      console.error('Login error:', error);
      throw error;
    }
  };

  const logout = async () => {
    try {
      await account.deleteSession('current');
      setUser(null);
      window.location.href = '/';
    } catch (error) {
      console.error('Error logging out:', error);
    }
  };

  async function register(username: string, email: string, password: string) {
    try {
      await account.create(ID.unique(), email, password, username);
      await account.createEmailPasswordSession(email, password);
      const loggedInUser = await account.get();
      const updatedUser = await account.updatePrefs({
        avatarId: undefined,
        avatarUrl: undefined
      });
      const typedPrefs = updatedUser as unknown as UserPrefs;
      setUser({ ...loggedInUser, prefs: typedPrefs });
      window.location.replace("/");
    } catch (error) {
      console.error('Registration error:', error);
      throw error;
    }
  }

  const updateUser = (updatedUser: Models.User<Models.Preferences>) => {
    setUser(updatedUser);
  };

  return (
    <UserContext.Provider value={{ 
      current: user, 
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
