import { createContext, useContext, useEffect, useState, ReactNode } from "react";
import { databases } from "../appwrite";
import { ID, Query, Models } from "appwrite";

export const IDEAS_DATABASE_ID = "idea-tracker"; // Replace with your database ID
export const IDEAS_COLLECTION_ID = "idea-tracker"; // Replace with your collection ID

interface Idea extends Models.Document {
  // Add your idea-specific fields here
  // For example: title: string; description: string;
}

interface IdeasContextType {
  current: Idea[];
  add: (idea: Partial<Idea>) => Promise<void>;
  remove: (id: string) => Promise<void>;
}

const IdeasContext = createContext<IdeasContextType | undefined>(undefined);

export function useIdeas(): IdeasContextType {
  const context = useContext(IdeasContext);
  if (!context) {
    throw new Error("useIdeas must be used within an IdeasProvider");
  }
  return context;
}

interface IdeasProviderProps {
  children: ReactNode;
}

export function IdeasProvider({ children }: IdeasProviderProps) {
  const [ideas, setIdeas] = useState<Idea[]>([]);

  async function add(idea: Partial<Idea>) {
    try {
      const response = await databases.createDocument(
        IDEAS_DATABASE_ID,
        IDEAS_COLLECTION_ID,
        ID.unique(),
        idea
      );
      setIdeas((ideas) => [response, ...ideas].slice(0, 10));
    } catch (err) {
      console.log(err) // handle error or show user a message
    }
  }

  async function remove(id: string) {
    try {
      await databases.deleteDocument(IDEAS_DATABASE_ID, IDEAS_COLLECTION_ID, id);
      setIdeas((ideas) => ideas.filter((idea) => idea.$id !== id));
      await init();
    } catch (err) {
      console.log(err)
    }
  }

  async function init() {
    try {
      const response = await databases.listDocuments(
        IDEAS_DATABASE_ID,
        IDEAS_COLLECTION_ID,
        [Query.orderDesc("$createdAt"), Query.limit(10)]
      );
      setIdeas(response.documents);
    } catch (err) {
      console.log(err)
    }
  }

  useEffect(() => {
    init();
  }, []);

  return (
    <IdeasContext.Provider value={{ current: ideas, add, remove }}>
      {children}
    </IdeasContext.Provider>
  );
}
