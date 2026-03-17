'use client'

import { Mic, MicOff, Square } from 'lucide-react'
import { AgentStatus } from './useVoiceAgent'

interface MicButtonProps {
    status: AgentStatus
    onStart: () => void
    onStop: () => void
}

export default function MicButton({ status, onStart, onStop }: MicButtonProps) {
    const isListening = status === 'listening'
    const isDisabled = status === 'processing' || status === 'speaking'

    return (
        <button
            onClick={isListening ? onStop : onStart}
            disabled={isDisabled}
            aria-label={isListening ? 'Stop recording' : 'Start recording'}
            className={`
        relative w-16 h-16 rounded-full flex items-center justify-center
        transition-all duration-200 focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-400
        ${isListening
                    ? 'bg-red-500 hover:bg-red-600 shadow-[0_0_20px_4px_rgba(239,68,68,0.4)]'
                    : isDisabled
                        ? 'bg-white/10 cursor-not-allowed opacity-50'
                        : 'bg-blue-600 hover:bg-blue-500 shadow-[0_0_20px_4px_rgba(59,130,246,0.25)] hover:shadow-[0_0_28px_8px_rgba(59,130,246,0.35)]'
                }
      `}
        >
            {isListening ? (
                <Square className="w-6 h-6 text-white fill-white" />
            ) : status === 'processing' ? (
                <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
            ) : (
                <Mic className="w-7 h-7 text-white" />
            )}

            {/* Pulsing ring when listening */}
            {isListening && (
                <span className="absolute inset-0 rounded-full border-2 border-red-400 animate-ping opacity-50" />
            )}
        </button>
    )
}
