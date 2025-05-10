import { spawn } from 'child_process';
import { storage } from './storage';
import path from 'path';
import fs from 'fs/promises';

// Utility to extract video ID from YouTube URL
export function extractVideoId(url: string): string | null {
  const regExp = /^(?:https?:\/\/)?(?:www\.)?(?:youtube\.com\/(?:watch\?v=|embed\/|v\/)|youtu\.be\/)([a-zA-Z0-9_-]{11})(?:\S+)?$/;
  const match = url.match(regExp);
  return match ? match[1] : null;
}

// Function to extract video title and artist
async function getVideoInfo(videoId: string): Promise<{ title: string, artist: string }> {
  return new Promise((resolve, reject) => {
    const ytdlp = spawn('yt-dlp', [
      '--print', 'title,channel',
      '--skip-download',
      `https://www.youtube.com/watch?v=${videoId}`
    ]);
    
    let output = '';
    
    ytdlp.stdout.on('data', (data) => {
      output += data.toString();
    });
    
    ytdlp.on('close', (code) => {
      if (code !== 0) {
        reject(new Error(`yt-dlp exited with code ${code}`));
        return;
      }
      
      const lines = output.trim().split('\n');
      const title = lines[0] || 'Unknown Title';
      const artist = lines[1] || 'Unknown Artist';
      
      resolve({ title, artist });
    });
    
    ytdlp.on('error', (err) => {
      reject(err);
    });
  });
}

// Function to download audio from YouTube
export async function downloadYouTubeAudio(trackId: string, url: string, progressCallback: (progress: number) => void): Promise<{ filePath: string, videoId: string, title: string, artist: string, duration: number }> {
  const videoId = extractVideoId(url);
  
  if (!videoId) {
    throw new Error('Invalid YouTube URL');
  }
  
  // Create a temp directory for the download
  const downloadDir = path.join(process.cwd(), '.tmp', trackId);
  await fs.mkdir(downloadDir, { recursive: true });
  
  const outputFile = path.join(downloadDir, 'original.mp3');
  
  // Get video information
  const { title, artist } = await getVideoInfo(videoId);
  
  return new Promise((resolve, reject) => {
    // Use yt-dlp to download the audio
    const ytdlp = spawn('yt-dlp', [
      '-x',
      '--audio-format', 'mp3',
      '--audio-quality', '0',
      '-o', outputFile,
      '--print', 'after_move:filepath',
      '--newline',
      '--print', 'duration',
      url
    ]);
    
    let filePath = '';
    let duration = 0;
    let lastProgressLine = '';
    
    ytdlp.stdout.on('data', (data) => {
      const output = data.toString();
      
      // If the output includes a filepath, store it
      if (output.trim().endsWith('.mp3')) {
        filePath = output.trim();
      }
      
      // If the output is a number, it's the duration
      if (/^\d+(\.\d+)?$/.test(output.trim())) {
        duration = parseFloat(output.trim());
      }
    });
    
    ytdlp.stderr.on('data', (data) => {
      const lines = data.toString().split('\n');
      for (const line of lines) {
        if (line.includes('[download]')) {
          lastProgressLine = line;
          // Extract progress percentage
          const match = line.match(/(\d+\.\d+)%/);
          if (match && match[1]) {
            const percentage = parseFloat(match[1]);
            progressCallback(percentage);
          }
        }
      }
    });
    
    ytdlp.on('close', (code) => {
      if (code !== 0) {
        reject(new Error(`yt-dlp exited with code ${code}: ${lastProgressLine}`));
        return;
      }
      
      if (!filePath) {
        filePath = outputFile;
      }
      
      resolve({ 
        filePath, 
        videoId, 
        title, 
        artist,
        duration
      });
    });
    
    ytdlp.on('error', (err) => {
      reject(err);
    });
  });
}
