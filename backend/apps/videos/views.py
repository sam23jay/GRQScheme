from rest_framework import viewsets
from .models import Video
from .serializers import VideoSerializer
from .services import start_transcription

class VideoViewSet(viewsets.ModelViewSet):
    queryset = Video.objects.all().order_by('-created_at')
    serializer_class = VideoSerializer

    def perform_create(self, serializer):
        video = serializer.save()
        start_transcription(video.id)
