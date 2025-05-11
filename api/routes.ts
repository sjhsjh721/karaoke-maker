import type { Express, Request, Response } from "express";
import { createServer, type Server } from "http";
import { storage } from "./storage";
import path from "path";
import { v4 as uuidv4 } from 'uuid';
import multer from 'multer';
import * as fsSync from 'fs';
import { extractVideoId, downloadYouTubeAudio } from './youtubeDownloader';
import { extractInstrumental, transposeAudio } from './audioProcessor';
import { youtubeUrlSchema } from '@shared/schema';

// Configure multer for file storage (although we'll use the storage interface)
const upload = multer({ storage: multer.memoryStorage() });

// 파일명을 안전하게 인코딩하는 함수 추가
function safeFilename(filename: string): string {
  // 특수 문자를 제거하고 영문/숫자만 유지
  const safeChars = filename.replace(/[^\w\s.-]/g, '');
  // 공백을 언더스코어로 변환
  return safeChars.replace(/\s+/g, '_');
}

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
      
      // 에러가 있으면 상태 코드 500 반환
      if (status.status === 'error' && status.error) {
        return res.status(500).json({
          status: status.status,
          progress: status.progress,
          error: status.error
        });
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

      // filePath는 현재 재생/트랜스포즈된 트랙을 가리키고,
      // originalFilePath는 YouTube에서 처음 다운로드된 원본을 가리킵니다.
      // instrumentalFilePath는 MR버전입니다.
      res.status(200).json({
        id: track.trackId,
        title: track.title,
        artist: track.artist,
        duration: track.duration,
        originalKey: track.originalKey,
        originalScale: track.originalScale,
        currentKey: track.currentKey,
        currentScale: track.currentScale,
        // 현재 활성화된 트랙 (피치 변경 등이 적용된)
        activeUrl: `/api/audio/${trackId}/stream`,
        // MR 버전 스트림 URL (instrumentalFilePath가 있다면)
        instrumentalUrl: (track as any).instrumentalFilePath ? `/api/audio/${trackId}/instrumental-stream` : undefined,
        // 원본 YouTube 다운로드 버전 스트림 URL (originalFilePath가 있다면)
        originalUrl: track.originalFilePath ? `/api/audio/${trackId}/original-stream` : undefined,
        createdAt: track.createdAt
      });
    } catch (error: any) {
      console.error('Error getting audio track:', error);
      res.status(500).json({ message: 'Error getting audio track', error: error.message });
    }
  });
  
  // Stream currently active audio file (could be original, instrumental, or transposed)
  app.get('/api/audio/:trackId/stream', async (req: Request, res: Response) => {
    try {
      const { trackId } = req.params;
      const track = await storage.getAudioTrack(trackId);
      if (!track || !track.filePath) { // filePath가 현재 활성 파일
        return res.status(404).json({ message: 'Active audio file not found' });
      }
      if (!(await storage.fileExists(track.filePath))) {
        return res.status(404).json({ message: 'Active audio file missing on server' });
      }
      res.setHeader('Content-Type', 'audio/mpeg');
      res.setHeader('Accept-Ranges', 'bytes');
      const fileStream = fsSync.createReadStream(track.filePath);
      fileStream.on('error', (err) => { console.error(`Stream error for active track ${trackId}:`, err); if (!res.headersSent) res.status(500).json({ message: 'Error streaming audio' }); });
      req.on('close', () => fileStream.destroy());
      fileStream.pipe(res);
    } catch (error: any) {
      console.error('Error streaming active audio:', error);
      if (!res.headersSent) res.status(500).json({ message: 'Error streaming audio', error: error.message });
    }
  });

  // Stream instrumental audio file
  app.get('/api/audio/:trackId/instrumental-stream', async (req: Request, res: Response) => {
    try {
      const { trackId } = req.params;
      const track = await storage.getAudioTrack(trackId);
      if (!track || !(track as any).instrumentalFilePath) {
        return res.status(404).json({ message: 'Instrumental audio file path not found' });
      }
      if (!(await storage.fileExists((track as any).instrumentalFilePath))) {
        return res.status(404).json({ message: 'Instrumental audio file missing on server' });
      }
      res.setHeader('Content-Type', 'audio/mpeg');
      res.setHeader('Accept-Ranges', 'bytes');
      const fileStream = fsSync.createReadStream((track as any).instrumentalFilePath);
      fileStream.on('error', (err) => { console.error(`Stream error for instrumental ${trackId}:`, err); if (!res.headersSent) res.status(500).json({ message: 'Error streaming instrumental' }); });
      req.on('close', () => fileStream.destroy());
      fileStream.pipe(res);
    } catch (error: any) {
      console.error('Error streaming instrumental audio:', error);
      if (!res.headersSent) res.status(500).json({ message: 'Error streaming instrumental', error: error.message });
    }
  });

  // Stream original downloaded audio file
  app.get('/api/audio/:trackId/original-stream', async (req: Request, res: Response) => {
    try {
      const { trackId } = req.params;
      const track = await storage.getAudioTrack(trackId);
      if (!track || !track.originalFilePath) {
        return res.status(404).json({ message: 'Original audio file path not found' });
      }
      if (!(await storage.fileExists(track.originalFilePath))) {
        return res.status(404).json({ message: 'Original audio file missing on server' });
      }
      res.setHeader('Content-Type', 'audio/mpeg');
      res.setHeader('Accept-Ranges', 'bytes');
      const fileStream = fsSync.createReadStream(track.originalFilePath);
      fileStream.on('error', (err) => { console.error(`Stream error for original ${trackId}:`, err); if (!res.headersSent) res.status(500).json({ message: 'Error streaming original' }); });
      req.on('close', () => fileStream.destroy());
      fileStream.pipe(res);
    } catch (error: any) {
      console.error('Error streaming original audio:', error);
      if (!res.headersSent) res.status(500).json({ message: 'Error streaming original', error: error.message });
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
      // 안전한 파일명 사용
      const safeTitle = safeFilename(track.title || 'audio');
      res.setHeader('Content-Disposition', `attachment; filename="${safeTitle}.mp3"`);
      
      const fileStream = fsSync.createReadStream(filePath);
      
      // 에러 핸들링 추가
      fileStream.on('error', (error) => {
        console.error(`Download error for trackId ${trackId}:`, error);
        if (!res.headersSent) {
          res.status(500).json({ message: 'Error downloading audio', error: error.message });
        }
      });
      
      // req에 abort 이벤트 리스너 추가
      req.on('close', () => {
        fileStream.destroy();
        console.log(`Client closed download connection for trackId ${trackId}`);
      });
      
      fileStream.pipe(res);
    } catch (error: any) {
      console.error('Error downloading audio:', error);
      if (!res.headersSent) {
        res.status(500).json({ message: 'Error downloading audio', error: error.message });
      }
    }
  });
  
  // Transpose audio to a different key
  app.post('/api/audio/:trackId/transpose', async (req: Request, res: Response) => {
    try {
      const { trackId } = req.params;
      const { semitones } = req.body;

      if (typeof semitones !== 'number') {
        return res.status(400).json({ message: 'Invalid semitones value' });
      }
      
      const track = await storage.getAudioTrack(trackId);
      
      if (!track) {
        return res.status(404).json({ message: 'Audio track not found' });
      }

      // 캐시 확인: 이미 해당 semitones로 변경된 파일이 있는지 확인
      const expectedTransposedPath = path.join(process.cwd(), '.tmp', trackId, `transposed_${semitones}.mp3`);
      const cachedFileExists = await storage.fileExists(expectedTransposedPath);

      let transposedFilePath: string;

      if (cachedFileExists) {
        console.log(`Using cached transposed file for trackId: ${trackId}, semitones: ${semitones}`);
        transposedFilePath = expectedTransposedPath;
        // 캐시된 파일을 사용하는 경우에도 processing status를 업데이트 할 수 있음 (선택적)
        await storage.updateProcessingStatus(trackId, {
          status: 'complete', // 이미 완료된 것으로 간주
          progress: 100
        });
      } else {
        console.log(`No cache found. Transposing original audio for trackId: ${trackId}, semitones: ${semitones}`);
        // Update processing status for new transposition
        await storage.updateProcessingStatus(trackId, {
          status: 'transposing',
          progress: 0
        });
  
        // 원본 파일 경로를 사용하여 transpose 실행
        // track.originalFilePath가 존재하고 유효한지 확인 필요
        if (!track.originalFilePath || !(await storage.fileExists(track.originalFilePath))) {
          console.error(`Original file path not found or invalid for trackId: ${trackId}`);
          return res.status(500).json({ message: 'Original audio file not found for transposition' });
        }

        transposedFilePath = await transposeAudio(
          trackId,
          track.originalFilePath, // 원본 파일 경로 사용
          semitones,
          async (progress: number) => {
            await storage.updateProcessingStatus(trackId, {
              progress
            });
          }
        );
        
        // 새로운 transpose 완료 후 상태 업데이트
        await storage.updateProcessingStatus(trackId, {
          status: 'complete',
          progress: 100
        });
      }
      
      // Update the track with the (potentially new) transposed file path
      // filePath를 현재 사용될 파일 경로로 업데이트
      await storage.updateAudioTrack(trackId, {
        filePath: transposedFilePath,
        // TODO: currentKey, currentScale도 업데이트 필요
      } as any); 
      
      // Fetch the updated track details to return the full object
      const updatedTrack = await storage.getAudioTrack(trackId);
      if (!updatedTrack) {
        // This case should ideally not happen if the update was successful
        console.error(`Failed to fetch updated track ${trackId} after transpose.`);
        return res.status(500).json({ message: 'Failed to retrieve track after transposition.' });
      }

      // 클라이언트가 기대하는 AudioTrack 형태로 응답
      res.status(200).json({
        id: updatedTrack.trackId, // Ensure this is 'id' and references the correct property from storage
        title: updatedTrack.title,
        artist: updatedTrack.artist,
        duration: updatedTrack.duration,
        originalKey: updatedTrack.originalKey,
        originalScale: updatedTrack.originalScale,
        currentKey: updatedTrack.currentKey, // TODO: This should reflect the transposition
        currentScale: updatedTrack.currentScale, // TODO: This should reflect the transposition
        activeUrl: `/api/audio/${updatedTrack.trackId}/stream`, // Use updatedTrack.trackId here
        instrumentalUrl: (updatedTrack as any).instrumentalFilePath ? `/api/audio/${updatedTrack.trackId}/instrumental-stream` : undefined,
        originalUrl: updatedTrack.originalFilePath ? `/api/audio/${updatedTrack.trackId}/original-stream` : undefined,
        url: `/api/audio/${updatedTrack.trackId}/stream`, // `url` 필드도 추가 (클라이언트에서 fallback으로 사용)
        createdAt: updatedTrack.createdAt
      });
    } catch (error: any) {
      console.error('Error transposing audio:', error);
      // 에러 발생 시 processing status 업데이트
      const { trackId } = req.params;
      if (trackId) {
        await storage.updateProcessingStatus(trackId, {
          status: 'error',
          progress: 0,
          error: error.message || 'Error during transposition'
        }).catch(statusError => console.error('Failed to update error status:', statusError));
      }
      res.status(500).json({ message: 'Error transposing audio', error: error.message });
    }
  });
  
  return httpServer;
}

