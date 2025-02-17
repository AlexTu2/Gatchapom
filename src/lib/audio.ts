import { storage } from './appwrite';

// Export as a named constant
const AUDIO_BUCKET_ID = 'audio';

async function getAudioUrl(fileId: string) {
  try {
    const url = storage.getFileView(AUDIO_BUCKET_ID, fileId);
    return url.toString();
  } catch (error) {
    console.error('Failed to get audio URL:', error);
    return null;
  }
}

// Export everything at the bottom
export {
  AUDIO_BUCKET_ID,
  getAudioUrl
}; 