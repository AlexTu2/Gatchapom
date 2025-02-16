export interface UserPrefs {
  avatarId?: string | undefined;
  avatarUrl?: string | undefined;
}

export interface User {
  $id: string;
  $createdAt: string;
  email: string;
  name: string;
  prefs: UserPrefs;
}

export interface UserContextType {
  current: User | null;
  login: (email: string, password: string) => Promise<void>;
  logout: () => Promise<void>;
  register: (username: string, email: string, password: string) => Promise<void>;
  updateAvatar: (fileId: string) => Promise<void>;
}

export interface Message {
  $id: string;
  content: string;
  userId: string;
  userName: string;
  userAvatar?: string;
  createdAt: string;
} 