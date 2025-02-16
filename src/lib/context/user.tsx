import { ID } from "appwrite";
import { createContext, useContext, useEffect, useState, ReactNode } from "react";
import { account } from "../appwrite";

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
    // Check if user is logged in
    account.get()
      .then(response => {
        console.log('User loaded:', response); // Debug log
        if (!response.prefs) {
          // Initialize preferences if they don't exist
          account.updatePrefs({
            avatarId: null,
            avatarUrl: null
          }).then(updatedUser => {
            console.log('Initialized prefs:', updatedUser); // Debug log
            setUser({ ...response, prefs: updatedUser });
          });
        } else {
          setUser(response);
        }
      })
      .catch(error => {
        console.error('Error loading user:', error);
        setUser(null);
      });
  }, []);

  async function updateAvatar(avatarId: string | null) {
    try {
      console.log('Updating avatar:', avatarId); // Debug log
      const updatedPrefs = await account.updatePrefs({
        ...user.prefs,
        avatarId,
        avatarUrl: avatarId ? `${client.endpoint}/storage/buckets/${BUCKET_ID}/files/${avatarId}/view?project=${client.config.project}` : null
      });
      console.log('Updated prefs:', updatedPrefs); // Debug log
      setUser({ ...user, prefs: updatedPrefs });
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
      // Initialize preferences if they don't exist
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
      // Initialize preferences
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
