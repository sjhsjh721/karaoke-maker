import path from 'path';
import fs from 'fs/promises';
import { randomUUID } from 'crypto';

// Function to simulate audio extraction and processing
export async function simulateAudioProcessing(
  trackId: string,
  videoUrl: string,
  progressCallback: (progress: number) => void
): Promise<{
  filePath: string;
  videoId: string;
  title: string;
  artist: string;
  duration: number;
}> {
  // Extract video ID from URL
  const videoId = extractVideoId(videoUrl);
  if (!videoId) {
    throw new Error('Invalid YouTube URL');
  }

  // Create temp directory
  const outputDir = path.resolve('.tmp', trackId);
  await fs.mkdir(outputDir, { recursive: true });
  
  // Mock file path
  const filePath = path.join(outputDir, 'simulated.mp3');

  // Create an empty file to simulate the download
  await fs.writeFile(filePath, '');

  // Get mock video details based on ID (simplified)
  const { title, artist, duration } = getMockVideoDetails(videoId);

  // Simulate processing with delay and progress
  await simulateProgressiveTask(progress => {
    progressCallback(progress);
  });

  return {
    filePath,
    videoId,
    title,
    artist,
    duration
  };
}

// Function to simulate audio transposition
export async function simulateAudioTransposition(
  trackId: string,
  semitones: number,
  progressCallback: (progress: number) => void
): Promise<string> {
  // Create temp directory
  const outputDir = path.resolve('.tmp', trackId);
  await fs.mkdir(outputDir, { recursive: true });
  
  // Mock file path for transposed audio
  const filePath = path.join(outputDir, `transposed_${semitones}.mp3`);

  // Create an empty file to simulate the transposition
  await fs.writeFile(filePath, '');

  // Simulate processing with delay and progress
  await simulateProgressiveTask(progress => {
    progressCallback(progress);
  }, 3000); // Shorter time for transposition

  return filePath;
}

// Helper to extract video ID from URL
function extractVideoId(url: string): string | null {
  const regExp = /^(?:https?:\/\/)?(?:www\.)?(?:youtube\.com\/(?:watch\?v=|embed\/|v\/)|youtu\.be\/)([a-zA-Z0-9_-]{11})(?:\S+)?$/;
  const match = url.match(regExp);
  return match ? match[1] : null;
}

// Helper to delay execution with progress simulation
function simulateProgressiveTask(
  progressCallback: (progress: number) => void,
  totalTimeMs = 5000
): Promise<void> {
  return new Promise((resolve) => {
    const startTime = Date.now();
    const interval = setInterval(() => {
      const elapsed = Date.now() - startTime;
      const progress = Math.min(Math.floor((elapsed / totalTimeMs) * 100), 100);
      
      progressCallback(progress);
      
      if (progress >= 100) {
        clearInterval(interval);
        resolve();
      }
    }, 100);
  });
}

// Helper to generate mock video details
function getMockVideoDetails(videoId: string): { title: string; artist: string; duration: number } {
  // Map of hard-coded popular songs to simulate extraction
  const mockSongs: Record<string, { title: string; artist: string; duration: number }> = {
    // Some popular YouTube music videos
    'JGwWNGJdvx8': { 
      title: 'Shape of You', 
      artist: 'Ed Sheeran', 
      duration: 235 
    },
    'TUVcZfQe-Kw': { 
      title: 'Levitating', 
      artist: 'Dua Lipa', 
      duration: 203 
    },
    '4NRXx6U8ABQ': { 
      title: 'Blinding Lights', 
      artist: 'The Weeknd', 
      duration: 200 
    },
    'kJQP7kiw5Fk': { 
      title: 'Despacito', 
      artist: 'Luis Fonsi ft. Daddy Yankee', 
      duration: 232 
    },
    'lVAgm2nPDjY': { 
      title: 'Ocean Eyes', 
      artist: 'Billie Eilish', 
      duration: 200 
    }
  };

  // Return matching song or generic info
  return mockSongs[videoId] || {
    title: `YouTube Song ${videoId.substring(0, 6)}`,
    artist: 'Unknown Artist',
    duration: 180 + Math.floor(Math.random() * 120) // 3-5 min song
  };
}

// Generate simulated waveform data
export function generateSimulatedWaveformData(): number[] {
  const sampleCount = 100;
  const waveformData: number[] = [];
  
  for (let i = 0; i < sampleCount; i++) {
    // Generate a value between 0.2 and 0.8 with some randomness
    // but following a smooth pattern resembling a waveform
    const value = 0.2 + 0.6 * Math.sin(i / 8) * Math.sin(i / 2) * (0.7 + 0.3 * Math.random());
    waveformData.push(Math.max(0, Math.min(1, value)));
  }
  
  return waveformData;
}