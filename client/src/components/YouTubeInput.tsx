import { useState } from 'react';
import { Youtube } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { useAudio } from '@/contexts/AudioContext';
import { validateYouTubeUrl } from '@/lib/utils';

export default function YouTubeInput() {
  const [youtubeUrl, setYoutubeUrl] = useState('');
  const [urlError, setUrlError] = useState<string | null>(null);
  const { processNewAudio, processingStatus } = useAudio();
  
  const handleUrlChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setYoutubeUrl(e.target.value);
    
    // Clear error when user starts typing
    if (urlError) {
      setUrlError(null);
    }
  };
  
  const handleExtraction = async () => {
    // Validate URL
    if (!youtubeUrl.trim()) {
      setUrlError('Please enter a YouTube URL');
      return;
    }
    
    if (!validateYouTubeUrl(youtubeUrl)) {
      setUrlError('Please enter a valid YouTube URL');
      return;
    }
    
    // Clear any previous errors
    setUrlError(null);
    
    try {
      await processNewAudio({ videoUrl: youtubeUrl });
    } catch (error) {
      // The error will be handled by the context
      console.error('Failed to extract audio:', error);
    }
  };
  
  const isLoading = processingStatus !== 'idle' && processingStatus !== 'complete' && processingStatus !== 'error';
  
  return (
    <div className="mb-8">
      <label htmlFor="youtube-link" className="block text-sm font-medium text-neutral-700 mb-2">
        YouTube Video URL
      </label>
      <div className="flex gap-4 flex-col sm:flex-row">
        <div className="relative flex-grow">
          <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
            <Youtube className="h-5 w-5 text-neutral-500" />
          </div>
          <Input
            id="youtube-link"
            value={youtubeUrl}
            onChange={handleUrlChange}
            className="pl-10 py-6 font-medium"
            placeholder="https://www.youtube.com/watch?v=..."
            disabled={isLoading}
          />
        </div>
        <Button 
          onClick={handleExtraction}
          disabled={isLoading}
          className="bg-primary hover:bg-primary/90 text-white py-6 px-6 whitespace-nowrap"
        >
          {isLoading ? 'Processing...' : 'Extract Audio'}
        </Button>
      </div>
      
      {urlError && (
        <p className="mt-2 text-sm text-red-600">{urlError}</p>
      )}
      
      <p className="mt-2 text-sm text-neutral-500">
        Paste a valid YouTube music video URL to extract the instrumental track.
      </p>
    </div>
  );
}
