'use client'

import { useState, useRef, useCallback, useEffect } from 'react'
import { sendVoiceQuery, sendTextQuery, getTextTTS, getAutoDictate, VoiceQueryResponse, Source } from '@/lib/api'

export type AgentStatus = 'idle' | 'listening' | 'processing' | 'speaking'

export interface Message {
    id: string
    role: 'user' | 'ai'
    text: string
    sources?: Source[]
    isTyping?: boolean
}

export function useVoiceAgent(language: 'en' | 'hi', selectedDocIds: string[] = []) {
    const [status, setStatus] = useState<AgentStatus>('idle')
    const [transcript, setTranscript] = useState('')
    const [messages, setMessages] = useState<Message[]>([])
    
    // Auto-dictate state
    const autoDictateRef = useRef(true)

    useEffect(() => {
        getAutoDictate().then(val => {
            autoDictateRef.current = val
        }).catch(err => console.error('Failed to get auto-dictate', err))
    }, [])
    const sessionId = useRef(crypto.randomUUID())

    const mediaRecorderRef = useRef<MediaRecorder | null>(null)
    const chunksRef = useRef<Blob[]>([])
    const audioCtxRef = useRef<AudioContext | null>(null)

    // Generate a unique message id
    const uid = () => crypto.randomUUID()

    const addMessage = useCallback((msg: Message) => {
        setMessages((prev) => [...prev, msg])
    }, [])

    const updateLastAiMessage = useCallback((updates: Partial<Message>) => {
        setMessages((prev) => {
            const copy = [...prev]
            for (let i = copy.length - 1; i >= 0; i--) {
                if (copy[i].role === 'ai') {
                    copy[i] = { ...copy[i], ...updates }
                    break
                }
            }
            return copy
        })
    }, [])

    // ── Audio playback ────────────────────────────────────────────────────────
    const currentAudioRef = useRef<HTMLAudioElement | null>(null)
    const currentSourceRef = useRef<AudioBufferSourceNode | null>(null)

    const stopAudio = useCallback(() => {
        if (currentAudioRef.current) {
            currentAudioRef.current.pause()
            currentAudioRef.current.currentTime = 0
            currentAudioRef.current = null
        }
        if (currentSourceRef.current) {
            try { currentSourceRef.current.stop() } catch (e) {}
            currentSourceRef.current = null
        }
        setStatus('idle')
    }, [])

    const playAudioBase64 = useCallback(async (base64: string) => {
        try {
            stopAudio() // Stop any existing playback
            if (!audioCtxRef.current || audioCtxRef.current.state === 'closed') {
                audioCtxRef.current = new AudioContext()
            }
            const ctx = audioCtxRef.current

            // Decode base64 → ArrayBuffer
            const binaryStr = atob(base64)
            const bytes = new Uint8Array(binaryStr.length)
            for (let i = 0; i < binaryStr.length; i++) {
                bytes[i] = binaryStr.charCodeAt(i)
            }

            const decoded = await ctx.decodeAudioData(bytes.buffer)
            const source = ctx.createBufferSource()
            source.buffer = decoded
            source.connect(ctx.destination)
            currentSourceRef.current = source
            source.start()
            setStatus('speaking')
            source.onended = () => {
                if (currentSourceRef.current === source) {
                    currentSourceRef.current = null
                    setStatus('idle')
                }
            }
        } catch (e) {
            console.error('Audio playback failed:', e)
            setStatus('idle')
        }
    }, [stopAudio])

    const playAudioBlob = useCallback(async (blob: Blob) => {
        stopAudio() // Stop any existing playback
        const url = URL.createObjectURL(blob)
        const audio = new Audio(url)
        currentAudioRef.current = audio
        setStatus('speaking')
        audio.play()
        audio.onended = () => {
            if (currentAudioRef.current === audio) {
                setStatus('idle')
                currentAudioRef.current = null
            }
            URL.revokeObjectURL(url)
        }
        audio.onerror = () => {
            if (currentAudioRef.current === audio) {
                setStatus('idle')
                currentAudioRef.current = null
            }
            URL.revokeObjectURL(url)
        }
    }, [stopAudio])

    // ── Voice query ───────────────────────────────────────────────────────────

    const processAudioBlob = useCallback(
        async (audioBlob: Blob) => {
            setStatus('processing')
            // Add placeholder user message
            const userMsgId = uid()
            addMessage({ id: userMsgId, role: 'user', text: '…', isTyping: true })
            // Add typing indicator for AI
            addMessage({ id: uid(), role: 'ai', text: '', isTyping: true })

            try {
                const data = await sendVoiceQuery(audioBlob, language, sessionId.current, 'web', selectedDocIds)
                setTranscript(data.query)

                // Update user message with actual transcription
                setMessages((prev) =>
                    prev.map((m) =>
                        m.id === userMsgId ? { ...m, text: data.query, isTyping: false } : m
                    )
                )

                // Update AI message
                updateLastAiMessage({
                    text: data.answer,
                    sources: data.sources,
                    isTyping: false,
                })

                // Play audio
                if (data.audio) {
                    await playAudioBase64(data.audio)
                } else {
                    setStatus('idle')
                }
            } catch (err: any) {
                updateLastAiMessage({
                    text: `Error: ${err.message || 'Something went wrong.'}`,
                    isTyping: false,
                })
                setStatus('idle')
            }
        },
        [language, addMessage, updateLastAiMessage, playAudioBase64]
    )

    // ── Recording ─────────────────────────────────────────────────────────────

    const startRecording = useCallback(async () => {
        if (status !== 'idle') return
        try {
            const stream = await navigator.mediaDevices.getUserMedia({ audio: true })
            const mimeType = MediaRecorder.isTypeSupported('audio/webm;codecs=opus')
                ? 'audio/webm;codecs=opus'
                : 'audio/webm'
            const recorder = new MediaRecorder(stream, { mimeType })
            chunksRef.current = []

            recorder.ondataavailable = (e) => {
                if (e.data.size > 0) chunksRef.current.push(e.data)
            }

            recorder.onstop = () => {
                const blob = new Blob(chunksRef.current, { type: mimeType })
                stream.getTracks().forEach((t) => t.stop())
                processAudioBlob(blob)
            }

            recorder.start(250) // collect chunks every 250ms
            mediaRecorderRef.current = recorder
            setStatus('listening')
            setTranscript('')
        } catch (err: any) {
            console.error('Microphone access error:', err)
            alert('Microphone access denied. Please allow microphone access and try again.')
        }
    }, [status, processAudioBlob])

    const stopRecording = useCallback(() => {
        if (mediaRecorderRef.current && status === 'listening') {
            mediaRecorderRef.current.stop()
        }
    }, [status])

    // ── Text query ────────────────────────────────────────────────────────────

    const sendText = useCallback(
        async (text: string) => {
            if (!text.trim() || status !== 'idle') return
            setStatus('processing')
            addMessage({ id: uid(), role: 'user', text })
            addMessage({ id: uid(), role: 'ai', text: '', isTyping: true })

            try {
                const data = await sendTextQuery(text, language, sessionId.current, selectedDocIds)
                updateLastAiMessage({ text: data.answer, sources: data.sources, isTyping: false })

                if (autoDictateRef.current) {
                    const audioBlob = await getTextTTS(data.answer, data.language as 'en' | 'hi')
                    await playAudioBlob(audioBlob)
                } else {
                    setStatus('idle')
                }
            } catch (err: any) {
                updateLastAiMessage({
                    text: `Error: ${err.message || 'Something went wrong.'}`,
                    isTyping: false,
                })
                setStatus('idle')
            }
        },
        [language, status, addMessage, updateLastAiMessage, playAudioBlob]
    )

    const playMessageAudio = useCallback(async (text: string) => {
        if (!text.trim()) return
        setStatus('processing')
        try {
            const audioBlob = await getTextTTS(text, language)
            await playAudioBlob(audioBlob)
        } catch (err: any) {
            console.error('TTS playback failed', err)
            setStatus('idle')
        }
    }, [language, playAudioBlob])

    return {
        status,
        transcript,
        messages,
        startRecording,
        stopRecording,
        sendText,
        stopAudio,
        playMessageAudio,
    }
}

