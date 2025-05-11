#!/usr/bin/env python3
import sys
import os
import subprocess
import json
import re
import platform
import time

def extract_video_id(url):
    """Extract YouTube video ID from URL"""
    pattern = r'(?:https?:\/\/)?(?:www\.)?(?:youtube\.com\/(?:watch\?v=|embed\/|v\/)|youtu\.be\/)([a-zA-Z0-9_-]{11})(?:\S+)?'
    match = re.search(pattern, url)
    return match.group(1) if match else None

def get_video_info(video_id):
    """Get video title and channel name"""
    try:
        print(f"Getting video info for {video_id}", file=sys.stderr)
        cmd = [
            'yt-dlp',
            '--print', 'title,channel',
            '--skip-download',
            f'https://www.youtube.com/watch?v={video_id}'
        ]
        print(f"Running command: {' '.join(cmd)}", file=sys.stderr)
        
        # 여러 번 시도
        max_attempts = 3
        for attempt in range(max_attempts):
            try:
                result = subprocess.run(cmd, capture_output=True, text=True, check=True, timeout=30)
                lines = result.stdout.strip().split('\n')
                title = lines[0] if lines and len(lines) > 0 else 'Unknown Title'
                artist = lines[1] if lines and len(lines) > 1 else 'Unknown Artist'
                print(f"Video info - Title: {title}, Artist: {artist}", file=sys.stderr)
                return title, artist
            except subprocess.TimeoutExpired:
                print(f"Timeout getting video info (attempt {attempt+1}/{max_attempts})", file=sys.stderr)
                if attempt == max_attempts - 1:
                    raise
            except Exception as e:
                print(f"Error getting video info (attempt {attempt+1}/{max_attempts}): {e}", file=sys.stderr)
                if attempt == max_attempts - 1:
                    raise
                time.sleep(1)  # 약간 대기 후 재시도
    except subprocess.CalledProcessError as e:
        print(f"Error getting video info: {e}", file=sys.stderr)
        print(f"Error output: {e.stderr}", file=sys.stderr)
        return 'Unknown Title', 'Unknown Artist'

def download_audio(video_id, output_file):
    """Download audio from YouTube video"""
    try:
        print(f"Downloading audio for {video_id} to {output_file}", file=sys.stderr)
        print(f"Current working directory: {os.getcwd()}", file=sys.stderr)
        print(f"Python version: {sys.version}", file=sys.stderr)
        print(f"Platform: {platform.platform()}", file=sys.stderr)
        
        # Windows에서 따옴표 처리 문제 방지를 위해 직접 경로 처리
        output_pattern = output_file.replace('\\', '/')
        
        cmd = [
            'yt-dlp',
            '-x',
            '--audio-format', 'mp3',
            '--audio-quality', '0',
            '--no-playlist',
            '--extract-audio',
            '--windows-filenames',  # Windows 호환 파일명 사용
            '--restrict-filenames',  # 특수문자 제한
            '--retries', '3',        # 재시도 횟수
            '--fragment-retries', '3',  # 조각 다운로드 재시도
            '--force-overwrites',     # 기존 파일 덮어쓰기
            '-o', output_pattern,
            f'https://www.youtube.com/watch?v={video_id}'
        ]
        
        print(f"Running command: {' '.join(cmd)}", file=sys.stderr)
        
        # 최대 시도 횟수
        max_attempts = 3
        for attempt in range(max_attempts):
            try:
                # 직접 프로세스 실행 및 출력 수집
                process = subprocess.Popen(
                    cmd, 
                    stdout=subprocess.PIPE, 
                    stderr=subprocess.PIPE, 
                    text=True,
                    universal_newlines=True
                )
                
                # 60초 타임아웃으로 실행
                try:
                    stdout, stderr = process.communicate(timeout=120)
                except subprocess.TimeoutExpired:
                    process.kill()
                    print(f"Download timed out (attempt {attempt+1}/{max_attempts})", file=sys.stderr)
                    if attempt == max_attempts - 1:
                        return {
                            'success': False,
                            'error': f'Download timed out after {max_attempts} attempts'
                        }
                    time.sleep(2)  # 약간 대기 후 재시도
                    continue
                
                print(f"Download command stdout: {stdout}", file=sys.stderr)
                print(f"Download command stderr: {stderr}", file=sys.stderr)
                
                # 프로세스가 정상적으로 종료되지 않았으면 오류 처리
                if process.returncode != 0:
                    print(f"yt-dlp process failed with return code {process.returncode} (attempt {attempt+1}/{max_attempts})", file=sys.stderr)
                    if attempt == max_attempts - 1:
                        return {
                            'success': False,
                            'error': f'yt-dlp failed with code {process.returncode}: {stderr}'
                        }
                    time.sleep(2)  # 약간 대기 후 재시도
                    continue
                
                # 강제로 1초 대기하여 파일 시스템 갱신 대기
                time.sleep(1)
                
                # Try to extract duration from output
                duration = 0
                for line in stdout.strip().split('\n'):
                    if line.strip().isdigit() or (line.strip().replace('.', '', 1).isdigit() and line.strip().count('.') <= 1):
                        try:
                            duration = float(line.strip())
                            break
                        except ValueError:
                            pass
                
                # Verify the file exists
                if not os.path.exists(output_file):
                    print(f"ERROR: Output file not found after download: {output_file} (attempt {attempt+1}/{max_attempts})", file=sys.stderr)
                    if attempt == max_attempts - 1:
                        return {
                            'success': False, 
                            'error': f'Output file not found after download: {output_file}'
                        }
                    time.sleep(2)  # 약간 대기 후 재시도
                    continue
                
                file_size = os.path.getsize(output_file)
                print(f"Downloaded file exists with size: {file_size} bytes", file=sys.stderr)
                
                if file_size == 0:
                    print(f"ERROR: Output file exists but has zero size: {output_file} (attempt {attempt+1}/{max_attempts})", file=sys.stderr)
                    if attempt == max_attempts - 1:
                        return {
                            'success': False,
                            'error': f'Output file has zero size: {output_file}'
                        }
                    # 파일 삭제 후 재시도
                    try:
                        os.remove(output_file)
                    except Exception as e:
                        print(f"Failed to remove zero-size file: {e}", file=sys.stderr)
                    time.sleep(2)
                    continue
                
                # 성공!
                return {
                    'success': True,
                    'filepath': output_file,
                    'duration': duration
                }
                
            except Exception as e:
                print(f"Error during download (attempt {attempt+1}/{max_attempts}): {e}", file=sys.stderr)
                import traceback
                traceback.print_exc(file=sys.stderr)
                if attempt == max_attempts - 1:
                    return {
                        'success': False,
                        'error': str(e)
                    }
                time.sleep(2)  # 약간 대기 후 재시도
                
        # 모든 시도 실패
        return {
            'success': False,
            'error': 'Failed after all retry attempts'
        }
        
    except Exception as e:
        print(f"Unexpected error downloading audio: {e}", file=sys.stderr)
        import traceback
        traceback.print_exc(file=sys.stderr)
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
    
    print(f"Processing YouTube URL: {url}", file=sys.stderr)
    print(f"Output directory: {output_dir}", file=sys.stderr)
    
    # Create output directory if it doesn't exist
    os.makedirs(output_dir, exist_ok=True)
    
    # Extract video ID
    video_id = extract_video_id(url)
    if not video_id:
        print(f"Failed to extract video ID from URL: {url}", file=sys.stderr)
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