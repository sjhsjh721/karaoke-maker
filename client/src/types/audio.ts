export type AudioTrack = {
  id: string;
  title: string;
  artist: string;
  duration: number;
  originalKey: string;
  originalScale: 'major' | 'minor';
  currentKey: string;
  currentScale: 'major' | 'minor';
  url: string;
  waveformData?: number[];
  createdAt: Date;
};

export type ProcessingStatus = 'idle' | 'downloading' | 'processing' | 'transposing' | 'complete' | 'error';

export type AudioProcessingError = {
  message: string;
  code: string;
  details?: string;
};

export interface AudioProcessingOptions {
  videoUrl: string;
  targetKey?: string;
  targetScale?: 'major' | 'minor';
  semitones?: number;
}

export interface AudioProcessingResult {
  trackId: string;
  title: string;
  artist: string;
  duration: number;
  originalKey: string;
  originalScale: 'major' | 'minor';
  url: string;
}
