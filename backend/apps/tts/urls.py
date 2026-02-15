from django.urls import path
from .views import SpeakerListView, GenerateSpeechView

urlpatterns = [
    path('speakers/', SpeakerListView.as_view(), name='tts-speakers'),
    path('generate/', GenerateSpeechView.as_view(), name='tts-generate'),
]
