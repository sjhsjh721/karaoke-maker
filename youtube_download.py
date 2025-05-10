#!/usr/bin/env python3
import sys
import os
import subprocess
import json
import re

def extract_video_id(url):
    """Extract YouTube video ID from URL"""
    pattern = r'(?:https?:\/\/)?(?:www\.)?(?:youtube\.com\/(?:watch\?v=|embed\/|v\/)|youtu\.be\/)([a-zA-Z0-9_-]{11})(?:\S+)?'
    match = re.search(pattern, url)
    return match.group(1) if match else None

def get_video_info(video_id):
    """Get video title and channel name"""
    try:
        cmd = [
            'yt-dlp',
            '--print', 'title,channel',
            '--skip-download',
            f'https://www.youtube.com/watch?v={video_id}'
        ]
        result = subprocess.run(cmd, capture_output=True, text=True, check=True)
        lines = result.stdout.strip().split('\n')
        title = lines[0] if lines and len(lines) > 0 else 'Unknown Title'
        artist = lines[1] if lines and len(lines) > 1 else 'Unknown Artist'
        return title, artist
    except subprocess.CalledProcessError as e:
        print(f"Error getting video info: {e}", file=sys.stderr)
        return 'Unknown Title', 'Unknown Artist'

def download_audio(video_id, output_file):
    """Download audio from YouTube video"""
    try:
        cmd = [
            'yt-dlp',
            '-x',
            '--audio-format', 'mp3',
            '--audio-quality', '0',
            '-o', output_file,
            '--print', 'duration',
            f'https://www.youtube.com/watch?v={video_id}'
        ]
        result = subprocess.run(cmd, capture_output=True, text=True, check=True)
        
        # Try to extract duration
        duration = 0
        for line in result.stdout.strip().split('\n'):
            if line.strip().isdigit() or (line.strip().replace('.', '', 1).isdigit() and line.strip().count('.') <= 1):
                duration = float(line.strip())
                break
        
        return {
            'success': True,
            'filepath': output_file,
            'duration': duration
        }
    except subprocess.CalledProcessError as e:
        print(f"Error downloading audio: {e}", file=sys.stderr)
        print(f"Error output: {e.stderr}", file=sys.stderr)
        return {
            'success': False,
            'error': str(e)
        }

def main():
    if len(sys.argv) < 3:
        print("Usage: python youtube_download.py <youtube_url> <output_directory>", file=sys.stderr)
        sys.exit(1)
    
    url = sys.argv[1]
    output_dir = sys.argv[2]
    
    # Create output directory if it doesn't exist
    os.makedirs(output_dir, exist_ok=True)
    
    # Extract video ID
    video_id = extract_video_id(url)
    if not video_id:
        print(json.dumps({
            'success': False,
            'error': 'Invalid YouTube URL'
        }))
        sys.exit(1)
    
    # Get video info
    title, artist = get_video_info(video_id)
    
    # Download audio
    output_file = os.path.join(output_dir, 'original.mp3')
    result = download_audio(video_id, output_file)
    
    if result['success']:
        print(json.dumps({
            'success': True,
            'videoId': video_id,
            'title': title,
            'artist': artist,
            'filepath': output_file,
            'duration': result['duration']
        }))
    else:
        print(json.dumps({
            'success': False,
            'error': result.get('error', 'Unknown error')
        }))

if __name__ == "__main__":
    main()