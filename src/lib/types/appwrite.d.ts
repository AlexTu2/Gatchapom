declare module 'appwrite' {
  namespace Models {
    interface Preferences {
      avatarUrl?: string | null;
      avatarId?: string;
      microLeons: string;
      unlockedStickers: string;
      timerSettings: string;
      volume: string;
    }

    interface User<Prefs = Preferences> {
      $id: string;
      name: string;
      email: string;
      prefs: Prefs;
      $createdAt: string;
    }

    interface File {
      $id: string;
      name: string;
      $createdAt: string;
      $updatedAt: string;
    }
  }

  export const ID: {
    unique: () => string;
  };

  export const Query: {
    limit: (limit: number) => string;
    orderDesc: (field: string) => string;
  };

  export class Client {
    setEndpoint: (endpoint: string) => this;
    setProject: (projectId: string) => this;
    subscribe: (events: string[], callback: (response: RealtimeResponseEvent<unknown>) => void) => (() => void);
    disconnect?: () => void;
  }
} 