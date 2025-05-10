import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { apiRequest } from '@/lib/queryClient';
import { AudioTrack, ProcessingStatus, AudioProcessingOptions } from '@/types/audio';
import { useToast } from '@/hooks/use-toast';

interface AudioContextType {
  currentTrack: AudioTrack | null;
  processingStatus: ProcessingStatus;
  processingProgress: number;
  isPlaying: boolean;
  currentTime: number;
  processAudio: (options: AudioProcessingOptions) => Promise<void>;
  transposeAudio: (trackId: string, targetKey: string, targetScale: 'major' | 'minor') => Promise<void>;
  playAudio: () => void;
  pauseAudio: () => void;
  seekAudio: (time: number) => void;
  resetAudio: () => void;
  downloadAudio: (trackId: string) => void;
  error: string | null;
}

const AudioContext = createContext<AudioContextType | undefined>(undefined);

export const AudioProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const [currentTrack, setCurrentTrack] = useState<AudioTrack | null>(null);
  const [processingStatus, setProcessingStatus] = useState<ProcessingStatus>('idle');
  const [processingProgress, setProcessingProgress] = useState(0);
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [audio, setAudio] = useState<HTMLAudioElement | null>(null);
  const { toast } = useToast();
  const queryClient = useQueryClient();

  // Create and manage the audio element
  useEffect(() => {
    const audioElement = new Audio();
    
    const updateTime = () => {
      setCurrentTime(audioElement.currentTime);
    };
    
    const handleEnded = () => {
      setIsPlaying(false);
      setCurrentTime(0);
      audioElement.currentTime = 0;
    };
    
    audioElement.addEventListener('timeupdate', updateTime);
    audioElement.addEventListener('ended', handleEnded);
    
    setAudio(audioElement);
    
    return () => {
      audioElement.pause();
      audioElement.removeEventListener('timeupdate', updateTime);
      audioElement.removeEventListener('ended', handleEnded);
    };
  }, []);

  // Update audio source when currentTrack changes
  useEffect(() => {
    if (audio && currentTrack) {
      audio.src = currentTrack.url;
      audio.load();
    }
  }, [audio, currentTrack]);

  const processAudioMutation = useMutation({
    mutationFn: async (options: AudioProcessingOptions) => {
      setProcessingStatus('downloading');
      setProcessingProgress(10);
      
      const response = await apiRequest('POST', '/api/audio/process', options);
      
      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.message || 'Failed to process audio');
      }
      
      // Start polling for processing status
      const trackId = await response.json();
      return trackId;
    },
    onSuccess: (trackId) => {
      // Begin polling for status
      pollProcessingStatus(trackId);
    },
    onError: (error: Error) => {
      setProcessingStatus('error');
      setError(error.message);
      toast({
        title: 'Processing Failed',
        description: error.message,
        variant: 'destructive',
      });
    }
  });

  const transposeAudioMutation = useMutation({
    mutationFn: async ({ trackId, targetKey, targetScale }: { trackId: string, targetKey: string, targetScale: 'major' | 'minor' }) => {
      setProcessingStatus('transposing');
      setProcessingProgress(0);
      
      const response = await apiRequest('POST', `/api/audio/${trackId}/transpose`, { targetKey, targetScale });
      
      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.message || 'Failed to transpose audio');
      }
      
      const data = await response.json();
      return data;
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: [`/api/audio/${data.trackId}`] });
      setCurrentTrack(prev => {
        if (prev && prev.id === data.trackId) {
          return {
            ...prev,
            currentKey: data.currentKey,
            currentScale: data.currentScale,
            url: `${data.url}?t=${Date.now()}` // Force reload
          };
        }
        return prev;
      });
      
      setProcessingStatus('complete');
      toast({
        title: 'Transposition Complete',
        description: `Audio has been transposed to ${data.currentKey} ${data.currentScale}`,
      });
    },
    onError: (error: Error) => {
      setProcessingStatus('error');
      setError(error.message);
      toast({
        title: 'Transposition Failed',
        description: error.message,
        variant: 'destructive',
      });
    }
  });

  // Polling function for processing status
  const pollProcessingStatus = async (trackId: string) => {
    try {
      const response = await fetch(`/api/audio/${trackId}/status`);
      const data = await response.json();
      
      setProcessingProgress(data.progress);
      setProcessingStatus(data.status);
      
      if (data.status === 'complete') {
        // Load the track data
        const trackResponse = await fetch(`/api/audio/${trackId}`);
        const trackData = await trackResponse.json();
        setCurrentTrack(trackData);
        setProcessingProgress(100);
        
        toast({
          title: 'Processing Complete',
          description: 'Your audio is ready to play!',
        });
      } else if (data.status === 'error') {
        setError(data.error || 'An unknown error occurred');
        toast({
          title: 'Processing Failed',
          description: data.error || 'An unknown error occurred',
          variant: 'destructive',
        });
      } else {
        // Continue polling
        setTimeout(() => pollProcessingStatus(trackId), 1000);
      }
    } catch (err) {
      console.error('Error polling status:', err);
      setProcessingStatus('error');
      setError('Failed to check processing status');
    }
  };

  const processAudio = async (options: AudioProcessingOptions) => {
    setError(null);
    await processAudioMutation.mutateAsync(options);
  };

  const transposeAudio = async (trackId: string, targetKey: string, targetScale: 'major' | 'minor') => {
    setError(null);
    await transposeAudioMutation.mutateAsync({ trackId, targetKey, targetScale });
  };

  const playAudio = () => {
    if (audio && currentTrack) {
      audio.play()
        .then(() => setIsPlaying(true))
        .catch(err => {
          console.error('Error playing audio:', err);
          toast({
            title: 'Playback Error',
            description: 'Failed to play audio',
            variant: 'destructive',
          });
        });
    }
  };

  const pauseAudio = () => {
    if (audio) {
      audio.pause();
      setIsPlaying(false);
    }
  };

  const seekAudio = (time: number) => {
    if (audio && !isNaN(time)) {
      audio.currentTime = time;
      setCurrentTime(time);
    }
  };

  const resetAudio = () => {
    if (audio) {
      audio.pause();
      audio.currentTime = 0;
      setIsPlaying(false);
      setCurrentTime(0);
    }
  };

  const downloadAudio = (trackId: string) => {
    if (!currentTrack) return;
    
    window.location.href = `/api/audio/${trackId}/download`;
    
    toast({
      title: 'Download Started',
      description: 'Your audio file download has started',
    });
  };

  return (
    <AudioContext.Provider value={{
      currentTrack,
      processingStatus,
      processingProgress,
      isPlaying,
      currentTime,
      processAudio,
      transposeAudio,
      playAudio,
      pauseAudio,
      seekAudio,
      resetAudio,
      downloadAudio,
      error
    }}>
      {children}
    </AudioContext.Provider>
  );
};

export const useAudio = () => {
  const context = useContext(AudioContext);
  if (context === undefined) {
    throw new Error('useAudio must be used within an AudioProvider');
  }
  return context;
};
