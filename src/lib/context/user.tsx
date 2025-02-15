import { ID } from "appwrite";
import { createContext, useContext, useEffect, useState, ReactNode } from "react";
import { account } from "../appwrite";

interface UserContextType {
  current: any; // Replace 'any' with your user type if available
  login: (email: string, password: string) => Promise<void>;
  logout: () => Promise<void>;
  register: (email: string, password: string) => Promise<void>;
}

const UserContext = createContext<UserContextType | undefined>(undefined);

export function useUser() {
  const context = useContext(UserContext);
  if (context === undefined) {
    throw new Error('useUser must be used within a UserProvider');
  }
  return context;
}

interface UserProviderProps {
  children: ReactNode;
}

export function UserProvider({ children }: UserProviderProps) {
  const [user, setUser] = useState<any>(null); // Replace 'any' with your user type if available

  async function login(email, password) {
    const loggedIn = await account.createEmailPasswordSession(email, password);
    setUser(loggedIn);
    window.location.replace("/");
  }

  async function logout() {
    await account.deleteSession("current");
    setUser(null);
  }

  async function register(email, password) {
    await account.create(ID.unique(), email, password);
    await login(email, password);
  }

  async function init() {
    try {
      const loggedIn = await account.get();
      setUser(loggedIn);
    } catch (err) {
      setUser(null);
    }
  }

  useEffect(() => {
    init();
  }, []);

  return (
    <UserContext.Provider value={{ current: user, login, logout, register }}>
      {children}
    </UserContext.Provider>
  );
}
