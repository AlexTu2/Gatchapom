import { ID } from "appwrite";
import { createContext, useContext, useEffect, useState, ReactNode } from "react";
import { account, BUCKET_ID, storage } from "../appwrite";
import type { UserPrefs, UserContextType } from '../types/user';

const UserContext = createContext<UserContextType>({ current: null, login: async () => {}, logout: async () => {}, register: async () => {}, updateAvatar: async () => {} });

export function UserProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<UserContextType['current']>(null);

  useEffect(() => {
    account.get()
      .then(response => {
        if (!response.prefs) {
          account.updatePrefs({
            avatarId: undefined,
            avatarUrl: undefined
          })
            .then(() => {
              setUser({ ...response, prefs: {
                avatarId: undefined,
                avatarUrl: undefined
              }});
            })
            .catch(error => {
              console.error('Failed to update preferences:', error);
              setUser(null);
            });
        } else {
          setUser({ ...response, prefs: {
            avatarId: response.prefs.avatarId ?? undefined,
            avatarUrl: response.prefs.avatarUrl ?? undefined
          }});
        }
      })
      .catch(error => {
        console.error('Failed to fetch user:', error);
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

  async function login(email: string, password: string) {
    try {
      await account.createEmailPasswordSession(email, password);
      const loggedInUser = await account.get();
      if (!loggedInUser.prefs) {
        const updatedUser = await account.updatePrefs({
          avatarId: undefined,
          avatarUrl: undefined
        });
        const typedPrefs = updatedUser as unknown as UserPrefs;
        setUser({ ...loggedInUser, prefs: typedPrefs });
      } else {
        setUser({ ...loggedInUser, prefs: loggedInUser.prefs as UserPrefs });
      }
      window.location.replace("/");
    } catch (error) {
      console.error('Login error:', error);
      throw error;
    }
  }

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

  async function logout() {
    try {
      await account.deleteSession('current');
      setUser(null);
      window.location.replace("/login");
    } catch (error) {
      console.error('Logout error:', error);
      throw error;
    }
  }

  return (
    <UserContext.Provider value={{ 
      current: user, 
      login, 
      logout,
      register,
      updateAvatar: async (fileId: string) => {
        await updateAvatar(fileId);
        return;
      }
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
