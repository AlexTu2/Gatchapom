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

  export class Account {
    constructor(client: Client);
    create: (userId: string, email: string, password: string, name: string) => Promise<Models.User<Models.Preferences>>;
    createEmailPasswordSession: (email: string, password: string) => Promise<Models.Session>;
    createSession: (email: string, password: string) => Promise<Models.Session>;
    updateName: (name: string) => Promise<Models.User<Models.Preferences>>;
    updatePassword: (password: string, oldPassword: string) => Promise<Models.User<Models.Preferences>>;
    updateEmail: (email: string, password: string) => Promise<Models.User<Models.Preferences>>;
    updatePrefs: (prefs: Partial<Models.Preferences>) => Promise<Models.User<Models.Preferences>>;
    get: () => Promise<Models.User<Models.Preferences>>;
    deleteSession: (sessionId: string) => Promise<void>;
    deleteSessions: () => Promise<void>;
  }

  export class Databases {
    constructor(client: Client);
    createDocument: <T extends object>(databaseId: string, collectionId: string, documentId: string, data: T) => Promise<T>;
    listDocuments: <T extends object>(databaseId: string, collectionId: string, queries?: string[]) => Promise<{ documents: T[] }>;
    updateDocument: <T extends object>(databaseId: string, collectionId: string, documentId: string, data: T) => Promise<T>;
  }

  export class Storage {
    constructor(client: Client);
    createFile: (bucketId: string, fileId: string, file: File, permissions?: string[]) => Promise<Models.File>;
    listFiles: (bucketId: string) => Promise<{ files: Models.File[] }>;
    getFileView: (bucketId: string, fileId: string) => string;
    deleteFile: (bucketId: string, fileId: string) => Promise<void>;
  }

  export const Permission: {
    read: (role: string) => string;
    write: (role: string) => string;
    update: (role: string) => string;
    delete: (role: string) => string;
  };

  export const Role: {
    any: () => string;
    users: () => string;
    guests: () => string;
  };
} 