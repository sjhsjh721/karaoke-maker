import { Button } from '@/components/ui/button';
import { useState } from 'react';
import { useAudio } from '@/contexts/AudioContext';

const EXAMPLE_VIDEOS = [
  { id: 'example1', title: 'Ed Sheeran - Shape of You', url: 'https://www.youtube.com/watch?v=JGwWNGJdvx8' },
  { id: 'example2', title: 'Dua Lipa - Levitating', url: 'https://www.youtube.com/watch?v=TUVcZfQe-Kw' },
  { id: 'example3', title: 'The Weeknd - Blinding Lights', url: 'https://www.youtube.com/watch?v=4NRXx6U8ABQ' }
];

interface EmptyStateProps {
  onVideoSelect: (url: string) => void;
}

export default function EmptyState({ onVideoSelect }: EmptyStateProps) {
  const handleExampleClick = (url: string) => {
    onVideoSelect(url);
  };

  return (
    <div className="py-12 flex flex-col items-center justify-center text-center">
      <div className="w-full max-w-md h-64 bg-neutral-200 rounded-xl shadow-md mb-6 flex items-center justify-center overflow-hidden">
        <svg className="w-32 h-32 text-neutral-400" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
          <path d="M9 17V7M9 7L4 12M9 7L14 12M15 7H21M15 12H21M15 17H21" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
        </svg>
      </div>
      <h3 className="font-poppins font-semibold text-xl mb-4">Ready to Transform Your Music</h3>
      <p className="text-neutral-600 max-w-lg mb-8">
        Paste a YouTube link above to extract the instrumental track and adjust it to your preferred musical key.
      </p>
      <div className="flex flex-wrap justify-center gap-4">
        {EXAMPLE_VIDEOS.map(video => (
          <Button
            key={video.id}
            variant="outline"
            className="bg-neutral-100 hover:bg-neutral-200 transition-colors text-neutral-700 border border-neutral-300 text-sm"
            onClick={() => handleExampleClick(video.url)}
          >
            {video.title}
          </Button>
        ))}
      </div>
    </div>
  );
}
