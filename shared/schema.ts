import { pgTable, text, serial, integer, boolean, timestamp, jsonb } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";

// Audio tracks table
export const audioTracks = pgTable("audio_tracks", {
  id: serial("id").primaryKey(),
  trackId: text("track_id").notNull().unique(),
  title: text("title").notNull(),
  artist: text("artist").default("Unknown"),
  videoId: text("video_id").notNull(),
  originalKey: text("original_key").default("C"),
  originalScale: text("original_scale").default("major"),
  currentKey: text("current_key").default("C"),
  currentScale: text("current_scale").default("major"),
  duration: integer("duration").default(0),
  filePath: text("file_path").notNull(),
  transposedPaths: jsonb("transposed_paths").default({}),
  waveformData: text("waveform_data").default(""),
  createdAt: timestamp("created_at").defaultNow(),
});

// Processing status table
export const processingStatus = pgTable("processing_status", {
  id: serial("id").primaryKey(),
  trackId: text("track_id").notNull().unique(),
  status: text("status").notNull().default("idle"),
  progress: integer("progress").default(0),
  error: text("error"),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

// Define insert schemas
export const insertAudioTrackSchema = createInsertSchema(audioTracks).pick({
  trackId: true,
  title: true,
  artist: true,
  videoId: true,
  originalKey: true,
  originalScale: true,
  currentKey: true,
  currentScale: true,
  duration: true,
  filePath: true,
});

export const insertProcessingStatusSchema = createInsertSchema(processingStatus).pick({
  trackId: true,
  status: true,
  progress: true,
  error: true,
});

// Define types
export type InsertAudioTrack = z.infer<typeof insertAudioTrackSchema>;
export type AudioTrack = typeof audioTracks.$inferSelect;

export type InsertProcessingStatus = z.infer<typeof insertProcessingStatusSchema>;
export type ProcessingStatus = typeof processingStatus.$inferSelect;

// Additional validation schemas
export const youtubeUrlSchema = z.object({
  url: z.string().url().refine(url => {
    return url.includes('youtube.com/watch') || url.includes('youtu.be/');
  }, {
    message: "Must be a valid YouTube URL"
  })
});

export const transposeRequestSchema = z.object({
  targetKey: z.string().min(1).max(2),
  targetScale: z.enum(["major", "minor"]),
});
