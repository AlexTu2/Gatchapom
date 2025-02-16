import { ID } from "appwrite";
import { createContext, useContext, useEffect, useState, ReactNode } from "react";
import { account, BUCKET_ID, storage } from "../appwrite";

interface UserPrefs {
  avatarId: string | null;
  avatarUrl: string | null;
}

interface UserContextType {
  current: {
    $id: string;
    email: string;
    name: string;
    prefs: UserPrefs;
  } | null;
  login: (email: string, password: string) => Promise<void>;
  logout: () => Promise<void>;
  register: (username: string, email: string, password: string) => Promise<void>;
  updateAvatar: (avatarId: string | null) => Promise<void>;
}

const UserContext = createContext<UserContextType | null>(null);

export function UserProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<UserContextType['current']>(null);

  useEffect(() => {
    account.get()
      .then(response => {
        const defaultPrefs: UserPrefs = {
          avatarId: null,
          avatarUrl: null
        };
        
        if (!response.prefs) {
          account.updatePrefs(defaultPrefs)
            .then(() => {
              setUser({ ...response, prefs: defaultPrefs });
            })
            .catch(error => {
              console.error('Failed to update preferences:', error);
              setUser(null);
            });
        } else {
          setUser({ ...response, prefs: response.prefs as UserPrefs });
        }
      })
      .catch(error => {
        console.error('Failed to fetch user:', error);
        setUser(null);
      });
  }, []);

  async function updateAvatar(avatarId: string | null) {
    if (!user) {
      throw new Error('No user logged in');
    }

    try {
      const updatedPrefs = await account.updatePrefs({
        ...user.prefs,
        avatarId,
        avatarUrl: avatarId ? storage.getFileView(BUCKET_ID, avatarId) : null
      });
      
      const typedPrefs = updatedPrefs as unknown as UserPrefs;
      setUser({ ...user, prefs: typedPrefs });
      return typedPrefs;
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
          avatarId: null,
          avatarUrl: null
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
        avatarId: null,
        avatarUrl: null
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
      updateAvatar: async (avatarId: string | null) => {
        await updateAvatar(avatarId);
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
