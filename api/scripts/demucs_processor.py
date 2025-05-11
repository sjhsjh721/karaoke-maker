import argparse
import os
import sys
import subprocess
import json
import shutil

def run_demucs(input_file, output_dir_base):
    try:
        # Demucs will create its own subdirectory based on the model name
        # e.g., output_dir_base/htdemucs_ft/input_filename_no_ext/
        # We want the final instrumental.mp3 to be in output_dir_base
        
        model_name = "htdemucs_ft" # You can change this to other models like mdx_extra if preferred

        # Ensure input_file path is absolute or correctly relative to CWD for subprocess
        abs_input_file = os.path.abspath(input_file)
        abs_output_dir_base = os.path.abspath(output_dir_base)

        if not os.path.exists(abs_input_file):
            print(f"ERROR: Input file not found at {abs_input_file}", file=sys.stderr)
            return {'success': False, 'error': f"Demucs processor: Input file not found at {abs_input_file}"}

        os.makedirs(abs_output_dir_base, exist_ok=True)

        cmd = [
            sys.executable, '-m', 'demucs.separate',
            '-n', model_name,
            '-d', 'cpu', # Use 'cuda' if GPU is available and configured
            '-o', abs_output_dir_base, # Base output directory for Demucs model-named subfolder
            abs_input_file
        ]
        
        print(f"Running Demucs command: {' '.join(cmd)}", file=sys.stderr)
        
        process = subprocess.Popen(cmd, stdout=subprocess.PIPE, stderr=subprocess.PIPE, text=True, encoding='utf-8')
        stdout, stderr = process.communicate() # Wait for completion
        
        if process.returncode != 0:
            print(f"Demucs failed with code {process.returncode}", file=sys.stderr)
            print(f"Demucs stdout: {stdout}", file=sys.stderr)
            print(f"Demucs stderr: {stderr}", file=sys.stderr)
            return {'success': False, 'error': f"Demucs execution failed. Stderr: {stderr}"}

        input_filename_no_ext = os.path.splitext(os.path.basename(abs_input_file))[0]
        # Path where demucs saves the stems (e.g. .tmp/trackId/htdemucs_ft/original/no_vocals.wav)
        demucs_stems_output_dir = os.path.join(abs_output_dir_base, model_name, input_filename_no_ext)
        
        accompaniment_file_wav = os.path.join(demucs_stems_output_dir, 'no_vocals.wav')
        # Final MP3 will be in abs_output_dir_base (e.g. .tmp/trackId/instrumental.mp3)
        instrumental_file_mp3 = os.path.join(abs_output_dir_base, 'instrumental.mp3')

        if not os.path.exists(accompaniment_file_wav):
            print(f"ERROR: Demucs output no_vocals.wav not found at {accompaniment_file_wav}", file=sys.stderr)
            # Try to list contents of the expected output directory for debugging
            if os.path.exists(demucs_stems_output_dir):
                 print(f"Contents of {demucs_stems_output_dir}: {os.listdir(demucs_stems_output_dir)}", file=sys.stderr)
            else:
                 print(f"Demucs stems output directory {demucs_stems_output_dir} does not exist.", file=sys.stderr)
            return {'success': False, 'error': f'Demucs processing did not produce no_vocals.wav. Expected at: {accompaniment_file_wav}'}

        # Convert accompaniment.wav to mp3 using ffmpeg
        ffmpeg_cmd = [
            'ffmpeg', '-y', # Overwrite output files without asking
            '-i', accompaniment_file_wav,
            '-b:a', '320k', # High quality bitrate for MP3
            instrumental_file_mp3
        ]
        print(f"Running FFmpeg for conversion: {' '.join(ffmpeg_cmd)}", file=sys.stderr)
        ffmpeg_process = subprocess.Popen(ffmpeg_cmd, stdout=subprocess.PIPE, stderr=subprocess.PIPE, text=True, encoding='utf-8')
        ffmpeg_stdout, ffmpeg_stderr = ffmpeg_process.communicate()

        if ffmpeg_process.returncode != 0:
            print(f"FFmpeg conversion failed. Stderr: {ffmpeg_stderr}", file=sys.stderr)
            return {'success': False, 'error': f"FFmpeg conversion failed: {ffmpeg_stderr}"}
        
        # Clean up the subdirectory created by Demucs
        if os.path.exists(demucs_stems_output_dir):
            try:
                # Remove specific wav files first
                vocals_wav = os.path.join(demucs_stems_output_dir, 'vocals.wav')
                if os.path.exists(vocals_wav):
                    os.remove(vocals_wav)
                if os.path.exists(accompaniment_file_wav): # no_vocals.wav
                    os.remove(accompaniment_file_wav)
                
                # Try to remove the now potentially empty directories
                os.rmdir(demucs_stems_output_dir)
                # Also try to remove the parent model_name directory if it's empty
                # This might fail if other files/folders are present, which is fine.
                parent_model_dir = os.path.join(abs_output_dir_base, model_name)
                if not os.listdir(parent_model_dir): # Check if empty
                    os.rmdir(parent_model_dir)

                print(f"Cleaned up Demucs output subdirectory: {demucs_stems_output_dir}", file=sys.stderr)
            except OSError as e:
                print(f"Warning: Could not fully clean up Demucs directories: {e}", file=sys.stderr)


        print(f"Successfully created instrumental MP3: {instrumental_file_mp3}", file=sys.stderr)
        return {'success': True, 'filepath': instrumental_file_mp3}

    except Exception as e:
        print(f"Error in Demucs processing script: {str(e)}", file=sys.stderr)
        import traceback
        traceback.print_exc(file=sys.stderr)
        return {'success': False, 'error': str(e)}

if __name__ == '__main__':
    parser = argparse.ArgumentParser(description='Process audio with Demucs to extract instrumental.')
    parser.add_argument('input_file', type=str, help='Input audio file path.')
    parser.add_argument('output_dir', type=str, help='Base directory to save the processed instrumental.mp3 file and for Demucs to use for its stems.')
    
    args = parser.parse_args()
    
    result = run_demucs(args.input_file, args.output_dir)
    
    # Ensure result is always a valid JSON string, even if empty or error
    if not isinstance(result, dict):
        result = {'success': False, 'error': 'Invalid result from run_demucs function'}
    
    try:
        sys.stdout.write(json.dumps(result)) # Use sys.stdout.write for cleaner output
    except Exception as e:
        # Fallback if result cannot be JSON serialized
        sys.stdout.write(json.dumps({'success': False, 'error': f'Failed to serialize result to JSON: {str(e)}', 'original_result': str(result)}))
