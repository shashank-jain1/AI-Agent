'use client'

import { useState, FormEvent } from 'react'
import { useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabase'

export default function AdminLoginPage() {
    const [email, setEmail] = useState('')
    const [password, setPassword] = useState('')
    const [error, setError] = useState('')
    const [loading, setLoading] = useState(false)
    const router = useRouter()

    const handleLogin = async (e: FormEvent) => {
        e.preventDefault()
        setError('')
        setLoading(true)
        const { error } = await supabase.auth.signInWithPassword({ email, password })
        if (error) {
            setError(error.message)
        } else {
            router.push('/admin/dashboard')
        }
        setLoading(false)
    }

    return (
        <div
            className="min-h-screen flex items-center justify-center"
            style={{ background: '#070710' }}
        >
            <div
                className="w-full max-w-md p-8 rounded-2xl"
                style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.08)' }}
            >
                <div className="text-center mb-8">
                    <span className="text-blue-400 text-3xl">◈</span>
                    <h1
                        className="text-white text-2xl font-bold mt-2"
                        style={{ fontFamily: 'Syne, sans-serif' }}
                    >
                        Admin Portal
                    </h1>
                    <p className="text-white/40 text-sm mt-1">Sign in to manage documents &amp; FAQs</p>
                </div>

                <form onSubmit={handleLogin} className="flex flex-col gap-4">
                    <div>
                        <label className="text-white/60 text-xs mb-1.5 block">Email</label>
                        <input
                            type="email"
                            value={email}
                            onChange={(e) => setEmail(e.target.value)}
                            required
                            placeholder="admin@example.com"
                            className="w-full px-4 py-3 rounded-xl text-white/90 text-sm outline-none"
                            style={{
                                background: 'rgba(255,255,255,0.06)',
                                border: '1px solid rgba(255,255,255,0.10)',
                            }}
                        />
                    </div>

                    <div>
                        <label className="text-white/60 text-xs mb-1.5 block">Password</label>
                        <input
                            type="password"
                            value={password}
                            onChange={(e) => setPassword(e.target.value)}
                            required
                            placeholder="••••••••"
                            className="w-full px-4 py-3 rounded-xl text-white/90 text-sm outline-none"
                            style={{
                                background: 'rgba(255,255,255,0.06)',
                                border: '1px solid rgba(255,255,255,0.10)',
                            }}
                        />
                    </div>

                    {error && (
                        <p className="text-red-400 text-sm bg-red-500/10 px-3 py-2 rounded-lg">{error}</p>
                    )}

                    <button
                        type="submit"
                        disabled={loading}
                        className="w-full py-3 rounded-xl bg-blue-600 hover:bg-blue-500 text-white font-semibold
              text-sm transition-all disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                        {loading ? 'Signing in…' : 'Sign in'}
                    </button>
                </form>

                <p className="text-center text-white/20 text-xs mt-6">
                    <a href="/" className="hover:text-white/50 transition-colors">← Back to Voice Agent</a>
                </p>
            </div>
        </div>
    )
}
