import { ID } from "appwrite";
import { createContext, useContext, useEffect, useState, ReactNode } from "react";
import { account, client, BUCKET_ID, storage } from "../appwrite";

interface UserContextType {
  current: any;
  login: (email: string, password: string) => Promise<void>;
  logout: () => Promise<void>;
  register: (username: string, email: string, password: string) => Promise<void>;
  updateAvatar: (avatarId: string | null) => Promise<void>;
}

const UserContext = createContext<UserContextType | null>(null);

export function UserProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<any>(null);

  useEffect(() => {
    account.get()
      .then(response => {
        if (!response.prefs) {
          account.updatePrefs({
            avatarId: null,
            avatarUrl: null
          }).then(updatedUser => {
            setUser({ ...response, prefs: updatedUser });
          });
        } else {
          setUser(response);
        }
      })
      .catch(() => setUser(null));
  }, []);

  async function updateAvatar(avatarId: string | null) {
    try {
      const updatedPrefs = await account.updatePrefs({
        ...user.prefs,
        avatarId,
        avatarUrl: avatarId ? storage.getFileView(BUCKET_ID, avatarId) : null
      });
      
      const updatedUser = { ...user, prefs: updatedPrefs };
      setUser(updatedUser);
      return updatedPrefs;
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
        setUser({ ...loggedInUser, prefs: updatedUser });
      } else {
        setUser(loggedInUser);
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
      setUser({ ...loggedInUser, prefs: updatedUser });
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
      updateAvatar 
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
