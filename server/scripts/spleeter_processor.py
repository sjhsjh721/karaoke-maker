import argparse
import os
import sys
import subprocess
import json
import shutil

def run_spleeter(input_file, output_dir):
    try:
        # Ensure output directory exists
        os.makedirs(output_dir, exist_ok=True)
        
        # Spleeter command: separate to 2 stems (vocals, accompaniment)
        # The output will be in a subdirectory named after the input file within output_dir
        cmd = [
            'spleeter', 'separate',
            '-p', 'spleeter:2stems', # Pre-trained 2 stems model
            '-o', output_dir,
            input_file
        ]
        
        print(f"Running Spleeter command: {' '.join(cmd)}", file=sys.stderr)
        
        process = subprocess.Popen(cmd, stdout=subprocess.PIPE, stderr=subprocess.PIPE, text=True)
        stdout, stderr = process.communicate()
        
        if process.returncode != 0:
            print(f"Spleeter failed with code {process.returncode}", file=sys.stderr)
            print(f"Spleeter stdout: {stdout}", file=sys.stderr)
            print(f"Spleeter stderr: {stderr}", file=sys.stderr)
            return {'success': False, 'error': f"Spleeter failed: {stderr}"}

        # Find the accompaniment file (MR)
        # Spleeter creates a folder named after the input file (without extension)
        input_filename_no_ext = os.path.splitext(os.path.basename(input_file))[0]
        spleeter_output_subdir = os.path.join(output_dir, input_filename_no_ext)
        
        accompaniment_file_wav = os.path.join(spleeter_output_subdir, 'accompaniment.wav')
        # Convert accompaniment.wav to mp3
        accompaniment_file_mp3 = os.path.join(output_dir, 'instrumental.mp3') # Save directly in output_dir

        if not os.path.exists(accompaniment_file_wav):
            print(f"ERROR: Spleeter output accompaniment.wav not found at {accompaniment_file_wav}", file=sys.stderr)
            # Try to list files in spleeter_output_subdir for debugging
            if os.path.exists(spleeter_output_subdir):
                 print(f"Contents of {spleeter_output_subdir}: {os.listdir(spleeter_output_subdir)}", file=sys.stderr)
            else:
                 print(f"Spleeter output subdirectory {spleeter_output_subdir} does not exist.", file=sys.stderr)
            return {'success': False, 'error': 'Spleeter processing did not produce accompaniment.wav'}


        ffmpeg_cmd = [
            'ffmpeg', '-i', accompaniment_file_wav,
            '-ab', '320k', # Audio bitrate
            accompaniment_file_mp3
        ]
        print(f"Running FFmpeg for conversion: {' '.join(ffmpeg_cmd)}", file=sys.stderr)
        ffmpeg_process = subprocess.Popen(ffmpeg_cmd, stdout=subprocess.PIPE, stderr=subprocess.PIPE, text=True)
        ffmpeg_stdout, ffmpeg_stderr = ffmpeg_process.communicate()

        if ffmpeg_process.returncode != 0:
            print(f"FFmpeg conversion failed: {ffmpeg_stderr}", file=sys.stderr)
            return {'success': False, 'error': f"FFmpeg conversion failed: {ffmpeg_stderr}"}
        
        # Clean up the subdirectory created by Spleeter if needed, but keep the mp3
        if os.path.exists(spleeter_output_subdir):
            shutil.rmtree(spleeter_output_subdir)
            print(f"Cleaned up Spleeter output subdirectory: {spleeter_output_subdir}", file=sys.stderr)
            
        print(f"Successfully created instrumental MP3: {accompaniment_file_mp3}", file=sys.stderr)
        return {'success': True, 'filepath': accompaniment_file_mp3}

    except Exception as e:
        print(f"Error in Spleeter processing: {str(e)}", file=sys.stderr)
        return {'success': False, 'error': str(e)}

if __name__ == '__main__':
    parser = argparse.ArgumentParser(description='Process audio with Spleeter to extract instrumental.')
    parser.add_argument('input_file', type=str, help='Input audio file path.')
    parser.add_argument('output_dir', type=str, help='Directory to save the processed instrumental.mp3 file.')
    
    args = parser.parse_args()
    
    result = run_spleeter(args.input_file, args.output_dir)
    print(json.dumps(result)) # Output result as JSON string to stdout