// Background processing function
async function processYouTubeVideo(trackId: string, videoUrl: string): Promise<void> {
  try {
    // Step 1: Download audio from YouTube
    console.log(`Starting YouTube download for trackId: ${trackId}, url: ${videoUrl}`);
    // youtubeDownloader는 이제 .tmp/trackId/original.mp3 에 저장합니다.
    const { filePath: downloadedOriginalPath, videoId, title, artist, duration } = await downloadYouTubeAudio(
      trackId,
      videoUrl,
      async (progress: number) => {
        await storage.updateProcessingStatus(trackId, {
          status: 'downloading',
          progress: progress / 2  // 0-50%
        });
      }
    );
    console.log(`YouTube download completed. Original file at: ${downloadedOriginalPath}`);

    // Step 2: Extract instrumental track using Demucs via Python - 이 부분을 제거하거나 주석 처리
    /*
    console.log(`Starting instrumental extraction for trackId: ${trackId} from ${downloadedOriginalPath}`);
    const instrumentalFilePath = await extractInstrumental(
      trackId,
      downloadedOriginalPath, 
      async (progress: number) => {
        await storage.updateProcessingStatus(trackId, {
          status: 'processing', 
          progress: 50 + progress / 2  
        });
      }
    );
    console.log(`Instrumental extraction completed. Instrumental file at: ${instrumentalFilePath}`);
    */

    // Create audio track in storage
    console.log(`Creating audio track in storage for trackId: ${trackId}`);
    await storage.createAudioTrack({
      trackId,
      title,
      artist,
      videoId,
      originalKey: 'C', // TODO: Implement key detection if needed
      originalScale: 'major', // TODO: Implement scale detection
      currentKey: 'C',
      currentScale: 'major',
      duration,
      filePath: downloadedOriginalPath, // 이제 filePath는 원본 파일을 가리킴
      originalFilePath: downloadedOriginalPath,
      instrumentalFilePath: null, // 또는 undefined. 클라이언트에서 생성하므로 서버에는 MR 파일 경로 없음
      createdAt: new Date().toISOString(),
    } as any);

    // Update status to complete
    console.log(`Processing (download only) completed successfully for trackId: ${trackId}`);
    await storage.updateProcessingStatus(trackId, {
      status: 'complete', // 서버 작업은 다운로드로 완료
      progress: 100 
    });
  } catch (error: any) {
    console.error(`Error processing YouTube video for trackId: ${trackId}:`, error);
    let errorMessage = error.message || 'Unknown error occurred during processing';
    if (error.stack) {
      console.error(`Error stack for trackId ${trackId}:`, error.stack);
    }
    await storage.updateProcessingStatus(trackId, {
      status: 'error',
      error: errorMessage
    });
  }
}