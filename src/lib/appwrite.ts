import { Client, Account, ID, Databases, Storage } from 'appwrite';

// Ensure environment variable exists at compile time
declare global {
    interface ImportMetaEnv {
        VITE_APPWRITE_PROJECT_ID: string;
        VITE_BUCKET_ID: string;
        VITE_DATABASE_ID: string;
        VITE_MESSAGES_COLLECTION_ID: string;
    }
}

export const client = new Client()
    .setEndpoint('https://cloud.appwrite.io/v1')
    .setProject(import.meta.env.VITE_APPWRITE_PROJECT_ID);

export const account = new Account(client);
export const databases = new Databases(client);
export const storage = new Storage(client);
export { ID };

// Constants
export const BUCKET_ID = import.meta.env.VITE_BUCKET_ID;
export const DATABASE_ID = import.meta.env.VITE_DATABASE_ID;
export const MESSAGES_COLLECTION_ID = import.meta.env.VITE_MESSAGES_COLLECTION_ID;

// Helper function to get avatar URL
export function getAvatarUrl(fileId: string) {
    if (!fileId) return null;
    
    try {
        const url = storage.getFileView(BUCKET_ID, fileId);
        console.log('Generated avatar URL:', url);
        return url;
    } catch (error) {
        console.error('Error generating avatar URL:', error);
        return null;
    }
}

