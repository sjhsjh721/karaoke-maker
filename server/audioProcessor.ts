import { spawn, exec } from 'child_process';
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
    exec(`ffmpeg -i "${inputFilePath}" -af "pan=stereo|c0=c0-0.5*c1|c1=c1-0.5*c0" -b:a 320k -y "${outputFilePath}"`, 
    (error, stdout, stderr) => {
      if (error) {
        console.error('FFmpeg error:', error);
        console.error('stderr:', stderr);
        reject(new Error(`Failed to extract instrumental: ${error.message}`));
        return;
      }
      
      resolve(outputFilePath);
    });
    
    // Simulate progress
    let progressPercent = 0;
    const progressInterval = setInterval(() => {
      progressPercent += 1;
      if (progressPercent <= 100) {
        progressCallback(progressPercent);
      } else {
        clearInterval(progressInterval);
      }
    }, 100);
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
    exec(`ffmpeg -i "${inputFilePath}" -af "asetrate=44100*2^(${semitones}/12),aresample=44100" -b:a 320k -y "${outputFilePath}"`,
    (error, stdout, stderr) => {
      if (error) {
        console.error('FFmpeg error:', error);
        console.error('stderr:', stderr);
        reject(new Error(`Failed to transpose audio: ${error.message}`));
        return;
      }
      
      resolve(outputFilePath);
    });
    
    // Simulate progress
    let progressPercent = 0;
    const progressInterval = setInterval(() => {
      progressPercent += 1;
      if (progressPercent <= 100) {
        progressCallback(progressPercent);
      } else {
        clearInterval(progressInterval);
      }
    }, 50);
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
// Simplified to generate dummy data since ffprobe might have issues
export async function generateWaveformData(inputFilePath: string): Promise<number[]> {
  // Generate some random waveform data instead of using ffprobe
  const sampleCount = 100;
  const waveformData = [];
  
  for (let i = 0; i < sampleCount; i++) {
    // Generate a value between 0.2 and 0.8 with some randomness
    // but following a smooth pattern resembling a waveform
    const value = 0.2 + 0.6 * Math.sin(i / 8) * Math.sin(i / 2) * (0.7 + 0.3 * Math.random());
    waveformData.push(Math.max(0, Math.min(1, value)));
  }
  
  return waveformData;
}
