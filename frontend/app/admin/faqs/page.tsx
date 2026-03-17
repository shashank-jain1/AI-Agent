'use client'

import { useEffect, useState, FormEvent } from 'react'
import { useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabase'
import { listFAQs, createFAQ, updateFAQ, deleteFAQ, FAQ } from '@/lib/api'
import { Plus, Pencil, Trash2, Check, X, Loader2 } from 'lucide-react'
import { AdminSidebar } from '@/components/admin/AdminSidebar'

interface EditState {
    id: string | null
    question: string
    answer: string
}

export default function FAQsPage() {
    const router = useRouter()
    const [token, setToken] = useState('')
    const [faqs, setFaqs] = useState<FAQ[]>([])
    const [loading, setLoading] = useState(true)
    const [saving, setSaving] = useState(false)
    const [edit, setEdit] = useState<EditState>({ id: null, question: '', answer: '' })
    const [showForm, setShowForm] = useState(false)

    useEffect(() => {
        const init = async () => {
            const { data: { session } } = await supabase.auth.getSession()
            if (!session) { router.push('/admin'); return }
            setToken(session.access_token)
            const data = await listFAQs()
            setFaqs(data)
            setLoading(false)
        }
        init()
    }, [])

    const resetForm = () => {
        setEdit({ id: null, question: '', answer: '' })
        setShowForm(false)
    }

    const handleSubmit = async (e: FormEvent) => {
        e.preventDefault()
        if (!edit.question.trim() || !edit.answer.trim()) return
        setSaving(true)
        try {
            if (edit.id) {
                const updated = await updateFAQ(edit.id, edit.question, edit.answer, token)
                setFaqs((prev) => prev.map((f) => (f.id === edit.id ? updated : f)))
            } else {
                const created = await createFAQ(edit.question, edit.answer, token)
                setFaqs((prev) => [created, ...prev])
            }
            resetForm()
        } catch (err: any) {
            alert(`Error: ${err.message}`)
        }
        setSaving(false)
    }

    const handleDelete = async (id: string) => {
        if (!confirm('Delete this FAQ?')) return
        await deleteFAQ(id, token)
        setFaqs((prev) => prev.filter((f) => f.id !== id))
    }

    const startEdit = (faq: FAQ) => {
        setEdit({ id: faq.id, question: faq.question, answer: faq.answer })
        setShowForm(true)
    }

    return (
        <div className="flex h-screen flex-col md:flex-row" style={{ background: '#070710' }}>
            <AdminSidebar />

            {/* Main */}
            <main className="flex-1 p-5 md:p-8 overflow-y-auto w-full relative">
                    <div className="flex items-center justify-between mb-6">
                        <div>
                            <h1 className="text-white text-2xl font-bold" style={{ fontFamily: 'Syne, sans-serif' }}>
                                FAQs
                            </h1>
                            <p className="text-white/40 text-sm mt-1">
                                Add frequently asked questions — they'll be embedded and searchable instantly.
                            </p>
                        </div>
                        <button
                            onClick={() => { resetForm(); setShowForm(true) }}
                            className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-blue-600 hover:bg-blue-500
                text-white text-sm font-medium transition-all"
                        >
                            <Plus size={16} />
                            Add FAQ
                        </button>
                    </div>

                    {/* Form */}
                    {showForm && (
                        <form
                            onSubmit={handleSubmit}
                            className="mb-8 p-5 rounded-2xl"
                            style={{ background: 'rgba(59,130,246,0.06)', border: '1px solid rgba(59,130,246,0.20)' }}
                        >
                            <h2 className="text-white/80 text-sm font-semibold mb-4">
                                {edit.id ? 'Edit FAQ' : 'New FAQ'}
                            </h2>
                            <div className="flex flex-col gap-3">
                                <div>
                                    <label className="text-white/50 text-xs mb-1 block">Question</label>
                                    <input
                                        value={edit.question}
                                        onChange={(e) => setEdit((prev) => ({ ...prev, question: e.target.value }))}
                                        placeholder="What is…?"
                                        required
                                        className="w-full px-4 py-2.5 rounded-xl text-white/90 text-sm outline-none"
                                        style={{ background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.10)' }}
                                    />
                                </div>
                                <div>
                                    <label className="text-white/50 text-xs mb-1 block">Answer</label>
                                    <textarea
                                        value={edit.answer}
                                        onChange={(e) => setEdit((prev) => ({ ...prev, answer: e.target.value }))}
                                        placeholder="The answer is…"
                                        required
                                        rows={4}
                                        className="w-full px-4 py-2.5 rounded-xl text-white/90 text-sm outline-none resize-y"
                                        style={{ background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.10)' }}
                                    />
                                </div>
                                <div className="flex gap-2 justify-end">
                                    <button type="button" onClick={resetForm}
                                        className="flex items-center gap-1.5 px-3 py-2 rounded-lg text-white/50 hover:text-white text-sm transition-all">
                                        <X size={14} /> Cancel
                                    </button>
                                    <button type="submit" disabled={saving}
                                        className="flex items-center gap-1.5 px-4 py-2 rounded-lg bg-blue-600 hover:bg-blue-500
                      text-white text-sm transition-all disabled:opacity-50">
                                        {saving ? <Loader2 size={14} className="animate-spin" /> : <Check size={14} />}
                                        {saving ? 'Saving…' : 'Save'}
                                    </button>
                                </div>
                            </div>
                        </form>
                    )}

                    {/* FAQ list */}
                    {loading ? (
                        <div className="text-white/30 text-sm">Loading FAQs…</div>
                    ) : faqs.length === 0 ? (
                        <div className="text-center py-16 text-white/20 text-sm">
                            No FAQs yet. Add your first one above.
                        </div>
                    ) : (
                        <div className="flex flex-col gap-3">
                            {faqs.map((faq) => (
                                <div
                                    key={faq.id}
                                    className="p-4 rounded-xl"
                                    style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.07)' }}
                                >
                                    <div className="flex items-start justify-between gap-4">
                                        <div className="flex-1 min-w-0">
                                            <p className="text-white/90 text-sm font-medium mb-1.5">{faq.question}</p>
                                            <p className="text-white/50 text-sm leading-relaxed">{faq.answer}</p>
                                        </div>
                                        <div className="flex gap-1.5 flex-shrink-0">
                                            <button onClick={() => startEdit(faq)}
                                                className="p-1.5 rounded-lg hover:bg-blue-500/15 text-blue-400/60 hover:text-blue-400 transition-all">
                                                <Pencil size={14} />
                                            </button>
                                            <button onClick={() => handleDelete(faq.id)}
                                                className="p-1.5 rounded-lg hover:bg-red-500/15 text-red-400/60 hover:text-red-400 transition-all">
                                                <Trash2 size={14} />
                                            </button>
                                        </div>
                                    </div>
                                </div>
                            ))}
                        </div>
                    )}
                </main>
        </div>
    )
}
