import type { Express, Request, Response } from "express";
import { createServer, type Server } from "http";
import { storage } from "./storage";
import path from "path";
import { v4 as uuidv4 } from 'uuid';
import multer from 'multer';
import { body, validationResult } from 'express-validator';
import fs from 'fs/promises';
import { downloadYouTubeAudio, extractVideoId } from './youtubeDownloader';
import { extractInstrumental, transposeAudio, calculateSemitones, generateWaveformData } from './audioProcessor';
import { youtubeUrlSchema, transposeRequestSchema } from '@shared/schema';

// Configure multer for file storage (although we'll use the storage interface)
const upload = multer({ storage: multer.memoryStorage() });

export async function registerRoutes(app: Express): Promise<Server> {
  // Create HTTP server
  const httpServer = createServer(app);
  
  // API Routes
  
  // Process a YouTube URL
  app.post('/api/audio/process', async (req: Request, res: Response) => {
    try {
      // Validate request
      const validation = youtubeUrlSchema.safeParse({ url: req.body.videoUrl });
      if (!validation.success) {
        return res.status(400).json({ message: 'Invalid YouTube URL' });
      }
      
      const videoUrl = req.body.videoUrl;
      const videoId = extractVideoId(videoUrl);
      
      if (!videoId) {
        return res.status(400).json({ message: 'Could not extract video ID from URL' });
      }
      
      // Check if this video has already been processed
      const existingTrack = await storage.getAudioTrackByVideoId(videoId);
      if (existingTrack) {
        // Update processing status to complete since we already have it
        await storage.updateProcessingStatus(existingTrack.trackId, {
          status: 'complete',
          progress: 100
        });
        
        return res.status(200).json(existingTrack.trackId);
      }
      
      // Generate a new track ID
      const trackId = uuidv4();
      
      // Create a new processing status entry
      await storage.createProcessingStatus({
        trackId,
        status: 'downloading',
        progress: 0
      });
      
      // Start processing in the background
      processYouTubeVideo(trackId, videoUrl).catch(error => {
        console.error('Error processing YouTube video:', error);
        storage.updateProcessingStatus(trackId, {
          status: 'error',
          error: error.message
        });
      });
      
      // Return the track ID immediately
      res.status(200).json(trackId);
    } catch (error: any) {
      console.error('Error processing audio:', error);
      res.status(500).json({ message: 'Error processing audio', error: error.message });
    }
  });
  
  // Get processing status
  app.get('/api/audio/:trackId/status', async (req: Request, res: Response) => {
    try {
      const { trackId } = req.params;
      
      const status = await storage.getProcessingStatus(trackId);
      
      if (!status) {
        return res.status(404).json({ message: 'Processing status not found' });
      }
      
      res.status(200).json({
        status: status.status,
        progress: status.progress,
        error: status.error
      });
    } catch (error: any) {
      console.error('Error getting processing status:', error);
      res.status(500).json({ message: 'Error getting processing status', error: error.message });
    }
  });
  
  // Get audio track details
  app.get('/api/audio/:trackId', async (req: Request, res: Response) => {
    try {
      const { trackId } = req.params;
      
      const track = await storage.getAudioTrack(trackId);
      
      if (!track) {
        return res.status(404).json({ message: 'Audio track not found' });
      }
      
      // Return track details without the file path (for security)
      res.status(200).json({
        id: track.trackId,
        title: track.title,
        artist: track.artist,
        duration: track.duration,
        originalKey: track.originalKey,
        originalScale: track.originalScale,
        currentKey: track.currentKey,
        currentScale: track.currentScale,
        url: `/api/audio/${trackId}/stream`,
        waveformData: track.waveformData ? JSON.parse(track.waveformData) : undefined,
        createdAt: track.createdAt
      });
    } catch (error: any) {
      console.error('Error getting audio track:', error);
      res.status(500).json({ message: 'Error getting audio track', error: error.message });
    }
  });
  
  // Stream audio file
  app.get('/api/audio/:trackId/stream', async (req: Request, res: Response) => {
    try {
      const { trackId } = req.params;
      
      const track = await storage.getAudioTrack(trackId);
      
      if (!track) {
        return res.status(404).json({ message: 'Audio track not found' });
      }
      
      // Get the file path
      const filePath = track.filePath;
      
      // Check if file exists
      const fileExists = await storage.fileExists(filePath);
      
      if (!fileExists) {
        return res.status(404).json({ message: 'Audio file not found' });
      }
      
      // Set content type and stream the file
      res.setHeader('Content-Type', 'audio/mpeg');
      res.setHeader('Content-Disposition', `inline; filename="${track.title}.mp3"`);
      
      const stat = await fs.stat(filePath);
      res.setHeader('Content-Length', stat.size);
      
      const fileStream = fs.createReadStream(filePath);
      fileStream.pipe(res);
    } catch (error: any) {
      console.error('Error streaming audio:', error);
      res.status(500).json({ message: 'Error streaming audio', error: error.message });
    }
  });
  
  // Download audio file
  app.get('/api/audio/:trackId/download', async (req: Request, res: Response) => {
    try {
      const { trackId } = req.params;
      
      const track = await storage.getAudioTrack(trackId);
      
      if (!track) {
        return res.status(404).json({ message: 'Audio track not found' });
      }
      
      // Get the file path
      const filePath = track.filePath;
      
      // Check if file exists
      const fileExists = await storage.fileExists(filePath);
      
      if (!fileExists) {
        return res.status(404).json({ message: 'Audio file not found' });
      }
      
      // Set content type and disposition for download
      res.setHeader('Content-Type', 'audio/mpeg');
      res.setHeader('Content-Disposition', `attachment; filename="${track.title}.mp3"`);
      
      const fileStream = fs.createReadStream(filePath);
      fileStream.pipe(res);
    } catch (error: any) {
      console.error('Error downloading audio:', error);
      res.status(500).json({ message: 'Error downloading audio', error: error.message });
    }
  });
  
  // Transpose audio to a different key
  app.post('/api/audio/:trackId/transpose', async (req: Request, res: Response) => {
    try {
      const { trackId } = req.params;
      
      // Validate request
      const validation = transposeRequestSchema.safeParse(req.body);
      if (!validation.success) {
        return res.status(400).json({ message: 'Invalid transpose request', errors: validation.error.format() });
      }
      
      const { targetKey, targetScale } = req.body;
      
      const track = await storage.getAudioTrack(trackId);
      
      if (!track) {
        return res.status(404).json({ message: 'Audio track not found' });
      }
      
      // Update processing status
      await storage.updateProcessingStatus(trackId, {
        status: 'transposing',
        progress: 0
      });
      
      // Calculate semitones difference
      const semitones = calculateSemitones(
        track.originalKey,
        targetKey,
        track.originalScale as 'major' | 'minor',
        targetScale
      );
      
      // Check if we already have this transposition
      const transposedPaths = track.transposedPaths as Record<string, string> || {};
      const cacheKey = `${targetKey}_${targetScale}`;
      
      let transposedFilePath: string;
      
      if (transposedPaths[cacheKey] && await storage.fileExists(transposedPaths[cacheKey])) {
        // Use cached version
        transposedFilePath = transposedPaths[cacheKey];
        
        // Update status to complete
        await storage.updateProcessingStatus(trackId, {
          status: 'complete',
          progress: 100
        });
      } else {
        // Perform transposition
        transposedFilePath = await transposeAudio(
          trackId,
          track.filePath,
          semitones,
          async (progress) => {
            await storage.updateProcessingStatus(trackId, {
              progress
            });
          }
        );
        
        // Update transposed paths cache
        transposedPaths[cacheKey] = transposedFilePath;
      }
      
      // Update the track with new key/scale and file path
      const updatedTrack = await storage.updateAudioTrack(trackId, {
        currentKey: targetKey,
        currentScale: targetScale,
        filePath: transposedFilePath,
        transposedPaths: transposedPaths
      });
      
      // Update status to complete
      await storage.updateProcessingStatus(trackId, {
        status: 'complete',
        progress: 100
      });
      
      // Return updated track info
      res.status(200).json({
        trackId,
        currentKey: targetKey,
        currentScale: targetScale,
        url: `/api/audio/${trackId}/stream`
      });
    } catch (error: any) {
      console.error('Error transposing audio:', error);
      res.status(500).json({ message: 'Error transposing audio', error: error.message });
    }
  });
  
  return httpServer;
}

