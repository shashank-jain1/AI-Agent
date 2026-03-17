'use client'

import { AgentStatus } from './useVoiceAgent'

interface VoiceOrbProps {
    status: AgentStatus
}

export default function VoiceOrb({ status }: VoiceOrbProps) {
    return (
        <div className="relative flex items-center justify-center w-32 h-32 mx-auto my-4">
            {/* ── Idle / Listening / Processing rings ── */}
            {status === 'listening' && (
                <>
                    {[0, 1, 2].map((i) => (
                        <span
                            key={i}
                            className="absolute inset-0 rounded-full border-2 border-blue-400 opacity-0"
                            style={{
                                animation: `ring-expand 1.5s ease-out ${i * 0.5}s infinite`,
                            }}
                        />
                    ))}
                </>
            )}

            {/* ── Processing: spinning gradient ring ── */}
            {status === 'processing' && (
                <span
                    className="absolute inset-[-4px] rounded-full"
                    style={{
                        background:
                            'conic-gradient(from 0deg, #3B82F6, #8B5CF6, #3B82F6)',
                        animation: 'spin-ring 1.2s linear infinite',
                    }}
                />
            )}

            {/* ── Core orb ── */}
            <div
                className="relative z-10 w-28 h-28 rounded-full flex items-center justify-center"
                style={{
                    background:
                        status === 'speaking'
                            ? 'radial-gradient(circle at 40% 40%, #22C55E, #15803d)'
                            : status === 'listening'
                                ? 'radial-gradient(circle at 40% 40%, #60a5fa, #1d4ed8)'
                                : status === 'processing'
                                    ? 'radial-gradient(circle at 40% 40%, #a78bfa, #6d28d9)'
                                    : 'radial-gradient(circle at 40% 40%, #3B82F6, #1e3a8a)',
                    boxShadow:
                        status === 'speaking'
                            ? '0 0 40px 12px rgba(34,197,94,0.35)'
                            : status === 'listening'
                                ? '0 0 48px 16px rgba(59,130,246,0.45)'
                                : status === 'processing'
                                    ? '0 0 40px 12px rgba(139,92,246,0.40)'
                                    : '0 0 30px 8px rgba(59,130,246,0.25)',
                    animation:
                        status === 'idle' ? 'pulse-slow 3s ease-in-out infinite' : 'none',
                    transition: 'background 0.5s, box-shadow 0.5s',
                }}
            >
                {/* ── Speaking: equalizer bars ── */}
                {status === 'speaking' && (
                    <div className="flex items-end gap-[3px] h-8">
                        {[300, 400, 350, 450, 320].map((dur, i) => (
                            <div
                                key={i}
                                className="w-[5px] rounded-full bg-white"
                                style={{
                                    animation: `bar-bounce ${dur}ms ease-in-out alternate infinite`,
                                    animationDelay: `${i * 60}ms`,
                                }}
                            />
                        ))}
                    </div>
                )}

                {/* ── Processing: spinning icon ── */}
                {status === 'processing' && (
                    <svg
                        className="w-8 h-8 text-white animate-spin"
                        fill="none"
                        viewBox="0 0 24 24"
                    >
                        <circle
                            className="opacity-25"
                            cx="12"
                            cy="12"
                            r="10"
                            stroke="currentColor"
                            strokeWidth="4"
                        />
                        <path
                            className="opacity-75"
                            fill="currentColor"
                            d="M4 12a8 8 0 018-8v4l3-3-3-3V4a10 10 0 100 20v-2a8 8 0 01-8-8z"
                        />
                    </svg>
                )}

                {/* ── Idle / Listening: logo mark ── */}
                {(status === 'idle' || status === 'listening') && (
                    <span className="text-3xl select-none" style={{ fontFamily: 'Syne, sans-serif', color: 'white' }}>
                        ◈
                    </span>
                )}
            </div>
        </div>
    )
}
