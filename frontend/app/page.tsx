'use client'

import { useState, useRef, useEffect, FormEvent } from 'react'
import { useVoiceAgent } from '@/components/agent/useVoiceAgent'
import VoiceOrb from '@/components/agent/VoiceOrb'
import ChatThread from '@/components/agent/ChatThread'
import MicButton from '@/components/agent/MicButton'
import { Send, Files, ChevronDown, ChevronUp, CheckSquare, Square, Filter } from 'lucide-react'
import { getFileSelection, listPublicDocuments, PublicDocument } from '@/lib/api'

type Lang = 'en' | 'hi'

export default function AgentPage() {
    const [language, setLanguage] = useState<Lang>('en')

    // ── File selection state ──────────────────────────────────────────────────
    const [fileSelectionEnabled, setFileSelectionEnabled] = useState(false)
    const [documents, setDocuments] = useState<PublicDocument[]>([])
    const [selectedDocIds, setSelectedDocIds] = useState<string[]>([])
    const [pickerOpen, setPickerOpen] = useState(false)

    useEffect(() => {
        // Fetch the file-selection setting and (if on) the document list
        getFileSelection().then(async (enabled) => {
            setFileSelectionEnabled(enabled)
            if (enabled) {
                const docs = await listPublicDocuments()
                setDocuments(docs)
            }
        }).catch(console.error)
    }, [])

    const toggleDoc = (id: string) => {
        setSelectedDocIds((prev) =>
            prev.includes(id) ? prev.filter((d) => d !== id) : [...prev, id]
        )
    }

    const toggleAll = () => {
        if (selectedDocIds.length === documents.length) {
            setSelectedDocIds([])
        } else {
            setSelectedDocIds(documents.map((d) => d.id))
        }
    }

    // ── Voice agent ───────────────────────────────────────────────────────────
    const { status, transcript, messages, startRecording, stopRecording, sendText, stopAudio, playMessageAudio } =
        useVoiceAgent(language, selectedDocIds)
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

    const activeFilterCount = selectedDocIds.length

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

                <div className="flex items-center gap-3">
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

                    {/* File filter badge (only shown when feature is on) */}
                    {fileSelectionEnabled && (
                        <button
                            id="doc-filter-toggle"
                            onClick={() => setPickerOpen((o) => !o)}
                            title="Filter by document"
                            className="flex items-center gap-1.5 px-3 py-1.5 rounded-full text-sm font-medium transition-all duration-200"
                            style={{
                                background: activeFilterCount > 0 ? 'rgba(59,130,246,0.20)' : 'rgba(255,255,255,0.06)',
                                border: `1px solid ${activeFilterCount > 0 ? 'rgba(59,130,246,0.50)' : 'rgba(255,255,255,0.10)'}`,
                                color: activeFilterCount > 0 ? '#93c5fd' : 'rgba(255,255,255,0.50)',
                            }}
                        >
                            <Filter size={13} />
                            <span>
                                {activeFilterCount > 0
                                    ? `${activeFilterCount} file${activeFilterCount > 1 ? 's' : ''}`
                                    : 'All files'}
                            </span>
                            {pickerOpen ? <ChevronUp size={12} /> : <ChevronDown size={12} />}
                        </button>
                    )}

                    {/* Admin link */}
                    <a
                        href="/admin"
                        className="text-xs text-white/30 hover:text-white/60 transition-colors"
                    >
                        Admin
                    </a>
                </div>
            </header>

            {/* ── Document Picker Panel ── */}
            {fileSelectionEnabled && pickerOpen && (
                <div
                    className="relative z-20 border-b border-white/[0.07] px-6 py-4"
                    style={{ background: 'rgba(10,10,28,0.95)', backdropFilter: 'blur(12px)' }}
                >
                    <div className="max-w-2xl mx-auto">
                        <div className="flex items-center justify-between mb-3">
                            <div className="flex items-center gap-2">
                                <Files size={15} className="text-blue-400" />
                                <span className="text-white/80 text-sm font-medium">
                                    {language === 'hi' ? 'फ़ाइलें चुनें' : 'Select source files'}
                                </span>
                                <span className="text-white/30 text-xs">
                                    {language === 'hi'
                                        ? '(चुनी हुई फ़ाइलों से ही जवाब मिलेगा)'
                                        : '(answers will only come from selected files)'}
                                </span>
                            </div>
                            {documents.length > 0 && (
                                <button
                                    id="doc-select-all"
                                    onClick={toggleAll}
                                    className="text-xs text-blue-400 hover:text-blue-300 transition-colors"
                                >
                                    {selectedDocIds.length === documents.length ? 'Deselect all' : 'Select all'}
                                </button>
                            )}
                        </div>

                        {documents.length === 0 ? (
                            <p className="text-white/30 text-sm">
                                {language === 'hi'
                                    ? 'कोई इंडेक्स्ड फ़ाइल नहीं मिली।'
                                    : 'No indexed documents available yet.'}
                            </p>
                        ) : (
                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 max-h-52 overflow-y-auto pr-1">
                                {documents.map((doc) => {
                                    const isSelected = selectedDocIds.includes(doc.id)
                                    return (
                                        <button
                                            key={doc.id}
                                            id={`doc-${doc.id}`}
                                            onClick={() => toggleDoc(doc.id)}
                                            className="flex items-center gap-2.5 px-3 py-2.5 rounded-xl text-left transition-all duration-150 w-full"
                                            style={{
                                                background: isSelected
                                                    ? 'rgba(59,130,246,0.15)'
                                                    : 'rgba(255,255,255,0.04)',
                                                border: `1px solid ${isSelected
                                                    ? 'rgba(59,130,246,0.40)'
                                                    : 'rgba(255,255,255,0.08)'}`,
                                            }}
                                        >
                                            {isSelected
                                                ? <CheckSquare size={15} className="text-blue-400 shrink-0" />
                                                : <Square size={15} className="text-white/30 shrink-0" />
                                            }
                                            <span
                                                className="text-xs truncate"
                                                style={{ color: isSelected ? '#93c5fd' : 'rgba(255,255,255,0.60)' }}
                                                title={doc.original_name}
                                            >
                                                {doc.original_name || doc.filename}
                                            </span>
                                        </button>
                                    )
                                })}
                            </div>
                        )}

                        {activeFilterCount > 0 && (
                            <p className="text-blue-400/70 text-xs mt-3">
                                {language === 'hi'
                                    ? `${activeFilterCount} फ़ाइल${activeFilterCount > 1 ? 'ें' : ''} चुनी गईं — केवल इन्हीं से जवाब मिलेगा`
                                    : `${activeFilterCount} file${activeFilterCount > 1 ? 's' : ''} selected — chatbot will only answer from ${activeFilterCount > 1 ? 'these' : 'this'}`}
                            </p>
                        )}
                    </div>
                </div>
            )}

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
