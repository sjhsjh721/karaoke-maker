import { spawn, exec } from 'child_process';
import { storage } from './storage';
import path from 'path';
import fs from 'fs/promises';
import * as fsSync from 'fs';
import os from 'os';

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
    // 절대 경로 사용
    const pythonScript = path.resolve(process.cwd(), 'youtube_download.py');
    
    // Determine the correct Python command based on the OS
    const pythonCommand = os.platform() === 'win32' ? 'python' : 'python3';
    
    console.log(`Project root directory: ${process.cwd()}`);
    console.log(`Executing: ${pythonCommand} ${pythonScript} "${url}" "${downloadDir}"`);
    
    // Use spawn instead of exec for better control
    const pythonProcess = spawn(
      pythonCommand, 
      [pythonScript, url, downloadDir],
      {
        stdio: ['ignore', 'pipe', 'pipe']
      }
    );
    
    let stdout = '';
    let stderr = '';
    
    pythonProcess.stdout.on('data', (data) => {
      stdout += data.toString();
    });
    
    pythonProcess.stderr.on('data', (data) => {
      stderr += data.toString();
      console.log(`Python stderr: ${data.toString()}`);
    });
    
    pythonProcess.on('error', (error) => {
      clearInterval(progressInterval);
      console.error('Failed to start Python process:', error);
      reject(new Error(`Failed to start Python process: ${error.message}`));
    });
    
    pythonProcess.on('close', (code) => {
      clearInterval(progressInterval);
      
      if (code !== 0) {
        console.error(`Python process exited with code ${code}`);
        console.error('stderr:', stderr);
        reject(new Error(`Python process failed with code ${code}: ${stderr}`));
        return;
      }
      
      try {
        console.log('Python script output:', stdout);
        const result = JSON.parse(stdout);
        
        if (!result.success) {
          reject(new Error(result.error || 'Failed to download audio'));
          return;
        }
        
        // 파일 존재 여부 확인
        console.log(`Checking if file exists at: ${result.filepath}`);
        if (!fsSync.existsSync(result.filepath)) {
          console.error(`File reported as downloaded but not found at: ${result.filepath}`);
          reject(new Error(`Download reported success but file not found at: ${result.filepath}. Check yt-dlp installation and permissions.`));
          return;
        }
        
        console.log(`File exists and has size: ${fsSync.statSync(result.filepath).size} bytes`);
        
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
        reject(new Error('Failed to parse download results. Make sure yt-dlp is installed.'));
      }
    });
  });
}
