import { useState, useRef, useEffect } from 'react'
import axios from 'axios'
import TTSGenerator from './components/TTSGenerator'
import './App.css'

const API_BASE = 'http://127.0.0.1:8000/api'

function App() {
  const [file, setFile] = useState(null)
  const [videoData, setVideoData] = useState(null)
  const [uploading, setUploading] = useState(false)
  const [error, setError] = useState(null)
  const fileInputRef = useRef(null)

  const [activeTab, setActiveTab] = useState('captioning')

  // Poll for status updates
  useEffect(() => {
    let interval
    if (videoData && (videoData.status === 'processing' || videoData.status === 'pending')) {
      interval = setInterval(async () => {
        try {
          const res = await axios.get(`${API_BASE}/videos/${videoData.id}/`)
          setVideoData(res.data)
          if (res.data.status === 'completed' || res.data.status === 'failed') {
            clearInterval(interval)
          }
        } catch (err) {
          console.error("Polling error", err)
        }
      }, 2000)
    }
    return () => clearInterval(interval)
  }, [videoData])

  const handleFileChange = (e) => {
    if (e.target.files) {
      setFile(e.target.files[0])
      setError(null)
    }
  }

  const handleUpload = async () => {
    if (!file) return
    setUploading(true)
    setError(null)

    const formData = new FormData()
    formData.append('title', file.name)
    formData.append('video_file', file)

    try {
      const res = await axios.post(`${API_BASE}/videos/`, formData, {
        headers: {
          'Content-Type': 'multipart/form-data',
        },
      })
      setVideoData(res.data)
      setFile(null)
      // Reset input
      if (fileInputRef.current) fileInputRef.current.value = ''
    } catch (err) {
      console.error(err)
      setError('Upload failed. Please try again.')
    } finally {
      setUploading(false)
    }
  }

  // Generate VTT blob for the track element
  const getCaptionsSrc = () => {
    if (!videoData || !videoData.srt_content) return null

    // Simple SRT to VTT converter for the browser (or assume backend sends VTT - here we just use SRT content with basic VTT header if needed, but <track> often needs VTT)
    // Actually, browsers are strict about WebVTT. Let's do a quick client-side wrap or just try to serve it.
    // Ideally backend generates VTT. But we have SRT.
    // Let's assume for now we might need to convert or just text content.

    // Quick Hack: Prepend WEBVTT
    const vttContent = "WEBVTT\n\n" + videoData.srt_content.replace(/(\d{2}:\d{2}:\d{2}),(\d{3})/g, '$1.$2')

    const blob = new Blob([vttContent], { type: 'text/vtt' })
    return URL.createObjectURL(blob)
  }

  return (
    <div className="card">
      <div className="tabs" style={{ display: 'flex', justifyContent: 'center', marginBottom: '2rem', gap: '1rem' }}>
        <button
          className={activeTab === 'captioning' ? 'active-tab' : ''}
          onClick={() => setActiveTab('captioning')}
          style={{ opacity: activeTab === 'captioning' ? 1 : 0.6 }}
        >
          Video Captioning
        </button>
        <button
          className={activeTab === 'tts' ? 'active-tab' : ''}
          onClick={() => setActiveTab('tts')}
          style={{ opacity: activeTab === 'tts' ? 1 : 0.6 }}
        >
          Text to Speech
        </button>
      </div>

      {activeTab === 'captioning' ? (
        <>
          <h1>AI Caption Generator</h1>
          <p style={{ opacity: 0.7, marginBottom: '2rem' }}>
            Upload a video to automatically generate captions using OpenAI Whisper.
          </p>

          <div className="upload-area">
            <label className="custom-file-upload">
              <input
                type="file"
                accept="video/*"
                onChange={handleFileChange}
                ref={fileInputRef}
              />
              {file ? file.name : "Select Video File"}
            </label>

            <div style={{ marginTop: '1rem' }}>
              <button
                onClick={handleUpload}
                disabled={!file || uploading}
              >
                {uploading ? 'Uploading...' : 'Upload & Process'}
              </button>
            </div>

            {error && <div className="error-msg">{error}</div>}
          </div>

          {videoData && (
            <div className="result-area">
              <h3>Status: <span className={`status-badge status-${videoData.status}`}>{videoData.status}</span></h3>

              {videoData.status === 'processing' && (
                <p className="animate-pulse">Analyzing audio and generating captions...</p>
              )}

              {videoData.status === 'completed' && (
                <div className="video-container">
                  <video
                    key={videoData.processed_video_file || videoData.video_file}
                    controls
                    width="100%"
                    crossOrigin="anonymous"
                    src={videoData.processed_video_file ? videoData.processed_video_file : videoData.video_file}
                  >
                    {!videoData.processed_video_file && videoData.srt_content && (
                      <track
                        kind="captions"
                        src={getCaptionsSrc()}
                        srcLang="en"
                        label="English"
                        default
                      />
                    )}
                    Your browser does not support the video tag.
                  </video>

                  {videoData.processed_video_file && (
                    <div style={{ marginTop: '1rem', display: 'flex', gap: '1rem', justifyContent: 'center' }}>
                      <a
                        href={videoData.processed_video_file}
                        download
                        target="_blank"
                        rel="noreferrer"
                        style={{ textDecoration: 'none' }}
                      >
                        <button style={{ backgroundColor: '#059669' }}>
                          Download w/ Captions
                        </button>
                      </a>
                    </div>
                  )}
                </div>
              )}

              {videoData.error_message && (
                <div className="error-msg">Error: {videoData.error_message}</div>
              )}
            </div>
          )}
        </>
      ) : (
        <TTSGenerator apiBase={API_BASE} />
      )}
    </div>
  )
}

export default App
