const YOUTUBE_API_KEY = import.meta.env.VITE_YOUTUBE_API_KEY;

interface PlaylistItem {
  id: string;
  title: string;
  thumbnail: string;
}

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
  try {
    console.log('Using API Key:', YOUTUBE_API_KEY ? 'Present' : 'Missing');
    
    const url = `https://www.googleapis.com/youtube/v3/playlistItems?` +
                `part=snippet&maxResults=50&playlistId=${playlistId}&key=${YOUTUBE_API_KEY}`;
    
    console.log('Fetching playlist:', playlistId);
    const response = await fetch(url);

    if (!response.ok) {
      const error = await response.json();
      console.error('YouTube API Error:', error);
      throw new Error(`YouTube API Error: ${error.error?.message || 'Unknown error'}`);
    }

    const data: YouTubeResponse = await response.json();
    return data.items.map(item => ({
      id: item.snippet.resourceId.videoId,
      title: item.snippet.title,
      thumbnail: item.snippet.thumbnails.maxres?.url || 
                item.snippet.thumbnails.high?.url || 
                item.snippet.thumbnails.default.url
    }));
  } catch (error) {
    console.error('Error fetching playlist:', error);
    throw error;
  }
} 