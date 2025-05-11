import React, {
  createContext,
  useContext,
  useState,
  useEffect,
  useRef,
  useCallback,
  ReactNode,
} from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { apiRequest } from '@/lib/queryClient'; // 이 경로는 실제 프로젝트 구조에 맞게 조정될 수 있습니다.
import { AudioTrack, ProcessingStatus, AudioProcessingOptions } from '@/types/audio'; // 타입 정의 경로
import { useToast } from '@/hooks/use-toast'; // useToast 훅 경로

// 1. Context 타입 정의
interface AudioContextType {
  currentTrack: AudioTrack | null;
  isPlaying: boolean;
  currentTime: number;
  duration: number;
  processingStatus: ProcessingStatus;
  processingProgress: number;
  error: string | null;
  isLoadingAudio: boolean; // To indicate audio buffer loading/decoding
  isInstrumentalActive: boolean; // New state

  play: (startTimeOverride?: number) => void;
  pause: () => void;
  seek: (time: number) => void;
  loadTrack: (track: AudioTrack | null) => Promise<void>; // playInstrumentalIfAvailable 파라미터 제거
  processNewAudio: (options: AudioProcessingOptions) => Promise<AudioTrack | null>;
  transposeCurrentAudio: (semitones: number) => Promise<AudioTrack | null>;
  downloadCurrentAudio: () => void;
  toggleInstrumentalMode: () => void; // New function
  clearError: () => void;
}

// 2. Context 생성
const AudioContext = createContext<AudioContextType | undefined>(undefined);

