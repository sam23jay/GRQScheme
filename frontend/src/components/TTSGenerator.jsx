import { useState, useEffect, useRef } from 'react'
import axios from 'axios'

const TTSGenerator = ({ apiBase }) => {
    const [text, setText] = useState('')
    const [speakers, setSpeakers] = useState([])
    const [selectedSpeaker, setSelectedSpeaker] = useState('')
    const [loading, setLoading] = useState(false)
    const [audioUrl, setAudioUrl] = useState(null)
    const [error, setError] = useState(null)
    const audioRef = useRef(null)

    useEffect(() => {
        fetchSpeakers()
    }, [])

    const fetchSpeakers = async () => {
        try {
            const res = await axios.get(`${apiBase}/tts/speakers/`)
            if (res.data.speakers) {
                setSpeakers(res.data.speakers)
                if (res.data.speakers.length > 0) {
                    setSelectedSpeaker(res.data.speakers[0])
                }
            }
        } catch (err) {
            console.error("Failed to fetch speakers", err)
            // If service unavailable (e.g. still loading model), might 503
        }
    }

    const handleGenerate = async () => {
        if (!text) return
        setLoading(true)
        setError(null)
        setAudioUrl(null)

        try {
            const res = await axios.post(`${apiBase}/tts/generate/`, {
                text,
                speaker_id: selectedSpeaker
            })

            // The backend returns a relative URL or absolute?
            // Our services.py returns relative path, views.py constructs full URL ideally.
            // Let's assume views returns full URL or absolute path relative to domain.

            // If result is just path (e.g. /media/tts/...), and we are on different port?
            // The view returned `settings.MEDIA_URL + ...`.
            // If backend is 8001 and frontend 5173, we need full URL including host if not proxied.
            // But we are making requests to `http://127.0.0.1:8001/api/...`.
            // So if it returns `/media/tts/file.wav`, we need to prepend origin?
            // Actually, axios `baseURL` isn't set globally, we utilize `apiBase` which is `http://...:8001/api`.
            // We need `http://...:8001/media/...`.

            let url = res.data.audio_url
            if (url.startsWith('/')) {
                // Construct full URL based on apiBase origin
                const origin = new URL(apiBase).origin
                url = `${origin}${url}`
            }

            setAudioUrl(url)

        } catch (err) {
            console.error(err)
            setError(err.response?.data?.error || "Generation failed")
        } finally {
            setLoading(false)
        }
    }

    return (
        <div className="tts-container">
            <h2>Text to Speech (Coqui TTS)</h2>

            <div className="input-group">
                <label>Text Input</label>
                <textarea
                    value={text}
                    onChange={(e) => setText(e.target.value)}
                    placeholder="Enter text to convert to speech..."
                    rows={5}
                    style={{ width: '100%', padding: '0.5rem', marginBottom: '1rem' }}
                />
            </div>

            <div className="input-group" style={{ marginBottom: '1rem' }}>
                <label>Speaker: </label>
                <select
                    value={selectedSpeaker}
                    onChange={(e) => setSelectedSpeaker(e.target.value)}
                    disabled={speakers.length === 0}
                    style={{ padding: '0.5rem', marginLeft: '0.5rem' }}
                >
                    {speakers.map(s => (
                        <option key={s} value={s}>{s}</option>
                    ))}
                    {speakers.length === 0 && <option>Loading speakers...</option>}
                </select>
            </div>

            <button
                onClick={handleGenerate}
                disabled={!text || loading}
                className="primary-btn"
            >
                {loading ? 'Generating...' : 'Generate Speech'}
            </button>

            {error && <div className="error-msg" style={{ marginTop: '1rem', color: 'red' }}>{error}</div>}

            {audioUrl && (
                <div className="result-area" style={{ marginTop: '2rem' }}>
                    <h3>Generated Audio</h3>
                    <audio ref={audioRef} controls src={audioUrl} style={{ width: '100%' }} />
                    <div style={{ marginTop: '1rem' }}>
                        <a href={audioUrl} download target="_blank" rel="noreferrer">
                            <button>Download Audio</button>
                        </a>
                    </div>
                </div>
            )}
        </div>
    )
}

export default TTSGenerator
