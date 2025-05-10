import { spawn } from 'child_process';
import path from 'path';
import fs from 'fs/promises';
import { storage } from './storage';

// Function to extract the instrumental track from an audio file
export async function extractInstrumental(
  trackId: string, 
  inputFilePath: string, 
  progressCallback: (progress: number) => void
): Promise<string> {
  // Create output directory
  const outputDir = path.join(process.cwd(), '.tmp', trackId);
  await fs.mkdir(outputDir, { recursive: true });
  
  const outputFilePath = path.join(outputDir, 'instrumental.mp3');
  
  return new Promise((resolve, reject) => {
    // Using FFmpeg for basic vocal removal
    // This is a simplified approach - in production you would use a more sophisticated
    // method like Spleeter or other ML-based stem separation
    const ffmpeg = spawn('ffmpeg', [
      '-i', inputFilePath,
      '-af', 'pan=stereo|c0=c0-0.5*c1|c1=c1-0.5*c0',
      '-b:a', '320k',
      '-y',
      outputFilePath
    ]);
    
    let progressPercent = 0;
    
    ffmpeg.stderr.on('data', (data) => {
      // FFmpeg outputs progress to stderr
      const output = data.toString();
      
      // Simulate progress since FFmpeg doesn't provide easy progress tracking for this operation
      progressPercent += 0.5;
      if (progressPercent <= 100) {
        progressCallback(progressPercent);
      }
    });
    
    ffmpeg.on('close', (code) => {
      if (code !== 0) {
        reject(new Error(`FFmpeg exited with code ${code}`));
        return;
      }
      
      resolve(outputFilePath);
    });
    
    ffmpeg.on('error', (err) => {
      reject(err);
    });
  });
}

// Function to transpose audio to a different key
export async function transposeAudio(
  trackId: string,
  inputFilePath: string,
  semitones: number,
  progressCallback: (progress: number) => void
): Promise<string> {
  // Create output directory
  const outputDir = path.join(process.cwd(), '.tmp', trackId);
  await fs.mkdir(outputDir, { recursive: true });
  
  const outputFilePath = path.join(outputDir, `transposed_${semitones}.mp3`);
  
  return new Promise((resolve, reject) => {
    // Using FFmpeg to change the pitch/key
    const ffmpeg = spawn('ffmpeg', [
      '-i', inputFilePath,
      '-af', `asetrate=44100*2^(${semitones}/12),aresample=44100`,
      '-b:a', '320k',
      '-y',
      outputFilePath
    ]);
    
    let progressPercent = 0;
    
    ffmpeg.stderr.on('data', (data) => {
      // FFmpeg outputs progress to stderr
      const output = data.toString();
      
      // Simulate progress since FFmpeg doesn't provide easy progress tracking for this operation
      progressPercent += 1;
      if (progressPercent <= 100) {
        progressCallback(progressPercent);
      }
    });
    
    ffmpeg.on('close', (code) => {
      if (code !== 0) {
        reject(new Error(`FFmpeg exited with code ${code}`));
        return;
      }
      
      resolve(outputFilePath);
    });
    
    ffmpeg.on('error', (err) => {
      reject(err);
    });
  });
}

// Function to calculate semitones between keys
export function calculateSemitones(
  fromKey: string,
  toKey: string,
  fromScale: 'major' | 'minor',
  toScale: 'major' | 'minor'
): number {
  const keyMap = {
    'C': 0, 'C#': 1, 'D': 2, 'D#': 3, 'E': 4, 'F': 5,
    'F#': 6, 'G': 7, 'G#': 8, 'A': 9, 'A#': 10, 'B': 11
  };
  
  const fromKeyIndex = keyMap[fromKey as keyof typeof keyMap];
  const toKeyIndex = keyMap[toKey as keyof typeof keyMap];
  
  if (fromKeyIndex === undefined || toKeyIndex === undefined) {
    throw new Error('Invalid key');
  }
  
  // Basic semitone difference based on key
  let semitones = toKeyIndex - fromKeyIndex;
  
  // Adjust for octave (circle of fifths)
  if (semitones > 6) semitones -= 12;
  if (semitones < -6) semitones += 12;
  
  // Adjust for scale change (major to minor is -3 semitones, minor to major is +3)
  if (fromScale === "major" && toScale === "minor") {
    semitones -= 3;
  } else if (fromScale === "minor" && toScale === "major") {
    semitones += 3;
  }
  
  return semitones;
}

// Function to generate waveform data from an audio file
export async function generateWaveformData(inputFilePath: string): Promise<number[]> {
  return new Promise((resolve, reject) => {
    const ffprobe = spawn('ffprobe', [
      '-i', inputFilePath,
      '-f', 'lavfi',
      '-af', 'astats=metadata=1:reset=1,asetnsamples=n=44100',
      '-show_entries', 'frame_tags=lavfi.astats.Overall.RMS_level',
      '-of', 'json'
    ]);
    
    let output = '';
    
    ffprobe.stdout.on('data', (data) => {
      output += data.toString();
    });
    
    ffprobe.on('close', (code) => {
      if (code !== 0) {
        // If ffprobe fails, just return empty waveform data
        resolve([]);
        return;
      }
      
      try {
        const result = JSON.parse(output);
        const frames = result.frames || [];
        
        // Extract RMS levels and normalize between 0 and 1
        const waveformData = frames
          .map((frame: any) => {
            const rmsLevel = frame.tags && frame.tags['lavfi.astats.Overall.RMS_level'];
            if (rmsLevel !== undefined) {
              // Convert dB to linear (approximately)
              const db = parseFloat(rmsLevel);
              // Normalize and ensure positive values (dB values are typically negative)
              return Math.max(0, Math.min(1, (db + 60) / 60));
            }
            return null;
          })
          .filter((level: number | null) => level !== null);
        
        // Downsample to a reasonable number of points (e.g., 100)
        const sampledData = downsampleArray(waveformData as number[], 100);
        
        resolve(sampledData);
      } catch (err) {
        // If parsing fails, just return empty waveform data
        resolve([]);
      }
    });
    
    ffprobe.on('error', (err) => {
      resolve([]); // Just resolve with empty data on error
    });
  });
}

// Helper function to downsample an array
function downsampleArray(array: number[], targetLength: number): number[] {
  if (array.length <= targetLength) return array;
  
  const result = [];
  const step = array.length / targetLength;
  
  for (let i = 0; i < targetLength; i++) {
    const idx = Math.floor(i * step);
    result.push(array[idx]);
  }
  
  return result;
}
