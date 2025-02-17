const YOUTUBE_API_KEY = import.meta.env.VITE_YOUTUBE_API_KEY;
const CACHE_EXPIRY = 24 * 60 * 60 * 1000; // 24 hours in milliseconds

interface PlaylistItem {
  id: string;
  title: string;
  thumbnail: string;
}

interface CachedPlaylist {
  items: PlaylistItem[];
  timestamp: number;
}

// In-memory cache for playlists
const playlistCache = new Map<string, CachedPlaylist>();

interface YouTubeResponse {
  items: Array<{
    snippet: {
      resourceId: {
        videoId: string;
      };
      title: string;
      thumbnails: {
        maxres?: { url: string };
        high?: { url: string };
        default: { url: string };
      };
    };
  }>;
}

export async function getPlaylistVideos(playlistId: string): Promise<PlaylistItem[]> {
  // Check cache first
  const cached = playlistCache.get(playlistId);
  if (cached && Date.now() - cached.timestamp < CACHE_EXPIRY) {
    console.log('Using cached playlist:', playlistId);
    return cached.items;
  }

  try {
    console.log('Using API Key:', YOUTUBE_API_KEY ? 'Present' : 'Missing');
    console.log('Fetching playlist from API:', playlistId);
    const url = `https://www.googleapis.com/youtube/v3/playlistItems?` +
                `part=snippet&maxResults=50&playlistId=${playlistId}&key=${YOUTUBE_API_KEY}`;
    
    const response = await fetch(url);

    if (!response.ok) {
      const error = await response.json();
      console.error('YouTube API Error:', error);
      throw new Error(`YouTube API Error: ${error.error?.message || 'Unknown error'}`);
    }

    const data: YouTubeResponse = await response.json();
    const items = data.items.map(item => ({
      id: item.snippet.resourceId.videoId,
      title: item.snippet.title,
      thumbnail: item.snippet.thumbnails.maxres?.url || 
                item.snippet.thumbnails.high?.url || 
                item.snippet.thumbnails.default.url
    }));

    // Cache the results
    playlistCache.set(playlistId, {
      items,
      timestamp: Date.now()
    });

    return items;
  } catch (error) {
    console.error('Error fetching playlist:', error);
    throw error;
  }
}

// Optional: Add a function to clear the cache if needed
export function clearPlaylistCache() {
  playlistCache.clear();
} 