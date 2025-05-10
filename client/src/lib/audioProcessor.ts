import WaveSurfer from 'wavesurfer.js';
import { formatTime } from './utils';

export interface WavesurferOptions {
  container: HTMLElement;
  waveColor?: string;
  progressColor?: string;
  cursorColor?: string;
  barWidth?: number;
  barRadius?: number;
  responsive?: boolean;
  height?: number;
  url?: string;
}

class AudioProcessor {
  private wavesurfer: WaveSurfer | null = null;
  private container: HTMLElement | null = null;
  private onReadyCallback: (() => void) | null = null;
  private onTimeUpdateCallback: ((time: number) => void) | null = null;
  private onFinishCallback: (() => void) | null = null;
  
  constructor() {
    // Initialize empty
  }
  
  async initializeWaveform(options: WavesurferOptions) {
    if (this.wavesurfer) {
      this.wavesurfer.destroy();
    }
    
    this.container = options.container;
    
    try {
      // Dynamic import to avoid SSR issues
      const WaveSurfer = (await import('wavesurfer.js')).default;
      
      this.wavesurfer = WaveSurfer.create({
        container: options.container,
        waveColor: options.waveColor || '#6200EA',
        progressColor: options.progressColor || '#9747FF',
        cursorColor: options.cursorColor || 'transparent',
        barWidth: options.barWidth || 2,
        barRadius: options.barRadius || 3,
        responsive: options.responsive !== undefined ? options.responsive : true,
        height: options.height || 80,
        normalize: true,
      });
      
      if (options.url) {
        await this.loadAudio(options.url);
      }
      
      this.setupListeners();
      
      return this.wavesurfer;
    } catch (error) {
      console.error('Error initializing waveform:', error);
      throw error;
    }
  }
  
  private setupListeners() {
    if (!this.wavesurfer) return;
    
    this.wavesurfer.on('ready', () => {
      if (this.onReadyCallback) this.onReadyCallback();
    });
    
    this.wavesurfer.on('audioprocess', (time) => {
      if (this.onTimeUpdateCallback) this.onTimeUpdateCallback(time);
    });
    
    this.wavesurfer.on('finish', () => {
      if (this.onFinishCallback) this.onFinishCallback();
    });
  }
  
  async loadAudio(url: string): Promise<void> {
    if (!this.wavesurfer) {
      throw new Error('Wavesurfer not initialized');
    }
    
    return new Promise((resolve, reject) => {
      try {
        this.wavesurfer?.load(url);
        
        const handleReady = () => {
          this.wavesurfer?.un('ready', handleReady);
          resolve();
        };
        
        this.wavesurfer?.on('ready', handleReady);
        
        // Error handling
        const handleError = (err: Error) => {
          this.wavesurfer?.un('error', handleError);
          reject(err);
        };
        
        this.wavesurfer?.on('error', handleError);
      } catch (error) {
        reject(error);
      }
    });
  }
  
  setOnReadyCallback(callback: () => void) {
    this.onReadyCallback = callback;
  }
  
  setOnTimeUpdateCallback(callback: (time: number) => void) {
    this.onTimeUpdateCallback = callback;
  }
  
  setOnFinishCallback(callback: () => void) {
    this.onFinishCallback = callback;
  }
  
  play() {
    this.wavesurfer?.play();
  }
  
  pause() {
    this.wavesurfer?.pause();
  }
  
  stop() {
    if (this.wavesurfer) {
      this.wavesurfer.stop();
    }
  }
  
  seek(progress: number) {
    if (this.wavesurfer) {
      this.wavesurfer.seekTo(progress / 100);
    }
  }
  
  seekToTime(time: number) {
    if (this.wavesurfer) {
      const duration = this.getDuration();
      if (duration) {
        this.wavesurfer.seekTo(time / duration);
      }
    }
  }
  
  getCurrentTime(): number {
    return this.wavesurfer?.getCurrentTime() || 0;
  }
  
  getDuration(): number {
    return this.wavesurfer?.getDuration() || 0;
  }
  
  getFormattedTime(): string {
    return formatTime(this.getCurrentTime());
  }
  
  getFormattedDuration(): string {
    return formatTime(this.getDuration());
  }
  
  isPlaying(): boolean {
    return this.wavesurfer?.isPlaying() || false;
  }
  
  setVolume(volume: number) {
    if (this.wavesurfer) {
      this.wavesurfer.setVolume(volume);
    }
  }
  
  destroy() {
    if (this.wavesurfer) {
      this.wavesurfer.destroy();
      this.wavesurfer = null;
    }
  }
}

// Export singleton instance
export const audioProcessor = new AudioProcessor();
