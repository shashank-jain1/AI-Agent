'use client'

import { useState, useRef, FormEvent } from 'react'
import { useVoiceAgent } from '@/components/agent/useVoiceAgent'
import VoiceOrb from '@/components/agent/VoiceOrb'
import ChatThread from '@/components/agent/ChatThread'
import MicButton from '@/components/agent/MicButton'
import { Send } from 'lucide-react'

type Lang = 'en' | 'hi'

export default function AgentPage() {
    const [language, setLanguage] = useState<Lang>('en')
    const { status, transcript, messages, startRecording, stopRecording, sendText, stopAudio, playMessageAudio } =
        useVoiceAgent(language)
    const inputRef = useRef<HTMLInputElement>(null)

    const handleSubmit = (e: FormEvent) => {
        e.preventDefault()
        const val = inputRef.current?.value.trim()
        if (val) {
            inputRef.current!.value = ''
            sendText(val)
        }
    }

    const statusLabel: Record<typeof status, string> = {
        idle: language === 'hi' ? 'बोलने के लिए माइक दबाएं' : 'Tap mic to speak',
        listening: language === 'hi' ? 'सुन रहा हूँ…' : 'Listening…',
        processing: language === 'hi' ? 'सोच रहा हूँ…' : 'Thinking…',
        speaking: language === 'hi' ? 'बोल रहा हूँ…' : 'Speaking…',
    }

    return (
        <main
            className="flex flex-col h-screen relative overflow-hidden"
            style={{ background: '#070710', fontFamily: 'Inter, sans-serif' }}
        >
            {/* ── Ambient background glows ── */}
            <div
                className="pointer-events-none absolute"
                style={{
                    top: '-120px', left: '50%', transform: 'translateX(-50%)',
                    width: '600px', height: '400px',
                    background: 'radial-gradient(ellipse at center, rgba(59,130,246,0.12) 0%, transparent 70%)',
                    filter: 'blur(40px)',
                }}
            />

            {/* ── Header ── */}
            <header className="flex items-center justify-between px-6 py-4 border-b border-white/[0.07] relative z-10">
                <div className="flex items-center gap-2">
                    <span className="text-blue-400 text-xl select-none">◈</span>
                    <span
                        className="text-white font-bold text-lg tracking-wide"
                        style={{ fontFamily: 'Syne, sans-serif' }}
                    >
                        VoiceBot
                    </span>
                </div>

                {/* Language toggle */}
                <div className="flex items-center gap-1 p-1 rounded-full border border-white/10 bg-white/5">
                    {(['en', 'hi'] as Lang[]).map((lang) => (
                        <button
                            key={lang}
                            onClick={() => setLanguage(lang)}
                            className={`px-3 py-1 rounded-full text-sm font-medium transition-all duration-200 ${language === lang
                                    ? 'bg-blue-600 text-white shadow-sm'
                                    : 'text-white/50 hover:text-white'
                                }`}
                        >
                            {lang === 'en' ? 'EN' : 'हि'}
                        </button>
                    ))}
                </div>

                {/* Admin link */}
                <a
                    href="/admin"
                    className="text-xs text-white/30 hover:text-white/60 transition-colors"
                >
                    Admin
                </a>
            </header>

            {/* ── Chat area ── */}
            <div className="flex-1 flex flex-col overflow-hidden relative z-10">
                <ChatThread 
                    messages={messages} 
                    onPlayAudio={playMessageAudio}
                    onStopAudio={stopAudio}
                    agentStatus={status}
                />
            </div>

            {/* ── Voice Control area ── */}
            <div className="relative z-10 flex flex-col items-center gap-3 px-6 pb-6 pt-4 border-t border-white/[0.07]">
                {/* Orb */}
                <VoiceOrb status={status} />

                {/* Status label / transcript */}
                <p className="text-sm text-white/40 h-5 text-center">
                    {transcript && status === 'processing' ? transcript : statusLabel[status]}
                </p>

                {/* Mic button */}
                <MicButton
                    status={status}
                    onStart={startRecording}
                    onStop={stopRecording}
                />

                {/* Divider */}
                <div className="flex items-center gap-3 w-full max-w-lg">
                    <div className="flex-1 h-px bg-white/10" />
                    <span className="text-xs text-white/30">
                        {language === 'hi' ? 'या नीचे टाइप करें' : 'or type below'}
                    </span>
                    <div className="flex-1 h-px bg-white/10" />
                </div>

                {/* Text input */}
                <form onSubmit={handleSubmit} className="flex gap-2 w-full max-w-lg">
                    <input
                        ref={inputRef}
                        type="text"
                        placeholder={language === 'hi' ? 'यहाँ टाइप करें…' : 'Type your question…'}
                        disabled={status !== 'idle'}
                        className="flex-1 px-4 py-2.5 rounded-xl text-sm text-white/90 outline-none transition-all
              placeholder:text-white/30 disabled:opacity-40"
                        style={{
                            background: 'rgba(255,255,255,0.06)',
                            border: '1px solid rgba(255,255,255,0.10)',
                        }}
                        onFocus={(e) =>
                            (e.target.style.borderColor = 'rgba(59,130,246,0.50)')
                        }
                        onBlur={(e) =>
                            (e.target.style.borderColor = 'rgba(255,255,255,0.10)')
                        }
                    />
                    <button
                        type="submit"
                        disabled={status !== 'idle'}
                        className="p-2.5 rounded-xl bg-blue-600 hover:bg-blue-500 disabled:opacity-40 
              disabled:cursor-not-allowed transition-all"
                    >
                        <Send size={18} className="text-white" />
                    </button>
                </form>
            </div>
        </main>
    )
}
