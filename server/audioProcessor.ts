import { spawn } from 'child_process';
import path from 'path';
import fs from 'fs/promises';
import * as fsSync from 'fs';
import { storage } from './storage';

// Function to extract the instrumental track from an audio file using Demucs
export async function extractInstrumental(
  trackId: string,
  inputFilePath: string,
  progressCallback: (progress: number) => void
): Promise<string> {
  const outputDirForPythonScript = path.join(process.cwd(), '.tmp', trackId); // Python script saves instrumental.mp3 here
  const pythonScriptPath = path.resolve(process.cwd(), 'server', 'scripts', 'demucs_processor.py');

  try {
    await fs.mkdir(outputDirForPythonScript, { recursive: true });
    if (!fsSync.existsSync(inputFilePath)) {
      throw new Error(`Input file not found: ${inputFilePath}`);
    }
    if (!fsSync.existsSync(pythonScriptPath)) {
      console.error(`Demucs Python script not found at: ${pythonScriptPath}`);
      throw new Error('Demucs processing script not found. Ensure server/scripts/demucs_processor.py exists.');
    }
  } catch (error: any) {
    console.error('Pre-Demucs check failed:', error);
    throw error; // Rethrow to be caught by the caller
  }

  return new Promise((resolve, reject) => {
    console.log(`Starting Demucs processing for trackId: ${trackId} using script: ${pythonScriptPath}`);
    // Note: sys.executable ensures we use the python from the correct env if multiple are present
    const demucsProcess = spawn(process.platform === 'win32' ? 'python' : 'python3', 
                                [pythonScriptPath, inputFilePath, outputDirForPythonScript],
                                { stdio: ['ignore', 'pipe', 'pipe'] });

    let stdoutData = '';
    let stderrData = '';
    let progressInterval: NodeJS.Timeout;

    demucsProcess.stdout.on('data', (data) => {
      stdoutData += data.toString();
    });

    demucsProcess.stderr.on('data', (data) => {
      const stderrLine = data.toString().trim();
      console.log(`DemucsPy stderr: ${stderrLine}`); // Log python stderr for debugging
      // Potentially parse progress from stderr if python script provides it
    });

    let progressPercent = 0;
    progressInterval = setInterval(() => {
      progressPercent += 5; // Simulate progress
      if (progressPercent <= 95) {
        progressCallback(progressPercent);
      }
    }, 1500); // Demucs can take a while

    demucsProcess.on('close', (code) => {
      clearInterval(progressInterval);
      console.log(`Demucs Python script exited with code ${code}.`);
      console.log(`DemucsPy stdout: ${stdoutData}`);
      if (stderrData && code !== 0) {
        console.error(`DemucsPy full stderr on error:\n${stderrData}`);
      }

      if (code === 0) {
        try {
          // Trim stdoutData to remove any potential leading/trailing whitespace or newlines
          const result = JSON.parse(stdoutData.trim()); 
          if (result.success && result.filepath) {
            if (fsSync.existsSync(result.filepath)) {
              console.log(`Demucs processing completed. Instrumental at: ${result.filepath}`);
              progressCallback(100);
              resolve(result.filepath);
            } else {
              console.error(`Demucs script reported success but output file not found: ${result.filepath}`);
              reject(new Error('Demucs script reported success but output file is missing.'));
            }
          } else {
            console.error('Demucs script execution failed or returned invalid/incomplete JSON:', result ? result.error : stdoutData);
            reject(new Error(result.error || 'Demucs script failed to produce the expected output (JSON error).'));
          }
        } catch (parseError: any) {
          console.error('Failed to parse Demucs script JSON output:', parseError);
          console.error(`Raw stdout from DemucsPy: ${stdoutData}`);
          reject(new Error(`Failed to parse Demucs script output (JSON parse error): ${parseError.message}`));
        }
      } else {
        console.error(`Demucs script failed with exit code ${code}.`);
        reject(new Error(`Demucs processing script failed. Exit code: ${code}. Error: ${stderrData || 'Unknown error from Demucs script'}`));
      }
    });

    demucsProcess.on('error', (err) => {
      clearInterval(progressInterval);
      console.error('Failed to start Demucs Python script:', err);
      reject(new Error(`Failed to start Demucs script: ${err.message}`));
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
  const outputDir = path.join(process.cwd(), '.tmp', trackId);
  await fs.mkdir(outputDir, { recursive: true });
  const outputFilePath = path.join(outputDir, `transposed_${semitones}.mp3`);
  
  // Check if input file exists
  try {
    if (!fsSync.existsSync(inputFilePath)) {
      throw new Error(`Input file not found: ${inputFilePath}`);
    }
  } catch (error: any) {
    console.error('Error checking input file:', error);
    throw new Error(`Input file check failed: ${error.message}`);
  }
  
  return new Promise((resolve, reject) => {
    let progressInterval: NodeJS.Timeout;
    
    // Calculate pitch factor for rubberband
    const pitchFactor = Math.pow(2, semitones / 12);

    // Using FFmpeg with rubberband filter for pitch shifting
    // Ensure ffmpeg is compiled with --enable-librubberband
    const command = `ffmpeg -i "${inputFilePath}" -af "rubberband=pitch=${pitchFactor}" -b:a 320k -y "${outputFilePath}"`;
    console.log(`Running FFmpeg command (rubberband): ${command}`);

    // IMPORTANT: Switched from exec to spawn for transposeAudio as well for consistency and better error handling.
    const ffmpegProcess = spawn('ffmpeg', ['-i', inputFilePath, '-af', `rubberband=pitch=${pitchFactor}`, '-b:a', '320k', '-y', outputFilePath], {
      stdio: ['ignore', 'pipe', 'pipe']
    });

    let stderrData = ''; // To capture stderr from ffmpeg

    ffmpegProcess.stderr.on('data', (data) => {
      stderrData += data.toString();
      // FFmpeg progress can be parsed from stderr if needed, but it's complex.
      // console.log(`FFmpeg (transpose) stderr: ${data.toString().trim()}`);
    });
    
    progressInterval = setInterval(() => {
      // This simulation is very basic. FFmpeg actual processing time will vary.
      progressPercent += 5; 
      if (progressPercent <= 95) {
        progressCallback(progressPercent);
      }
    }, 500); // Update progress less frequently for potentially longer task

    let progressPercent = 0; // Initialize progressPercent for transpose as well

    ffmpegProcess.on('close', (code) => {
      clearInterval(progressInterval);
      console.log(`FFmpeg (transpose) exited with code ${code}`);

      if (code === 0) {
        if (fsSync.existsSync(outputFilePath)) {
          console.log(`Audio transposition (rubberband) completed successfully: ${outputFilePath}`);
          progressCallback(100);
          resolve(outputFilePath);
        } else {
          console.error(`FFmpeg (transpose) completed but output file not found: ${outputFilePath}`);
          console.error(`FFmpeg (transpose) stderr: ${stderrData}`);
          reject(new Error('FFmpeg (transpose) completed but output file is missing.'));
        }
      } else {
        console.error('FFmpeg error (rubberband) during transpose:', stderrData);
        if (stderrData && (stderrData.includes('No such filter: \'rubberband\'') || stderrData.includes('rubberband not found'))) {
          reject(new Error(`Failed to transpose audio: FFmpeg rubberband filter is not available. Please ensure FFmpeg is compiled with --enable-librubberband. Original error: ${stderrData}`));
        } else {
          reject(new Error(`Failed to transpose audio. FFmpeg exit code: ${code}. Error: ${stderrData}`));
        }
      }
    });

    ffmpegProcess.on('error', (err) => {
      clearInterval(progressInterval);
      console.error('Failed to start FFmpeg (transpose) process:', err);
      reject(new Error(`Failed to start FFmpeg (transpose) process: ${err.message}`));
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
