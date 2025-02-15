import { Client, Account, ID } from 'appwrite';

// Ensure environment variable exists at compile time
declare global {
    interface ImportMetaEnv {
        VITE_APPWRITE_PROJECT_ID: string;
    }
}

export const client = new Client();

client
    .setEndpoint('https://cloud.appwrite.io/v1')
    .setProject(import.meta.env.VITE_APPWRITE_PROJECT_ID);

export const account = new Account(client);
export { ID };

