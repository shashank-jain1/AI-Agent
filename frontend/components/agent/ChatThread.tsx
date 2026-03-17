'use client'

import { useEffect, useRef } from 'react'
import { Message } from './useVoiceAgent'
import { FileText, Play, Square } from 'lucide-react'

interface ChatThreadProps {
    messages: Message[]
    onPlayAudio?: (text: string) => void
    onStopAudio?: () => void
    agentStatus?: string
}


function TypingDots() {
    return (
        <div className="flex gap-1 py-1">
            {[0, 1, 2].map((i) => (
                <span
                    key={i}
                    className="w-2 h-2 rounded-full bg-blue-400 animate-dot"
                    style={{ animationDelay: `${i * 0.16}s` }}
                />
            ))}
        </div>
    )
}

export default function ChatThread({ messages, onPlayAudio, onStopAudio, agentStatus }: ChatThreadProps) {
    const bottomRef = useRef<HTMLDivElement>(null)

    useEffect(() => {
        bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
    }, [messages])

    if (messages.length === 0) {
        return (
            <div className="flex-1 flex items-center justify-center text-center px-8">
                <div>
                    <p className="text-white/30 text-sm font-inter">
                        Speak or type your question below
                    </p>
                    <p className="text-white/20 text-xs mt-1">
                        हिंदी या English में बोलें
                    </p>
                </div>
            </div>
        )
    }

    return (
        <div className="flex-1 overflow-y-auto px-4 py-4 flex flex-col gap-4">
            {messages.map((msg) => (
                <div
                    key={msg.id}
                    className={`flex flex-col animate-fade-in-up ${msg.role === 'user' ? 'items-end' : 'items-start'}`}
                >
                    {/* Bubble */}
                    <div
                        className={`max-w-[80%] px-4 py-3 rounded-2xl text-sm leading-relaxed ${msg.role === 'user'
                                ? 'bg-blue-600 text-white rounded-tr-sm'
                                : 'text-white/90 rounded-tl-sm border'
                            }`}
                        style={
                            msg.role === 'ai'
                                ? { background: 'rgba(255,255,255,0.05)', borderColor: 'rgba(255,255,255,0.10)' }
                                : {}
                        }
                    >
                        {msg.isTyping && msg.text === '' ? (
                            <TypingDots />
                        ) : (
                            <span className="whitespace-pre-wrap">{msg.text}</span>
                        )}
                    </div>

                    {msg.role === 'ai' && !msg.isTyping && msg.text && (
                        <div className="flex gap-2 mt-1 px-1">
                            <button
                                onClick={() => onPlayAudio?.(msg.text)}
                                disabled={agentStatus === 'speaking' || agentStatus === 'processing'}
                                className="text-white/40 hover:text-white transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                                title="Dictate answer"
                            >
                                <Play size={14} className="fill-current" />
                            </button>
                            {agentStatus === 'speaking' && (
                                <button
                                    onClick={() => onStopAudio?.()}
                                    className="text-red-400 hover:text-red-300 transition-colors"
                                    title="Stop dictation"
                                >
                                    <Square size={14} className="fill-current" />
                                </button>
                            )}
                        </div>
                    )}

                    {/* Sources hidden as requested by admin */}
                </div>
            ))}
            <div ref={bottomRef} />
        </div>
    )
}
