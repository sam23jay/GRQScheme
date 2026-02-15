import os
import asyncio
import edge_tts
from django.conf import settings

class TTSService:
    _instance = None
    
    def __new__(cls):
        if cls._instance is None:
            cls._instance = super(TTSService, cls).__new__(cls)
        return cls._instance

    async def _get_voices_async(self):
        voices = await edge_tts.list_voices()
        # Filter for English or specific high quality voices, or return all?
        # Let's return a simplified list of IDs
        return [v['ShortName'] for v in voices]

    def get_speakers(self):
        """Return a list of available speakers (voices)."""
        # Run async in sync
        try:
             # Create new loop if needed, or use asyncio.run
             return asyncio.run(self._get_voices_async())
        except RuntimeError:
             # If loop already running (e.g. maybe in some wsgi contexts?), handle carefully
             # But for standard Django runserver/wsgi, asyncio.run usually works if not nested.
             loop = asyncio.new_event_loop()
             asyncio.set_event_loop(loop)
             return loop.run_until_complete(self._get_voices_async())

    async def _generate_speech_async(self, text, voice, output_path):
        communicate = edge_tts.Communicate(text, voice)
        await communicate.save(output_path)

    def generate_speech(self, text, speaker_id, output_filename):
        """
        Generate speech from text and save to file.
        Returns the relative path to the generated file.
        """
        # Ensure media directory exists
        output_dir = os.path.join(settings.MEDIA_ROOT, 'tts')
        os.makedirs(output_dir, exist_ok=True)
        
        file_path = os.path.join(output_dir, output_filename)
        
        # Run async generation
        try:
            asyncio.run(self._generate_speech_async(text, speaker_id, file_path))
        except RuntimeError:
             loop = asyncio.new_event_loop()
             asyncio.set_event_loop(loop)
             loop.run_until_complete(self._generate_speech_async(text, speaker_id, file_path))
        
        return os.path.relpath(file_path, settings.MEDIA_ROOT)
