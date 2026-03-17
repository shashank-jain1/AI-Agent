'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabase'
import { getAutoDictate, setAutoDictate } from '@/lib/api'
import { FileText, MessageSquare, BarChart2, Activity, Volume2 } from 'lucide-react'
import { AdminSidebar } from '@/components/admin/AdminSidebar'

function StatCard({ icon: Icon, label, value, color }: any) {
    return (
        <div
            className="p-5 rounded-2xl flex items-center gap-4"
            style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.08)' }}
        >
            <div
                className="w-12 h-12 rounded-xl flex items-center justify-center"
                style={{ background: `${color}22` }}
            >
                <Icon size={22} style={{ color }} />
            </div>
            <div>
                <p className="text-white/40 text-xs">{label}</p>
                <p className="text-white text-2xl font-bold" style={{ fontFamily: 'Syne, sans-serif' }}>
                    {value ?? '—'}
                </p>
            </div>
        </div>
    )
}

export default function DashboardPage() {
    const router = useRouter()
    const [stats, setStats] = useState({
        total_docs: 0,
        indexed_docs: 0,
        total_faqs: 0,
        today_queries: 0,
    })
    const [autoDictate, setAutoDictateState] = useState(true)
    const [loading, setLoading] = useState(true)

    useEffect(() => {
        const fetchStats = async () => {
            const {
                data: { session },
            } = await supabase.auth.getSession()
            if (!session) {
                router.push('/admin')
                return
            }

            try {
                const [docsRes, faqsRes, queriesRes, dictateRes] = await Promise.all([
                    supabase.from('documents').select('status', { count: 'exact' }),
                    supabase.from('faqs').select('id', { count: 'exact' }).eq('is_active', true),
                    supabase
                        .from('query_logs')
                        .select('id', { count: 'exact' })
                        .gte('created_at', new Date(Date.now() - 86400000).toISOString()),
                    getAutoDictate()
                ])

                const total_docs = docsRes.count ?? 0
                const indexed_docs =
                    (docsRes.data?.filter((d) => d.status === 'indexed') ?? []).length
                const total_faqs = faqsRes.count ?? 0
                const today_queries = queriesRes.count ?? 0

                setStats({ total_docs, indexed_docs, total_faqs, today_queries })
                setAutoDictateState(dictateRes)
            } catch (e) {
                console.error('Stats fetch failed:', e)
            }
            setLoading(false)
        }
        fetchStats()
    }, [router])

    const handleLogout = async () => {
        await supabase.auth.signOut()
        router.push('/admin')
    }

    const toggleAutoDictate = async () => {
        try {
            const newVal = !autoDictate
            setAutoDictateState(newVal)
            await setAutoDictate(newVal)
        } catch (e) {
            console.error('Failed to toggle auto dictate', e)
            setAutoDictateState(autoDictate) // revert
        }
    }

    return (
        <div className="flex h-screen flex-col md:flex-row" style={{ background: '#070710' }}>
            <AdminSidebar />

            {/* ── Main ── */}
            <main className="flex-1 p-5 md:p-8 overflow-y-auto w-full relative">
                    <h1
                        className="text-white text-2xl font-bold mb-2"
                        style={{ fontFamily: 'Syne, sans-serif' }}
                    >
                        Dashboard
                    </h1>
                    <p className="text-white/40 text-sm mb-8">Overview of your VoiceBot knowledge base</p>

                    {loading ? (
                        <div className="text-white/30 text-sm">Loading stats…</div>
                    ) : (
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 max-w-2xl">
                            <StatCard icon={FileText} label="Total Documents" value={stats.total_docs} color="#3B82F6" />
                            <StatCard icon={Activity} label="Indexed" value={stats.indexed_docs} color="#22C55E" />
                            <StatCard icon={MessageSquare} label="Active FAQs" value={stats.total_faqs} color="#8B5CF6" />
                            <StatCard icon={BarChart2} label="Queries Today" value={stats.today_queries} color="#F59E0B" />
                        </div>
                    )}

                    <h2 className="text-white text-lg font-bold mt-10 mb-4" style={{ fontFamily: 'Syne, sans-serif' }}>Global Settings</h2>
                    <div className="flex items-center justify-between p-5 rounded-2xl max-w-2xl bg-white/[0.04] border border-white/[0.08]">
                        <div className="flex items-center gap-4">
                            <div className="w-10 h-10 rounded-xl flex items-center justify-center bg-blue-500/10">
                                <Volume2 size={18} className="text-blue-400" />
                            </div>
                            <div>
                                <p className="text-white font-medium text-sm">Auto-Dictate Answers</p>
                                <p className="text-white/40 text-xs mt-0.5">VoiceBot will automatically speak its replies when enabled</p>
                            </div>
                        </div>
                        <button
                            onClick={toggleAutoDictate}
                            className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors focus:outline-none ${autoDictate ? 'bg-blue-600' : 'bg-white/10'}`}
                        >
                            <span className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${autoDictate ? 'translate-x-6' : 'translate-x-1'}`} />
                        </button>
                    </div>

                    <div className="mt-8 flex flex-wrap gap-4 pb-8">
                        <a
                            href="/admin/documents"
                            className="px-4 py-2.5 rounded-xl bg-blue-600 hover:bg-blue-500 
                text-white text-sm font-medium transition-all text-center flex-1 sm:flex-none"
                        >
                            Upload Documents →
                        </a>
                        <a
                            href="/admin/faqs"
                            className="px-4 py-2.5 rounded-xl text-white/60 hover:text-white 
                text-sm transition-all text-center flex-1 sm:flex-none"
                            style={{ border: '1px solid rgba(255,255,255,0.10)' }}
                        >
                            Manage FAQs →
                        </a>
                    </div>
                </main>
        </div>
    )
}
