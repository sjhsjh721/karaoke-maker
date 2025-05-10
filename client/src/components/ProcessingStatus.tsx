import { useEffect } from 'react';
import { Loader2 } from 'lucide-react';
import { Progress } from '@/components/ui/progress';
import { useAudio } from '@/contexts/AudioContext';

export default function ProcessingStatus() {
  const { processingStatus, processingProgress, error } = useAudio();
  
  const getStatusText = () => {
    switch (processingStatus) {
      case 'downloading':
        return 'Downloading YouTube audio...';
      case 'processing':
        return 'Extracting instrumental track...';
      case 'transposing':
        return 'Transposing audio to new key...';
      case 'error':
        return error || 'An error occurred during processing';
      default:
        return 'Processing your track...';
    }
  };
  
  // Only show this component when in a processing state
  if (processingStatus === 'idle' || processingStatus === 'complete') {
    return null;
  }
  
  return (
    <div className="mb-8">
      <div className="bg-primary bg-opacity-5 rounded-xl p-6 flex flex-col items-center justify-center">
        <div className="w-16 h-16 mb-4 processing-animation">
          <Loader2 className="animate-spin w-full h-full text-primary" />
        </div>
        <h3 className="font-poppins font-semibold text-xl mb-2 text-center">Processing Your Track</h3>
        <p className="text-neutral-600 text-center mb-4">This may take a few moments depending on the video length.</p>
        
        <Progress 
          value={processingProgress} 
          className="w-full max-w-md h-2.5 bg-neutral-200"
        />
        
        <p className="mt-3 text-neutral-500 text-sm">{getStatusText()}</p>
        
        {processingStatus === 'error' && (
          <div className="mt-4 p-3 bg-red-50 text-red-800 rounded-md text-sm">
            {error || 'An unknown error occurred. Please try again.'}
          </div>
        )}
      </div>
    </div>
  );
}
