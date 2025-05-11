import { audioTracks, processingStatus, type AudioTrack, type ProcessingStatus, type InsertAudioTrack, type InsertProcessingStatus } from "../shared/schema.js";
import { v4 as uuidv4 } from 'uuid';
import * as fs from 'fs/promises';
import * as path from 'path';

// Modify the interface with the CRUD methods we need
export interface IStorage {
  // Audio track operations
  getAudioTrack(trackId: string): Promise<AudioTrack | undefined>;
  getAudioTrackByVideoId(videoId: string): Promise<AudioTrack | undefined>;
  createAudioTrack(track: Omit<InsertAudioTrack, 'trackId'>): Promise<AudioTrack>;
  updateAudioTrack(trackId: string, data: Partial<InsertAudioTrack>): Promise<AudioTrack | undefined>;
  
  // Processing status operations
  getProcessingStatus(trackId: string): Promise<ProcessingStatus | undefined>;
  createProcessingStatus(status: Omit<InsertProcessingStatus, 'trackId'> & { trackId: string }): Promise<ProcessingStatus>;
  updateProcessingStatus(trackId: string, data: Partial<InsertProcessingStatus>): Promise<ProcessingStatus | undefined>;
  
  // File operations
  saveFile(trackId: string, fileContent: Buffer, fileName: string): Promise<string>;
  getFilePath(trackId: string, fileName: string): Promise<string>;
  fileExists(filePath: string): Promise<boolean>;
}

export class MemStorage implements IStorage {
  private audioTracks: Map<string, AudioTrack>;
  private processingStatuses: Map<string, ProcessingStatus>;
  private tempDir: string;
  private currentId: number;
  
  constructor() {
    this.audioTracks = new Map();
    this.processingStatuses = new Map();
    this.currentId = 1;
    
    // Create a temporary directory for file storage
    this.tempDir = path.resolve(process.cwd(), '.tmp');
    this.ensureTempDirExists();
  }
  
  private async ensureTempDirExists() {
    try {
      await fs.mkdir(this.tempDir, { recursive: true });
    } catch (error) {
      console.error('Failed to create temp directory:', error);
    }
  }
  
  async getAudioTrack(trackId: string): Promise<AudioTrack | undefined> {
    return Array.from(this.audioTracks.values()).find(
      (track) => track.trackId === trackId
    );
  }
  
  async getAudioTrackByVideoId(videoId: string): Promise<AudioTrack | undefined> {
    return Array.from(this.audioTracks.values()).find(
      (track) => track.videoId === videoId
    );
  }
  
  async createAudioTrack(trackData: InsertAudioTrack): Promise<AudioTrack> {
    const id = this.currentId++;
    
    const track: AudioTrack = {
      id,
      trackId: trackData.trackId,
      title: trackData.title,
      artist: trackData.artist || "Unknown",
      videoId: trackData.videoId,
      originalKey: trackData.originalKey || "C",
      originalScale: trackData.originalScale || "major",
      currentKey: trackData.currentKey || trackData.originalKey || "C",
      currentScale: trackData.currentScale || trackData.originalScale || "major",
      duration: trackData.duration || 0,
      filePath: trackData.filePath,
      originalFilePath: trackData.originalFilePath || trackData.filePath,
      createdAt: new Date(),
    };
    
    this.audioTracks.set(trackData.trackId, track);
    return track;
  }
  
  async updateAudioTrack(trackId: string, data: Partial<InsertAudioTrack>): Promise<AudioTrack | undefined> {
    const track = await this.getAudioTrack(trackId);
    
    if (!track) {
      return undefined;
    }
    
    const updatedTrack = {
      ...track,
      ...data,
    };
    
    this.audioTracks.set(trackId, updatedTrack);
    return updatedTrack;
  }
  
  async getProcessingStatus(trackId: string): Promise<ProcessingStatus | undefined> {
    return this.processingStatuses.get(trackId);
  }
  
  async createProcessingStatus(statusData: Omit<InsertProcessingStatus, 'trackId'> & { trackId: string }): Promise<ProcessingStatus> {
    const id = this.currentId++;
    const now = new Date();
    
    const status: ProcessingStatus = {
      id,
      trackId: statusData.trackId,
      status: statusData.status || "idle",
      progress: statusData.progress || 0,
      error: statusData.error || null,
      createdAt: now,
      updatedAt: now,
    };
    
    this.processingStatuses.set(statusData.trackId, status);
    return status;
  }
  
  async updateProcessingStatus(trackId: string, data: Partial<InsertProcessingStatus>): Promise<ProcessingStatus | undefined> {
    const status = this.processingStatuses.get(trackId);
    
    if (!status) {
      return undefined;
    }
    
    const updatedStatus = {
      ...status,
      ...data,
      updatedAt: new Date(),
    };
    
    this.processingStatuses.set(trackId, updatedStatus);
    return updatedStatus;
  }
  
  async saveFile(trackId: string, fileContent: Buffer, fileName: string): Promise<string> {
    // Create directory for this track if it doesn't exist
    const trackDir = path.join(this.tempDir, trackId);
    await fs.mkdir(trackDir, { recursive: true });
    
    const filePath = path.join(trackDir, fileName);
    await fs.writeFile(filePath, fileContent);
    
    return filePath;
  }
  
  async getFilePath(trackId: string, fileName: string): Promise<string> {
    return path.join(this.tempDir, trackId, fileName);
  }
  
  async fileExists(filePath: string): Promise<boolean> {
    try {
      await fs.access(filePath);
      return true;
    } catch {
      return false;
    }
  }
}

export const storage = new MemStorage();
