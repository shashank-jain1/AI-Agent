'use client'

import { useEffect, useState, useRef, DragEvent, ChangeEvent } from 'react'
import { useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabase'
import {
    listDocuments,
    uploadDocument,
    deleteDocument,
    reindexDocument,
    Document,
} from '@/lib/api'
import {
    Upload, Trash2, RefreshCw, CheckCircle, XCircle,
    Clock, Loader2, FileText, Image, File
} from 'lucide-react'
import { AdminSidebar } from '@/components/admin/AdminSidebar'

const STATUS_CONFIG: Record<string, { label: string; color: string; icon: any }> = {
    queued: { label: 'Queued', color: '#F59E0B', icon: Clock },
    processing: { label: 'Processing', color: '#3B82F6', icon: Loader2 },
    ocr_processing: { label: 'OCR…', color: '#8B5CF6', icon: Loader2 },
    embedding: { label: 'Embedding', color: '#06B6D4', icon: Loader2 },
    indexed: { label: 'Indexed', color: '#22C55E', icon: CheckCircle },
    failed: { label: 'Failed', color: '#EF4444', icon: XCircle },
}

function StatusBadge({ status }: { status: string }) {
    const cfg = STATUS_CONFIG[status] ?? { label: status, color: '#888', icon: File }
    const Icon = cfg.icon
    return (
        <span
            className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-medium"
            style={{ background: `${cfg.color}18`, color: cfg.color, border: `1px solid ${cfg.color}33` }}
        >
            <Icon size={11} className={status !== 'indexed' && status !== 'failed' ? 'animate-spin' : ''} />
            {cfg.label}
        </span>
    )
}

function FileTypeIcon({ type }: { type: string }) {
    if (type === 'image') return <Image size={16} className="text-violet-400" />
    if (type === 'pdf') return <FileText size={16} className="text-red-400" />
    return <File size={16} className="text-blue-400" />
}

export default function DocumentsPage() {
    const router = useRouter()
    const [token, setToken] = useState('')
    const [docs, setDocs] = useState<Document[]>([])
    const [loading, setLoading] = useState(true)
    const [uploading, setUploading] = useState(false)
    const [dragOver, setDragOver] = useState(false)
    const fileInputRef = useRef<HTMLInputElement>(null)

    // Real-time polling for in-progress docs
    const pollingRef = useRef<NodeJS.Timeout | null>(null)

    useEffect(() => {
        const init = async () => {
            const { data: { session } } = await supabase.auth.getSession()
            if (!session) { router.push('/admin'); return }
            setToken(session.access_token)
            await fetchDocs(session.access_token)
        }
        init()
        return () => { if (pollingRef.current) clearInterval(pollingRef.current) }
    }, [])

    const fetchDocs = async (t?: string) => {
        try {
            const list = await listDocuments(t || token)
            setDocs(list)
            startPollingIfNeeded(list, t || token)
        } catch { }
        setLoading(false)
    }

    const startPollingIfNeeded = (list: Document[], t: string) => {
        const inProgress = list.some(
            (d) => !['indexed', 'failed'].includes(d.status)
        )
        if (inProgress && !pollingRef.current) {
            pollingRef.current = setInterval(async () => {
                const updated = await listDocuments(t)
                setDocs(updated)
                const stillInProgress = updated.some(
                    (d) => !['indexed', 'failed'].includes(d.status)
                )
                if (!stillInProgress && pollingRef.current) {
                    clearInterval(pollingRef.current)
                    pollingRef.current = null
                }
            }, 3000)
        }
    }

    const handleFiles = async (files: FileList | null) => {
        if (!files || files.length === 0) return
        setUploading(true)
        for (const file of Array.from(files)) {
            try {
                await uploadDocument(file, token)
            } catch (err: any) {
                alert(`Upload failed for ${file.name}: ${err.message}`)
            }
        }
        setUploading(false)
        await fetchDocs()
    }

    const handleDrop = (e: DragEvent) => {
        e.preventDefault()
        setDragOver(false)
        handleFiles(e.dataTransfer.files)
    }

    const handleDelete = async (id: string) => {
        if (!confirm('Delete this document and all its indexed data?')) return
        await deleteDocument(id, token)
        setDocs((prev) => prev.filter((d) => d.id !== id))
    }

    const handleReindex = async (id: string) => {
        await reindexDocument(id, token)
        await fetchDocs()
    }

    return (
        <div className="flex h-screen flex-col md:flex-row" style={{ background: '#070710' }}>
            <AdminSidebar />

            {/* Main */}
            <main className="flex-1 p-5 md:p-8 overflow-y-auto w-full relative">
                    <h1 className="text-white text-2xl font-bold mb-1" style={{ fontFamily: 'Syne, sans-serif' }}>
                        Documents
                    </h1>
                    <p className="text-white/40 text-sm mb-6">
                        Upload PDFs, PowerPoints, Word docs, and images. They'll be automatically OCR'd, chunked, and indexed.
                    </p>

                    {/* Upload zone */}
                    <div
                        onClick={() => fileInputRef.current?.click()}
                        onDragOver={(e) => { e.preventDefault(); setDragOver(true) }}
                        onDragLeave={() => setDragOver(false)}
                        onDrop={handleDrop}
                        className={`relative border-2 border-dashed rounded-2xl p-10 text-center cursor-pointer
              transition-all duration-200 mb-8
              ${dragOver ? 'border-blue-400 bg-blue-500/10' : 'border-white/15 hover:border-white/30 hover:bg-white/[0.02]'}`}
                    >
                        <input
                            ref={fileInputRef}
                            type="file"
                            multiple
                            className="hidden"
                            accept=".pdf,.pptx,.docx,.png,.jpg,.jpeg,.tiff,.webp"
                            onChange={(e: ChangeEvent<HTMLInputElement>) => handleFiles(e.target.files)}
                        />
                        {uploading ? (
                            <div className="flex items-center justify-center gap-3 text-blue-400">
                                <Loader2 size={24} className="animate-spin" />
                                <span className="text-sm">Uploading…</span>
                            </div>
                        ) : (
                            <>
                                <Upload size={32} className="mx-auto mb-3 text-white/30" />
                                <p className="text-white/60 text-sm font-medium">Drop files here or click to browse</p>
                                <p className="text-white/30 text-xs mt-1">
                                    PDF, PPTX, DOCX, PNG, JPG, TIFF, WEBP — max 50 MB
                                </p>
                            </>
                        )}
                    </div>

                    {/* Documents table */}
                    {loading ? (
                        <div className="text-white/30 text-sm">Loading documents…</div>
                    ) : docs.length === 0 ? (
                        <div className="text-center py-16 text-white/20">
                            <FileText size={40} className="mx-auto mb-3 opacity-30" />
                            <p className="text-sm">No documents uploaded yet</p>
                        </div>
                    ) : (
                        <div className="rounded-xl overflow-hidden overflow-x-auto pb-4" style={{ border: '1px solid rgba(255,255,255,0.08)' }}>
                            <table className="w-full text-sm min-w-[700px]">
                                <thead>
                                    <tr className="text-white/40 text-xs" style={{ background: 'rgba(255,255,255,0.03)' }}>
                                        <th className="px-4 py-3 text-left font-medium">File</th>
                                        <th className="px-4 py-3 text-left font-medium">Type</th>
                                        <th className="px-4 py-3 text-left font-medium">Status</th>
                                        <th className="px-4 py-3 text-left font-medium">Pages</th>
                                        <th className="px-4 py-3 text-left font-medium">Chunks</th>
                                        <th className="px-4 py-3 text-left font-medium">OCR</th>
                                        <th className="px-4 py-3 text-right font-medium">Actions</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-white/[0.05]">
                                    {docs.map((doc) => (
                                        <tr key={doc.id} className="hover:bg-white/[0.02] transition-colors">
                                            <td className="px-4 py-3 text-white/80 max-w-[200px] truncate" title={doc.original_name}>
                                                {doc.original_name}
                                            </td>
                                            <td className="px-4 py-3">
                                                <FileTypeIcon type={doc.file_type} />
                                            </td>
                                            <td className="px-4 py-3">
                                                <StatusBadge status={doc.status} />
                                                {doc.error_message && (
                                                    <p className="text-red-400/60 text-[11px] mt-1 max-w-[160px] truncate" title={doc.error_message}>
                                                        {doc.error_message}
                                                    </p>
                                                )}
                                            </td>
                                            <td className="px-4 py-3 text-white/50">{doc.page_count || '—'}</td>
                                            <td className="px-4 py-3 text-white/50">{doc.chunk_count || '—'}</td>
                                            <td className="px-4 py-3">
                                                {doc.ocr_used ? (
                                                    <span className="text-violet-400 text-xs">Yes</span>
                                                ) : (
                                                    <span className="text-white/30 text-xs">No</span>
                                                )}
                                            </td>
                                            <td className="px-4 py-3">
                                                <div className="flex justify-end gap-2">
                                                    <button
                                                        onClick={() => handleReindex(doc.id)}
                                                        title="Reindex"
                                                        className="p-1.5 rounded-lg hover:bg-blue-500/15 text-blue-400/60 hover:text-blue-400 transition-all"
                                                    >
                                                        <RefreshCw size={14} />
                                                    </button>
                                                    <button
                                                        onClick={() => handleDelete(doc.id)}
                                                        title="Delete"
                                                        className="p-1.5 rounded-lg hover:bg-red-500/15 text-red-400/60 hover:text-red-400 transition-all"
                                                    >
                                                        <Trash2 size={14} />
                                                    </button>
                                                </div>
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    )}
                </main>
        </div>
    )
}
