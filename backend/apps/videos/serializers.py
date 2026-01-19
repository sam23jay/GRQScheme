from rest_framework import serializers
from .models import Video

class VideoSerializer(serializers.ModelSerializer):
    class Meta:
        model = Video
        fields = ['id', 'title', 'video_file', 'created_at', 'status', 'transcript', 'srt_content', 'processed_video_file', 'error_message']
        read_only_fields = ['id', 'created_at', 'status', 'transcript', 'srt_content', 'processed_video_file', 'error_message']