// 3. Provider 컴포넌트
export const AudioProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const [currentTrack, setCurrentTrack] = useState<AudioTrack | null>(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [processingStatus, setProcessingStatus] = useState<ProcessingStatus>('idle');
  const [processingProgress, setProcessingProgress] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [isLoadingAudio, setIsLoadingAudio] = useState(false);
  const [isInstrumentalActive, setIsInstrumentalActive] = useState(false); // 기본값을 false (원본 재생)으로 변경

  const audioContextRef = useRef<AudioContext | null>(null);
  const audioBufferRef = useRef<AudioBuffer | null>(null);
  // 원본 오디오 버퍼를 저장할 Ref 추가
  const originalAudioBufferRef = useRef<AudioBuffer | null>(null);
  const sourceNodeRef = useRef<AudioBufferSourceNode | null>(null);
  const playbackStartTimeRef = useRef<number>(0); // AudioContext.currentTime when playback started
  const startOffsetRef = useRef<number>(0); // Offset within the buffer where playback started
  const animationFrameRef = useRef<number | null>(null);

  const { toast } = useToast();
  
  // Ref to hold the latest isPlaying state for use in callbacks like onended
  const isPlayingRef = useRef(isPlaying);
  useEffect(() => {
    isPlayingRef.current = isPlaying;
  }, [isPlaying]);

  // Initialize AudioContext
  useEffect(() => {
    if (!audioContextRef.current) {
      audioContextRef.current = new (window.AudioContext || (window as any).webkitAudioContext)();
      // console.log('AudioContext created');
    }
    return () => {
      audioContextRef.current?.close().catch(console.error);
      if (animationFrameRef.current) {
        cancelAnimationFrame(animationFrameRef.current);
      }
    };
  }, []);

  const stopCurrentSourceNode = useCallback(() => {
    if (sourceNodeRef.current) {
      try {
        sourceNodeRef.current.onended = null; // Remove previous onended handler
        sourceNodeRef.current.stop();
        sourceNodeRef.current.disconnect();
      } catch (e) {
        console.warn('Error stopping source node:', e);
      }
      sourceNodeRef.current = null;
    }
  }, []);
  
  const updateCurrentTime = useCallback(() => {
    // console.log(`[AudioContext] updateCurrentTime TICK. isPlayingRef.current: ${isPlayingRef.current}, CTX.currentTime: ${audioContextRef.current?.currentTime.toFixed(3)}`);
    // Log at the beginning of each tick
    // console.log(`TICK updateCurrentTime - isPlaying: ${isPlaying}, CTX.currentTime: ${audioContextRef.current?.currentTime.toFixed(3)}, playbackStartTime: ${playbackStartTimeRef.current.toFixed(3)}, startOffset: ${startOffsetRef.current.toFixed(3)}`);

    if (isPlaying && audioContextRef.current && audioBufferRef.current) {
      const elapsedTime = audioContextRef.current.currentTime - playbackStartTimeRef.current;
      let newCurrentTime = startOffsetRef.current + elapsedTime;

      if (newCurrentTime >= audioBufferRef.current.duration) {
        newCurrentTime = audioBufferRef.current.duration;
        setCurrentTime(newCurrentTime);
        setIsPlaying(false); 
        // console.log('TICK updateCurrentTime: Playback reached end. Setting isPlaying to false.');
      } else {
        setCurrentTime(newCurrentTime);
        animationFrameRef.current = requestAnimationFrame(updateCurrentTime); 
      }
    } else {
      if (animationFrameRef.current) {
        // console.log('TICK updateCurrentTime: Conditions not met. Cancelling RAF from within tick.');
        cancelAnimationFrame(animationFrameRef.current);
        animationFrameRef.current = null;
      }
    }
  }, [isPlaying, setCurrentTime, setIsPlaying]);

  useEffect(() => {
    if (isPlaying) {
      // console.log(`[AudioContext] useEffect[isPlaying]: isPlaying TRUE. Starting RAF. Previous RAF ID: ${animationFrameRef.current}`);
      // console.log(`useEffect[isPlaying]: isPlaying is true. CurrentTime state: ${currentTime.toFixed(3)}. Starting RAF.`);
      if (animationFrameRef.current) {
        cancelAnimationFrame(animationFrameRef.current);
      }
      animationFrameRef.current = requestAnimationFrame(updateCurrentTime);
    } else {
      // console.log(`[AudioContext] useEffect[isPlaying]: isPlaying FALSE. Cancelling RAF. Current RAF ID: ${animationFrameRef.current}`);
      if (animationFrameRef.current) {
        // console.log(`useEffect[isPlaying]: isPlaying is false. CurrentTime state: ${currentTime.toFixed(3)}. Cancelling RAF.`);
        cancelAnimationFrame(animationFrameRef.current);
        animationFrameRef.current = null;
      } else {
        // console.log(`useEffect[isPlaying]: isPlaying is false, and no RAF was active. CurrentTime state: ${currentTime.toFixed(3)}.`);
      }
    }
    return () => {
      // console.log(`[AudioContext] useEffect[isPlaying] CLEANUP. Cancelling RAF. Current RAF ID: ${animationFrameRef.current}`);
      if (animationFrameRef.current) {
        // console.log(`useEffect[isPlaying]: Cleanup. Cancelling RAF.`);
        cancelAnimationFrame(animationFrameRef.current);
        animationFrameRef.current = null; 
      }
    };
  }, [isPlaying]); 

  const fetchAndDecodeAudio = useCallback(async (url: string): Promise<AudioBuffer | null> => {
    if (!audioContextRef.current) {
      console.error('AudioContext is not initialized');
      // setIsLoadingAudio(false); // isLoadingAudio 상태는 호출부에서 관리
      return null;
    }
    try {
      const response = await fetch(url);
      if (!response.ok) {
        console.error('Network error:', response.statusText);
        // setIsLoadingAudio(false);
        return null;
      }
      const arrayBuffer = await response.arrayBuffer();
      const audioBuffer = await audioContextRef.current.decodeAudioData(arrayBuffer);
      // setIsLoadingAudio(false);
      return audioBuffer;
    } catch (e) {
      console.error('Error decoding audio:', e);
      // setIsLoadingAudio(false);
      return null;
    }
  }, []); // toast 제거

  const _loadAndSetBuffer = useCallback(async (urlToLoad: string, forDurationUpdate = false) => {
    // console.log('[AudioContext] _loadAndSetBuffer: Attempting to load from URL:', urlToLoad);
    setIsLoadingAudio(true); 
    const newBuffer = await fetchAndDecodeAudio(urlToLoad); 
    // console.log('[AudioContext] _loadAndSetBuffer: fetchAndDecodeAudio result:', newBuffer ? 'Success' : 'Failed', newBuffer);
    
    if (newBuffer) {
      audioBufferRef.current = newBuffer;         
      originalAudioBufferRef.current = newBuffer; // Always set originalAudioBufferRef if a new buffer is loaded
      if (forDurationUpdate) {
          setDuration(newBuffer.duration);
      }
      setIsLoadingAudio(false); 
      return true;
    }
    setIsLoadingAudio(false); 
    return false;
  }, [fetchAndDecodeAudio, setIsLoadingAudio, setDuration]);

  const loadTrack = useCallback(async (track: AudioTrack | null) => { // Allow null for easier reset
    // console.log('[AudioContext] loadTrack: Called with track:', track ? JSON.parse(JSON.stringify(track)) : null);
    setError(null);
    stopCurrentSourceNode();
    setIsPlaying(false);
    setCurrentTime(0);
    setDuration(0);
    audioBufferRef.current = null;
    originalAudioBufferRef.current = null; 

    if (!track || !track.id || !track.title) { // Basic validation for a usable track object
      console.warn('[AudioContext] loadTrack: Received null or invalid track object. Resetting currentTrack.', track);
      setCurrentTrack(null);
      if (track) { // Only show error if an invalid track object was actually passed
        toast({ title: 'Audio Error', description: 'Invalid track data received.', variant: 'destructive' });
      }
      return;
    }
    
    setCurrentTrack(track); // Set current track only if it passes basic validation
    // console.log('[AudioContext] loadTrack: Set currentTrack to:', JSON.parse(JSON.stringify(track)));

    let urlToLoad = track.activeUrl || track.originalUrl || track.url; // track is guaranteed to be non-null here
    // console.log('[AudioContext] loadTrack: Determined urlToLoad:', urlToLoad, 'from track ID:', track.id);

    if (!urlToLoad) {
      setError('No valid audio URL found for this track.');
      toast({ title: 'Audio Error', description: 'No audio source URL available for this track.', variant: 'destructive' });
      console.warn('[AudioContext] loadTrack: No valid URL, setting currentTrack to null. Track ID was:', track.id);
      setCurrentTrack(null); 
      return;
    }

    const success = await _loadAndSetBuffer(urlToLoad, true);
    // console.log('[AudioContext] loadTrack: _loadAndSetBuffer success:', success);
    if (success) {
      setIsInstrumentalActive(false); 
      // console.log(`[AudioContext] loadTrack: Track loaded successfully (ID: ${track.id}), instrumental mode is OFF.`);
    } else {
      setError('Failed to load audio buffer for the track.');
      toast({ title: 'Audio Load Error', description: 'Could not load audio data.', variant: 'destructive' });
      console.warn(`[AudioContext] loadTrack: _loadAndSetBuffer failed, setting currentTrack to null. URL was: ${urlToLoad}, Track ID was: ${track.id}`);
      setCurrentTrack(null);
    }
  }, [stopCurrentSourceNode, toast, _loadAndSetBuffer, setIsInstrumentalActive, setError, setCurrentTrack, setIsPlaying, setCurrentTime, setDuration]);


  const play = useCallback((startTimeOverride?: number) => {
    // console.log(`[AudioContext] play CALLED. startTimeOverride: ${startTimeOverride}, initial currentTime: ${currentTime}, initial isPlaying: ${isPlayingRef.current}`);
    if (isLoadingAudio || !audioContextRef.current || !audioBufferRef.current) {
      console.warn('Play conditions not met: audio not loaded or context not ready.');
      return;
    }
    if (isPlaying && typeof startTimeOverride === 'undefined') {
      // Already playing and no specific start time given, so do nothing.
      // This can happen if play is called rapidly.
      console.warn('Play called while already playing without an override. Ignoring.');
      return;
    }

    // Determine the actual time to start playback from.
    // If startTimeOverride is provided (e.g., from seek), use that.
    // Otherwise, use the current anímatíon frame's currentTime (which should be up-to-date if paused).
    let effectiveTimeToPlayFrom = typeof startTimeOverride === 'number' ? startTimeOverride : currentTime;

    // Ensure the time is within bounds.
    if (effectiveTimeToPlayFrom >= audioBufferRef.current.duration && audioBufferRef.current.duration > 0) {
      effectiveTimeToPlayFrom = 0; // Loop back to the beginning if at or past the end.
      // console.log('Playback time was at or past duration, restarting from 0.');
    }
    effectiveTimeToPlayFrom = Math.max(0, Math.min(effectiveTimeToPlayFrom, audioBufferRef.current.duration));
    
    // NOTE: We are removing the direct setCurrentTime(effectiveTimeToPlayFrom) call from here.
    // The `currentTime` state should be set by `seek` before calling `play`,
    // or by `updateCurrentTime` during playback.
    // `startOffsetRef` will use `effectiveTimeToPlayFrom`.

    // console.log(`[AudioContext] play: Attempting to play. Effective time for startOffset: ${effectiveTimeToPlayFrom}, Buffer duration: ${audioBufferRef.current.duration}`);

    stopCurrentSourceNode(); 

    const sourceNode = audioContextRef.current.createBufferSource();
    sourceNode.buffer = audioBufferRef.current;
    sourceNode.connect(audioContextRef.current.destination);
    
    startOffsetRef.current = effectiveTimeToPlayFrom; // This is the crucial part for where audio *actually* starts
    playbackStartTimeRef.current = audioContextRef.current.currentTime; // Hardware time when play is called

    sourceNode.onended = () => {
      // console.log('[AudioContext] sourceNode.onended triggered. isPlayingRef.current:', isPlayingRef.current);

      // Only act if we were genuinely playing and the track ended naturally.
      if (isPlayingRef.current && audioContextRef.current && audioBufferRef.current) {
        const playbackPositionAtEndEvent = startOffsetRef.current + (audioContextRef.current.currentTime - playbackStartTimeRef.current);
        
        // Check if playback reached the very end of the buffer
        if (playbackPositionAtEndEvent >= audioBufferRef.current.duration - 0.05) { // Using a small tolerance
          // console.log('[AudioContext] Playback naturally reached end. Resetting state.');
          setIsPlaying(false); // This will trigger useEffect[isPlaying] to cancel RAF
          setCurrentTime(0);   // Reset currentTime for UI
          startOffsetRef.current = 0; // Reset offset for next play
        } else {
          // Ended but not at the buffer's end. This implies source.stop() was called.
          // isPlaying state and RAF should be handled by the function that called stop() (e.g., pause, or a new play() in seek).
          console.log('[AudioContext] SourceNode ended NOT at buffer_end (likely stopped externally). playbackPositionAtEndEvent:', playbackPositionAtEndEvent, 'Duration:', audioBufferRef.current.duration);
        }
      } else {
        // console.log('[AudioContext] SourceNode ended, but was not considered "playing" or context/buffer was not ready.');
      }
      // DO NOT directly manipulate animationFrameRef.current here.
      // RAF lifecycle is managed by useEffect[isPlaying] and stopCurrentSourceNode.
    };

    sourceNode.start(0, startOffsetRef.current); 
    sourceNodeRef.current = sourceNode;
    
    setIsPlaying(true); 
    // The updateCurrentTime loop, triggered by isPlaying=true, will now handle currentTime state updates during playback.
    // console.log('[AudioContext] play: Playback started/resumed. startOffsetRef.current:', startOffsetRef.current);
  }, [
    isLoadingAudio, 
    isPlaying, 
    currentTime, // currentTime is still needed to determine effectiveTimeToPlayFrom if startTimeOverride is not given
    stopCurrentSourceNode, 
    // setCurrentTime, // Removed from dependencies as play no longer calls it directly
    setIsPlaying,
    // Make sure all refs used are stable or listed if they trigger re-creation of the callback
    // audioContextRef, audioBufferRef, sourceNodeRef, playbackStartTimeRef, startOffsetRef, animationFrameRef
  ]);

  const pause = useCallback(() => {
    if (!isPlaying) return;
    // console.log('Attempting to pause');
    stopCurrentSourceNode(); 
    setIsPlaying(false);
    // console.log('Playback paused at:', currentTime);
  }, [isPlaying, currentTime, stopCurrentSourceNode, setIsPlaying]);

  const seek = useCallback((time: number) => {
    // console.log(`[AudioContext] seek CALLED. time: ${time}, isPlayingRef.current: ${isPlayingRef.current}`);
    if (isLoadingAudio || !audioBufferRef.current || !audioContextRef.current) {
        console.warn('[AudioContext] seek: Seek called but audio not ready');
        return;
    }
    const newTime = Math.max(0, Math.min(time, audioBufferRef.current.duration));
    // console.log(`[AudioContext] seek: Requested time: ${time}, Clamped time: ${newTime}`);
    
    setCurrentTime(newTime); // Set currentTime for immediate UI update

    if (isPlaying) {
        // console.log('[AudioContext] seek: About to call play(newTime) with newTime:', newTime);
        // console.log('[AudioContext] seek: Seeking while playing. Calling play() with newTime.');
        play(newTime); 
    } else {
        // console.log('[AudioContext] seek: Seeking while paused. Updated currentTime. Setting startOffset for next play.');
        startOffsetRef.current = newTime; 
    }
  }, [isLoadingAudio, isPlaying, play, setCurrentTime]); // setCurrentTime is still a dependency here.

  const clearError = useCallback(() => {
    setError(null);
  }, [setError]);

  const processAudioMutation = useMutation<
    AudioTrack,
    Error,
    AudioProcessingOptions
  >({
    mutationFn: async (options: AudioProcessingOptions): Promise<AudioTrack> => {
      // This mutation is for server-side processing. 
      // If client-side M/S is the primary way, this might need adjustment or become secondary.
      setProcessingStatus('downloading'); // Assuming this still downloads and potentially processes on server first
      setProcessingProgress(10);
      const response = await apiRequest('POST', '/api/audio/process', options);
      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.message || 'Failed to process audio');
      }
      const trackId = await response.json(); // This likely returns a track ID for polling
      
      let retries = 0;
      const maxRetries = 60; 
      while (retries < maxRetries) {
        try {
          await new Promise(resolve => setTimeout(resolve, 1000)); 
          const statusRes = await apiRequest('GET', `/api/audio/${trackId}/status`);
          if (!statusRes.ok) {
            console.warn('Polling status failed, retrying...');
            retries++;
            continue;
          }
          const statusData = await statusRes.json();
          setProcessingProgress(statusData.progress);
          setProcessingStatus(statusData.status as ProcessingStatus); // Ensure type assertion if needed

          if (statusData.status === 'complete') {
            const trackRes = await apiRequest('GET', `/api/audio/${trackId}`);
            if (!trackRes.ok) throw new Error('Failed to fetch completed track info');
            return await trackRes.json(); // This should be of type AudioTrack
          } else if (statusData.status === 'error') {
            throw new Error(statusData.error || 'Audio processing failed on server');
          }
          retries++;
        } catch (pollError: any) {
          console.error("Polling error:", pollError.message);
          retries++;
          if (retries >= maxRetries) throw new Error('Max polling retries reached.');
        }
      }
      throw new Error('Audio processing timed out.');
    },
    onSuccess: (newTrack) => {
      setProcessingStatus('complete');
      setProcessingProgress(100);
      toast({ title: 'Processing Complete', description: 'Audio is ready.' });
      loadTrack(newTrack); // Load the new track (which will be treated as original initially by loadTrack)
    },
    onError: (e: Error) => {
      setProcessingStatus('error');
      setError(e.message);
      toast({ title: 'Processing Failed', description: e.message, variant: 'destructive' });
    },
  });

  const transposeAudioMutation = useMutation<
    AudioTrack, // Expecting the endpoint to return the full updated track object
    Error,
    { semitones: number }
  >({
    mutationFn: async ({ semitones }) => {
      if (!currentTrack) throw new Error('No track selected for transposition.');
      setProcessingStatus('transposing');
      setProcessingProgress(0); // Or some initial progress
      // This API should return the updated AudioTrack object
      const response = await apiRequest('POST', `/api/audio/${currentTrack.id}/transpose`, { semitones });
      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.message || 'Failed to transpose audio');
      }
      return await response.json(); // Returns AudioTrack
    },
    onSuccess: (updatedTrack) => {
      // console.log('[AudioContext] transposeAudioMutation onSuccess: Received updatedTrack:', updatedTrack ? JSON.parse(JSON.stringify(updatedTrack)) : null );
      setProcessingStatus('complete');
      setProcessingProgress(100);
      toast({ title: 'Transposition Complete', description: 'Audio has been transposed.' });
      loadTrack(updatedTrack); // Reload the track with its new activeUrl (transposed version)
    },
    onError: (e: Error) => {
      setProcessingStatus('error');
      setError(e.message);
      toast({ title: 'Transposition Failed', description: e.message, variant: 'destructive' });
    },
  });

  const processNewAudio = async (options: AudioProcessingOptions): Promise<AudioTrack | null> => {
    setError(null);
    // processAudioMutation.mutate(options); // This is async, consider how to handle return.
    // For now, let's assume the caller doesn't need the immediate AudioTrack object from this function
    // as loading is handled by onSuccess.
    try {
        const newTrack = await processAudioMutation.mutateAsync(options);
        return newTrack; // Or null, as loadTrack is called in onSuccess
    } catch (e) {
        // Error is handled by mutation's onError
        return null;
    }
  };

  const transposeCurrentAudio = async (semitones: number): Promise<AudioTrack | null> => {
    // Log currentTrack *before* the check
    // console.log('[AudioContext] transposeCurrentAudio: Attempting transpose. Current track state BEFORE check:', currentTrack ? JSON.parse(JSON.stringify(currentTrack)) : null);
    if (!currentTrack || !currentTrack.id) { // id 존재 여부도 명시적으로 확인
      console.warn('[AudioContext] transposeCurrentAudio: Validation failed. currentTrack or currentTrack.id is invalid.', currentTrack ? JSON.parse(JSON.stringify(currentTrack)) : null);
      setError('No valid audio track loaded for transposition.');
      toast({ title: 'Error', description: 'No valid audio track loaded for transposition.', variant: 'destructive' });
      return null;
    }
    setError(null);
    try {
        // console.log('[AudioContext] transposeCurrentAudio: Calling mutation with semitones:', semitones, 'for track ID:', currentTrack.id);
        const updatedTrack = await transposeAudioMutation.mutateAsync({ semitones });
        // console.log('[AudioContext] transposeCurrentAudio: Mutation successful, updatedTrack from mutateAsync:', updatedTrack ? JSON.parse(JSON.stringify(updatedTrack)) : null);
        return updatedTrack; // Or null
    } catch (e: any) {
        console.error('[AudioContext] transposeCurrentAudio: Mutation failed.', e);
        // Error is handled by mutation's onError, but we can log here too.
        setError(e.message || 'Failed to transpose audio'); 
        return null;
    }
  };

  const downloadCurrentAudio = useCallback(() => {
    if (!currentTrack) {
      toast({ title: 'Download Failed', description: 'No audio track loaded.', variant: 'destructive' });
      return;
    }
    
    let downloadUrl: string | undefined;
    let fileName = currentTrack.title || 'audio_track';

    if (isInstrumentalActive && audioBufferRef.current) {
      // Option 1: Client-side generation of WAV from audioBufferRef.current (instrumental)
      // This is more complex, involves creating a WAV encoder.
      // Option 2: If server could generate M/S on demand for download (not implemented)
      toast({ title: 'Download Info', description: 'Downloading client-processed instrumental is not yet implemented. Downloading original instead.', variant: 'default' });
      downloadUrl = currentTrack.originalUrl || currentTrack.activeUrl || currentTrack.url;
      fileName = `${fileName}_original.mp3`;
    } else {
      // Download the currently active main URL (could be original or server-transposed)
      downloadUrl = currentTrack.activeUrl || currentTrack.originalUrl || currentTrack.url;
       fileName = `${fileName}.mp3`;
    }

    if (downloadUrl) {
      const link = document.createElement('a');
      link.href = downloadUrl; 
      link.download = fileName;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      toast({ title: 'Download Started', description: `Downloading ${fileName}` });
    } else {
      toast({ title: 'Download Failed', description: 'No audio track URL available.', variant: 'destructive' });
    }
  }, [currentTrack, isInstrumentalActive, toast]);
  
  // 새로운 Mid-Side 처리 함수 추가
  const createInstrumentalBufferMS = useCallback(async (originalBuffer: AudioBuffer): Promise<AudioBuffer | null> => {
    if (!audioContextRef.current) {
      console.error("AudioContext not initialized for M/S processing.");
      return null;
    }
    if (originalBuffer.numberOfChannels < 2) {
      toast({ title: 'Processing Error', description: 'Mid-Side processing requires a stereo audio track.', variant: 'destructive' });
      return originalBuffer; 
    }

    const offlineCtx = new OfflineAudioContext(
      originalBuffer.numberOfChannels,
      originalBuffer.length,
      originalBuffer.sampleRate
    );

    const source = offlineCtx.createBufferSource();
    source.buffer = originalBuffer;

    const splitter = offlineCtx.createChannelSplitter(2);
    const merger = offlineCtx.createChannelMerger(2);

    const gainL_for_L_out = offlineCtx.createGain(); gainL_for_L_out.gain.value = 0.5;
    const gainR_for_L_out = offlineCtx.createGain(); gainR_for_L_out.gain.value = -0.5;

    const gainL_for_R_out = offlineCtx.createGain(); gainL_for_R_out.gain.value = -0.5;
    const gainR_for_R_out = offlineCtx.createGain(); gainR_for_R_out.gain.value = 0.5;

    source.connect(splitter);

    splitter.connect(gainL_for_L_out, 0, 0); 
    splitter.connect(gainR_for_L_out, 1, 0); 
    gainL_for_L_out.connect(merger, 0, 0);   
    gainR_for_L_out.connect(merger, 0, 0);   

    splitter.connect(gainL_for_R_out, 0, 0); 
    splitter.connect(gainR_for_R_out, 1, 0); 
    gainL_for_R_out.connect(merger, 0, 1);   
    gainR_for_R_out.connect(merger, 0, 1);   

    merger.connect(offlineCtx.destination);
    source.start();

    try {
      setIsLoadingAudio(true); // Indicate processing
      setProcessingStatus("processing"); // M/S processing status
      const processedBuffer = await offlineCtx.startRendering();
      toast({ title: 'Instrumental Processed', description: 'Mid-Side processing applied.' });
      setProcessingStatus("complete");
      setIsLoadingAudio(false);
      return processedBuffer;
    } catch (e: any) {
      console.error("Error rendering M/S instrumental:", e);
      setError('Failed to process instrumental: ' + e.message);
      setProcessingStatus("error");
      setIsLoadingAudio(false);
      return null;
    }
  }, [toast, setError, setIsLoadingAudio, setProcessingStatus]);


  const toggleInstrumentalMode = useCallback(async () => {
    if (!currentTrack || isLoadingAudio) { // isLoadingAudio 체크 추가
      console.warn('Cannot toggle mode: no track or already loading/processing.');
      return;
    }

    const previouslyPlaying = isPlaying;
    if (previouslyPlaying) {
      stopCurrentSourceNode(); 
    }
    const preservedTime = currentTime;

    // setIsLoadingAudio(true); // createInstrumentalBufferMS 또는 _loadAndSetBuffer 에서 처리

    if (isInstrumentalActive) { 
      if (originalAudioBufferRef.current) {
        setIsLoadingAudio(true); // 원본 로딩 시작
        audioBufferRef.current = originalAudioBufferRef.current;
        setDuration(originalAudioBufferRef.current.duration);
        setIsInstrumentalActive(false);
        setCurrentTime(preservedTime); 
        startOffsetRef.current = preservedTime;
        toast({ title: 'Switched to Original Mode' });
        // console.log('Switched to Original audio.');
        setIsLoadingAudio(false); // 원본 로딩 완료
        if (previouslyPlaying) play(preservedTime);
      } else {
        toast({ title: 'Error', description: 'Original audio data not found.', variant: 'destructive' });
        console.error('Original buffer not available to switch back.');
      }
    } else { 
      if (originalAudioBufferRef.current) {
        // setIsLoadingAudio(true) 및 setProcessingStatus 는 createInstrumentalBufferMS 내부에서 호출
        const instrumentalBuffer = await createInstrumentalBufferMS(originalAudioBufferRef.current);
        if (instrumentalBuffer) {
          audioBufferRef.current = instrumentalBuffer;
          setDuration(instrumentalBuffer.duration);
          setIsInstrumentalActive(true);
          setCurrentTime(preservedTime); 
          startOffsetRef.current = preservedTime;
          // console.log('Switched to M/S Instrumental audio.');
          if (previouslyPlaying) play(preservedTime);
        } else {
          console.error('Failed to create M/S instrumental buffer.');
          // 오류 발생 시, 다시 원본으로 돌리거나 사용자에게 알림 (toast는 createInstrumentalBufferMS에서 처리)
          // 예: 현재 상태는 isInstrumentalActive = false 유지
        }
      } else {
        toast({ title: 'Error', description: 'Original audio data needed for M/S processing is not available.', variant: 'destructive' });
        console.error('Original buffer not available for M/S processing.');
      }
    }
    // setIsLoadingAudio(false); // 각 분기 또는 createInstrumentalBufferMS 에서 처리
  }, [
    currentTrack, isLoadingAudio, isInstrumentalActive, isPlaying, currentTime,
    stopCurrentSourceNode, play, toast, createInstrumentalBufferMS, 
    setDuration, setIsInstrumentalActive, setCurrentTime, setIsLoadingAudio // Added setIsLoadingAudio
  ]);

  // 4. Context 값 제공
  const contextValue: AudioContextType = {
      currentTrack,
    isPlaying,
    currentTime,
    duration,
      processingStatus,
      processingProgress,
    error,
    isLoadingAudio,
    isInstrumentalActive,
    play,
    pause,
    seek,
    loadTrack,
    processNewAudio,
    transposeCurrentAudio,
    downloadCurrentAudio,
    toggleInstrumentalMode,
    clearError,
  };

  return <AudioContext.Provider value={contextValue}>{children}</AudioContext.Provider>;
};

// 5. Custom Hook
export const useAudio = (): AudioContextType => {
  const context = useContext(AudioContext);
  if (context === undefined) {
    throw new Error('useAudio must be used within an AudioProvider');
  }
  return context;
}; 