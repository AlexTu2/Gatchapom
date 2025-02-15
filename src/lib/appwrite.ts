import { Client, Account, ID, Databases } from 'appwrite';

// Ensure environment variable exists at compile time
declare global {
    interface ImportMetaEnv {
        VITE_APPWRITE_PROJECT_ID: string;
    }
}

export const client = new Client()
    .setEndpoint('https://cloud.appwrite.io/v1')
    .setProject(import.meta.env.VITE_APPWRITE_PROJECT_ID);

export const account = new Account(client);
export const databases = new Databases(client);
export { ID };

