import { type ClassValue, clsx } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function formatTime(seconds: number): string {
  if (isNaN(seconds)) return "0:00";
  
  const minutes = Math.floor(seconds / 60);
  const remainingSeconds = Math.floor(seconds % 60);
  return `${minutes}:${remainingSeconds.toString().padStart(2, '0')}`;
}

export function validateYouTubeUrl(url: string): boolean {
  // Regular expression to match YouTube URLs
  const regExp = /^(?:https?:\/\/)?(?:www\.)?(?:youtube\.com\/(?:watch\?v=|embed\/|v\/)|youtu\.be\/)([a-zA-Z0-9_-]{11})(?:\S+)?$/;
  return regExp.test(url);
}

export function extractVideoId(url: string): string | null {
  // Extract the video ID from a YouTube URL
  const regExp = /^(?:https?:\/\/)?(?:www\.)?(?:youtube\.com\/(?:watch\?v=|embed\/|v\/)|youtu\.be\/)([a-zA-Z0-9_-]{11})(?:\S+)?$/;
  const match = url.match(regExp);
  return match ? match[1] : null;
}

export const musicalKeys = [
  "C", "C#", "D", "D#", "E", "F", "F#", "G", "G#", "A", "A#", "B"
];

export type ScaleType = "major" | "minor";

export function calculateSemitones(
  fromKey: string,
  toKey: string,
  fromScale: ScaleType,
  toScale: ScaleType
): number {
  // Calculate how many semitones to shift
  const fromKeyIndex = musicalKeys.indexOf(fromKey);
  const toKeyIndex = musicalKeys.indexOf(toKey);
  
  if (fromKeyIndex === -1 || toKeyIndex === -1) {
    return 0;
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

export function getThumbPosition(semitones: number): number {
  // Convert semitones (-12 to +12) to a percentage (0 to 100)
  return ((semitones + 12) / 24) * 100;
}

export function getSemitonesFromPosition(position: number): number {
  // Convert percentage (0 to 100) to semitones (-12 to +12)
  return Math.round((position / 100) * 24) - 12;
}
