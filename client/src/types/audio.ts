export interface AudioTrack {
  id: string;
  title: string;
  artist?: string | null;
  url?: string;
  activeUrl?: string;
  originalUrl?: string;
  instrumentalUrl?: string;
  duration: number;
  originalKey?: string | null;
  originalScale?: string | null;
  currentKey?: string | null;
  currentScale?: string | null;
  createdAt?: string;
}

export type ProcessingStatus = 
  'idle' | 
  'downloading' | 
  'processing' | 
  'transposing' | 
  'complete' | 
  'error' |
  'loading_model' |      // 모델 로딩 중
  'loading_file' |       // 파일 로딩 중 (YouTube 링크가 아닌 경우)
  'separating_stems';    // 음원 분리 중

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