// Background processing function
async function processYouTubeVideo(trackId: string, videoUrl: string): Promise<void> {
  try {
    // Download from YouTube
    const { filePath, videoId, title, artist, duration } = await downloadYouTubeAudio(
      trackId,
      videoUrl,
      async (progress) => {
        await storage.updateProcessingStatus(trackId, {
          status: 'downloading',
          progress: progress / 2 // First half of the progress is download
        });
      }
    );
    
    // Update status to processing
    await storage.updateProcessingStatus(trackId, {
      status: 'processing',
      progress: 50
    });
    
    // Extract instrumental
    const instrumentalFilePath = await extractInstrumental(
      trackId,
      filePath,
      async (progress) => {
        await storage.updateProcessingStatus(trackId, {
          status: 'processing',
          progress: 50 + progress / 2 // Second half is processing
        });
      }
    );
    
    // Generate waveform data
    const waveformData = await generateWaveformData(instrumentalFilePath);
    
    // Create audio track in storage
    await storage.createAudioTrack({
      trackId,
      title,
      artist,
      videoId,
      originalKey: 'C', // Default key
      originalScale: 'major', // Default scale
      currentKey: 'C',
      currentScale: 'major',
      duration,
      filePath: instrumentalFilePath,
      waveformData: JSON.stringify(waveformData)
    });
    
    // Update status to complete
    await storage.updateProcessingStatus(trackId, {
      status: 'complete',
      progress: 100
    });
  } catch (error: any) {
    console.error('Error processing YouTube video:', error);
    
    // Update status to error
    await storage.updateProcessingStatus(trackId, {
      status: 'error',
      error: error.message || 'Unknown error occurred during processing'
    });
    
    throw error;
  }
}
