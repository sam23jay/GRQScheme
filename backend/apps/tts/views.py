from rest_framework.views import APIView
from rest_framework.response import Response
from rest_framework import status
from django.conf import settings
import uuid
import os

from .services import TTSService

class SpeakerListView(APIView):
    def get(self, request):
        try:
            service = TTSService()
            speakers = service.get_speakers()
            # Optional: Filter for English voices only or specific locales if list is too long
            # speakers is a list of strings
            return Response({"speakers": speakers}, status=status.HTTP_200_OK)
        except Exception as e:
             return Response({"error": str(e)}, status=status.HTTP_500_INTERNAL_SERVER_ERROR)

class GenerateSpeechView(APIView):
    def post(self, request):
        text = request.data.get('text')
        speaker_id = request.data.get('speaker_id')
        
        if not text:
            return Response({"error": "Text is required"}, status=status.HTTP_400_BAD_REQUEST)
        
        if not speaker_id:
            # Default to a known English voice if none provided
            speaker_id = "en-US-ChristopherNeural" 
        
        try:
            service = TTSService()
            output_filename = f"{uuid.uuid4()}.mp3" # edge-tts produces mp3 by default usually
            
            relative_path = service.generate_speech(text, speaker_id, output_filename)
            
            media_url = settings.MEDIA_URL + 'tts/' + output_filename
            return Response({"audio_url": media_url}, status=status.HTTP_200_OK)
            
        except Exception as e:
            return Response({"error": str(e)}, status=status.HTTP_500_INTERNAL_SERVER_ERROR)
