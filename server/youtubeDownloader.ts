import { spawn, exec } from 'child_process';
import { storage } from './storage';
import path from 'path';
import fs from 'fs/promises';

// Utility to extract video ID from YouTube URL
export function extractVideoId(url: string): string | null {
  const regExp = /^(?:https?:\/\/)?(?:www\.)?(?:youtube\.com\/(?:watch\?v=|embed\/|v\/)|youtu\.be\/)([a-zA-Z0-9_-]{11})(?:\S+)?$/;
  const match = url.match(regExp);
  return match ? match[1] : null;
}

// Function to download audio from YouTube using our Python script
export async function downloadYouTubeAudio(trackId: string, url: string, progressCallback: (progress: number) => void): Promise<{ filePath: string, videoId: string, title: string, artist: string, duration: number }> {
  const videoId = extractVideoId(url);
  
  if (!videoId) {
    throw new Error('Invalid YouTube URL');
  }
  
  // Create a temp directory for the download
  const downloadDir = path.resolve('.tmp', trackId);
  await fs.mkdir(downloadDir, { recursive: true });
  
  // Simulate progress since we can't get real-time progress from the Python script
  let fakeProgress = 0;
  const progressInterval = setInterval(() => {
    fakeProgress += 1;
    if (fakeProgress <= 100) {
      progressCallback(fakeProgress);
    } else {
      clearInterval(progressInterval);
    }
  }, 100);
  
  return new Promise((resolve, reject) => {
    const pythonScript = path.resolve('youtube_download.py');
    
    // Use our Python script to download the audio
    const pythonProcess = exec(`python3 ${pythonScript} "${url}" "${downloadDir}"`, {
      maxBuffer: 1024 * 1024 * 10 // 10MB buffer
    }, (error, stdout, stderr) => {
      clearInterval(progressInterval);
      
      if (error) {
        console.error('Python script error:', error);
        console.error('stderr:', stderr);
        reject(new Error(`Failed to download audio: ${error.message}`));
        return;
      }
      
      try {
        const result = JSON.parse(stdout);
        
        if (!result.success) {
          reject(new Error(result.error || 'Failed to download audio'));
          return;
        }
        
        resolve({ 
          filePath: result.filepath, 
          videoId: result.videoId, 
          title: result.title, 
          artist: result.artist,
          duration: result.duration || 0
        });
      } catch (parseError) {
        console.error('Failed to parse Python script output:', parseError);
        console.error('Output:', stdout);
        reject(new Error('Failed to parse download results'));
      }
    });
  });
}
