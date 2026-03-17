import { useState, useRef, useCallback } from 'react'
import { Audio } from 'expo-av'
import * as FileSystem from 'expo-file-system'
import Constants from 'expo-constants'

const API_URL =
    Constants.expoConfig?.extra?.apiUrl || process.env.EXPO_PUBLIC_API_URL || 'http://localhost:8000'

export type AgentStatus = 'idle' | 'listening' | 'processing' | 'speaking'

export interface Source {
    filename: string
    page_number: number
    similarity: number
}

export interface Message {
    id: string
    role: 'user' | 'ai'
    text: string
    sources?: Source[]
    isTyping?: boolean
}

const uid = () => Math.random().toString(36).slice(2)

export function useVoiceAgent(language: 'en' | 'hi') {
    const [status, setStatus] = useState<AgentStatus>('idle')
    const [transcript, setTranscript] = useState('')
    const [messages, setMessages] = useState<Message[]>([])
    const sessionId = useRef(uid())
    const recordingRef = useRef<Audio.Recording | null>(null)
    const soundRef = useRef<Audio.Sound | null>(null)

    const addMessage = useCallback((msg: Message) =>
        setMessages((prev) => [...prev, msg]), [])

    const updateLastAiMessage = useCallback((updates: Partial<Message>) => {
        setMessages((prev) => {
            const copy = [...prev]
            for (let i = copy.length - 1; i >= 0; i--) {
                if (copy[i].role === 'ai') { copy[i] = { ...copy[i], ...updates }; break }
            }
            return copy
        })
    }, [])

    // ── Audio playback ──────────────────────────────────────────────────────

    const playAudioBase64 = useCallback(async (base64: string) => {
        try {
            const audioPath = `${FileSystem.cacheDirectory}response_${uid()}.mp3`
            await FileSystem.writeAsStringAsync(audioPath, base64, {
                encoding: FileSystem.EncodingType.Base64,
            })
            const { sound } = await Audio.Sound.createAsync({ uri: audioPath })
            soundRef.current = sound
            setStatus('speaking')
            await sound.playAsync()
            sound.setOnPlaybackStatusUpdate((s) => {
                if (s.isLoaded && s.didJustFinish) setStatus('idle')
            })
        } catch (e) {
            console.error('Playback error:', e)
            setStatus('idle')
        }
    }, [])

    // ── Recording ───────────────────────────────────────────────────────────

    const startRecording = useCallback(async () => {
        if (status !== 'idle') return
        try {
            await Audio.requestPermissionsAsync()
            await Audio.setAudioModeAsync({
                allowsRecordingIOS: true,
                playsInSilentModeIOS: true, // CRITICAL for iOS
            })

            const { recording } = await Audio.Recording.createAsync({
                android: {
                    extension: '.m4a',
                    outputFormat: Audio.AndroidOutputFormat.MPEG_4,
                    audioEncoder: Audio.AndroidAudioEncoder.AAC,
                    sampleRate: 16000,
                    numberOfChannels: 1,
                    bitRate: 128000,
                },
                ios: {
                    extension: '.m4a',
                    outputFormat: Audio.IOSOutputFormat.MPEG4AAC,
                    audioQuality: Audio.IOSAudioQuality.HIGH,
                    sampleRate: 16000,
                    numberOfChannels: 1,
                    bitRate: 128000,
                },
                web: {},
            })

            recordingRef.current = recording
            setStatus('listening')
            setTranscript('')
        } catch (e) {
            console.error('Recording start error:', e)
        }
    }, [status])

    const stopRecording = useCallback(async () => {
        if (!recordingRef.current || status !== 'listening') return
        try {
            await recordingRef.current.stopAndUnloadAsync()
            const uri = recordingRef.current.getURI()
            recordingRef.current = null
            if (uri) await processAudio(uri)
        } catch (e) {
            console.error('Stop recording error:', e)
            setStatus('idle')
        }
    }, [status])

    const processAudio = async (audioUri: string) => {
        setStatus('processing')
        const userMsgId = uid()
        addMessage({ id: userMsgId, role: 'user', text: '…', isTyping: true })
        addMessage({ id: uid(), role: 'ai', text: '', isTyping: true })

        try {
            const response = await FileSystem.uploadAsync(
                `${API_URL}/api/voice/query`,
                audioUri,
                {
                    httpMethod: 'POST',
                    uploadType: FileSystem.FileSystemUploadType.MULTIPART,
                    fieldName: 'audio',
                    parameters: {
                        language,
                        session_id: sessionId.current,
                        client_type: 'mobile',
                        tts: 'true',
                    },
                }
            )

            const data = JSON.parse(response.body)
            setTranscript(data.query || '')
            setMessages((prev) =>
                prev.map((m) =>
                    m.id === userMsgId ? { ...m, text: data.query || '…', isTyping: false } : m
                )
            )
            updateLastAiMessage({ text: data.answer, sources: data.sources, isTyping: false })
            if (data.audio) await playAudioBase64(data.audio)
            else setStatus('idle')
        } catch (e: any) {
            updateLastAiMessage({ text: `Error: ${e.message}`, isTyping: false })
            setStatus('idle')
        }
    }

    // ── Text query ──────────────────────────────────────────────────────────

    const sendText = useCallback(async (text: string) => {
        if (!text.trim() || status !== 'idle') return
        setStatus('processing')
        addMessage({ id: uid(), role: 'user', text })
        addMessage({ id: uid(), role: 'ai', text: '', isTyping: true })

        try {
            const res = await fetch(`${API_URL}/api/query`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ query: text, language, session_id: sessionId.current, client_type: 'mobile' }),
            })
            const data = await res.json()
            updateLastAiMessage({ text: data.answer, sources: data.sources, isTyping: false })

            // Get TTS
            const ttsRes = await fetch(`${API_URL}/api/query/tts`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ text: data.answer, language: data.language }),
            })
            const ttsBlob = await ttsRes.blob()
            // Write to temp and play
            const tmpPath = `${FileSystem.cacheDirectory}tts_${uid()}.mp3`
            const reader = new FileReader()
            reader.onload = async () => {
                const b64 = (reader.result as string).split(',')[1]
                await playAudioBase64(b64)
            }
            reader.readAsDataURL(ttsBlob)
        } catch (e: any) {
            updateLastAiMessage({ text: `Error: ${e.message}`, isTyping: false })
            setStatus('idle')
        }
    }, [language, status, addMessage, updateLastAiMessage, playAudioBase64])

    return { status, transcript, messages, startRecording, stopRecording, sendText }
}
