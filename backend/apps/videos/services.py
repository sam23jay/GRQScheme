import os
import whisper
import torch
from django.conf import settings
from .models import Video
import imageio_ffmpeg
import threading

# Ensure ffmpeg is in path for whisper to use
ffmpeg_dir = os.path.join(settings.BASE_DIR, 'bin')
# Add to PATH (prepend to ensure priority)
os.environ["PATH"] = ffmpeg_dir + os.pathsep + os.environ["PATH"]

def generate_srt_content(segments):
    srt_content = ""
    for i, segment in enumerate(segments, start=1):
        start = format_timestamp(segment['start'])
        end = format_timestamp(segment['end'])
        text = segment['text'].strip()
        srt_content += f"{i}\n{start} --> {end}\n{text}\n\n"
    return srt_content

def format_timestamp(seconds):
    hours = int(seconds // 3600)
    minutes = int((seconds % 3600) // 60)
    secs = int(seconds % 60)
    millis = int((seconds - int(seconds)) * 1000)
    return f"{hours:02}:{minutes:02}:{secs:02},{millis:03}"

def transcribe_video_task(video_id):
    try:
        video = Video.objects.get(id=video_id)
        video.status = 'processing'
        video.save()
        
        file_path = video.video_file.path
        print(f"Starting transcription for {file_path} using device: {'cuda' if torch.cuda.is_available() else 'cpu'}")
        
        # Load model - 'small' as requested
        device = "cuda" if torch.cuda.is_available() else "cpu"
        model = whisper.load_model("small", device=device)
        
        # Transcribe
        result = model.transcribe(file_path, verbose=True, word_timestamps=True)
        
        # Resegment into short chunks (max 4 words)
        short_segments = resegment_by_words(result['segments'], max_words=4)
        
        video.transcript = result['text']
        video.srt_content = generate_srt_content(short_segments)
        
        # Save SRT to file for FFmpeg
        srt_path = os.path.splitext(file_path)[0] + '.srt'
        with open(srt_path, 'w', encoding='utf-8') as f:
            f.write(video.srt_content)
            
        # Burn captions
        processed_filename = f"processed_{os.path.basename(file_path)}"
        processed_path = os.path.join(os.path.dirname(file_path), processed_filename)
        
        if burn_captions(file_path, srt_path, processed_path):
            # Save relative path to DB
            video.processed_video_file.name = os.path.join('videos', processed_filename)
            
        video.status = 'completed'
        video.save()
        print(f"Transcription and burn-in completed for {video_id}")
        
    except Exception as e:
        print(f"Error transcribing video {video_id}: {e}")
        try:
            # Re-fetch in case it was modified
            video = Video.objects.get(id=video_id)
            video.status = 'failed'
            video.error_message = str(e)
            video.save()
        except Exception as db_err:
            print(f"Database error updating failure status: {db_err}")

def resegment_by_words(original_segments, max_words=4):
    all_words = []
    for segment in original_segments:
        if 'words' in segment:
            all_words.extend(segment['words'])
    
    new_segments = []
    current_chunk = []
    
    for word in all_words:
        current_chunk.append(word)
        if len(current_chunk) >= max_words:
            # Create segment
            start = current_chunk[0]['start']
            end = current_chunk[-1]['end']
            text = "".join([w['word'] for w in current_chunk])
            new_segments.append({'start': start, 'end': end, 'text': text})
            current_chunk = []
            
    # Remainder
    if current_chunk:
        start = current_chunk[0]['start']
        end = current_chunk[-1]['end']
        text = "".join([w['word'] for w in current_chunk])
        new_segments.append({'start': start, 'end': end, 'text': text})
        
    return new_segments

def burn_captions(video_path, srt_path, output_path):
    import subprocess
    
    # Escape path for FFmpeg filter
    srt_path_escaped = srt_path.replace('\\', '/').replace(':', '\\:')
    
    # 1. Scale and Crop to 9:16 (1080x1920)
    # scale=1080:1920:force_original_aspect_ratio=increase --> Ensure minimum coverage
    # crop=1080:1920 --> Cut to exact size (Center)
    video_filter = "scale=1080:1920:force_original_aspect_ratio=increase,crop=1080:1920"
    
    # 2. Burn Subtitles
    # FontName=Arial Black, FontSize=16, Alignment=10 (Middle Center)
    # PrimaryColour=&H00FFFF (Yellow)
    # BorderStyle=1 (Outline - No Box), Outline=1 (Black Outline)
    subtitle_filter = f"subtitles='{srt_path_escaped}':force_style='FontName=Arial Black,FontSize=16,PrimaryColour=&H00FFFF,OutlineColour=&H000000,BorderStyle=1,Outline=1,Shadow=0,MarginV=0,Alignment=10'"
    
    # Combine filters
    full_filter = f"{video_filter},{subtitle_filter}"
    
    command = [
        'ffmpeg', '-y',
        '-i', video_path,
        '-vf', full_filter,
        '-c:a', 'copy',
        '-c:v', 'libx264', # Ensure re-encoding for filter
        '-preset', 'fast',
        output_path
    ]
    
    print(f"Running FFmpeg: {' '.join(command)}")
    try:
        subprocess.run(command, check=True)
        return True
    except subprocess.CalledProcessError as e:
        print(f"FFmpeg failed: {e}")
        return False



def start_transcription(video_id):
    thread = threading.Thread(target=transcribe_video_task, args=(video_id,))
    thread.daemon = True 
    thread.start()
