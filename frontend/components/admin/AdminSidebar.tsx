'use client'

import { useState } from 'react'
import { useRouter, usePathname } from 'next/navigation'
import { supabase } from '@/lib/supabase'
import { FileText, MessageSquare, BarChart2, LogOut, Menu, X } from 'lucide-react'

export function AdminSidebar() {
    const router = useRouter()
    const pathname = usePathname()
    const [isOpen, setIsOpen] = useState(false)

    const handleLogout = async () => {
        await supabase.auth.signOut()
        router.push('/admin')
    }

    const navItems = [
        { label: 'Dashboard', href: '/admin/dashboard', icon: BarChart2 },
        { label: 'Documents', href: '/admin/documents', icon: FileText },
        { label: 'FAQs', href: '/admin/faqs', icon: MessageSquare },
    ]

    return (
        <>
            {/* Mobile Header bar */}
            <div className="md:hidden flex items-center justify-between p-4 border-b border-white/[0.07] bg-[#070710] flex-shrink-0 z-40">
                <div className="flex items-center gap-2">
                    <span className="text-blue-400">◈</span>
                    <span className="text-white font-bold" style={{ fontFamily: 'Syne, sans-serif' }}>VoiceBot</span>
                </div>
                <button onClick={() => setIsOpen(true)} className="text-white/80 hover:text-white transition-colors">
                    <Menu size={24} />
                </button>
            </div>

            {/* Mobile Overlay */}
            {isOpen && (
                <div 
                    className="md:hidden fixed inset-0 bg-black/60 backdrop-blur-sm z-40 transition-opacity" 
                    onClick={() => setIsOpen(false)}
                />
            )}

            {/* Sidebar container */}
            <aside
                className={`fixed md:sticky top-0 left-0 h-screen w-64 md:w-56 flex-shrink-0 flex flex-col p-4 border-r border-white/[0.07] z-50 transition-transform duration-300 ease-in-out
                ${isOpen ? 'translate-x-0' : '-translate-x-full md:translate-x-0'}`}
                style={{ background: '#070710' }}
            >
                <div className="flex items-center justify-between gap-2 mb-8 px-2 pt-2">
                    <div className="flex items-center gap-2">
                        <span className="text-blue-400">◈</span>
                        <span className="text-white font-bold" style={{ fontFamily: 'Syne, sans-serif' }}>
                            VoiceBot
                        </span>
                    </div>
                    {/* Close button for mobile inside sidebar */}
                    <button className="md:hidden text-white/60 hover:text-white transition-colors" onClick={() => setIsOpen(false)}>
                        <X size={20} />
                    </button>
                </div>

                <div className="flex-1 flex flex-col">
                    {navItems.map(({ label, href, icon: Icon }) => {
                        const isActive = pathname === href
                        return (
                            <a
                                key={href}
                                href={href}
                                onClick={() => setIsOpen(false)}
                                className={`flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm mb-1 transition-all
                                    ${isActive ? 'bg-blue-600/20 text-blue-400' : 'text-white/60 hover:text-white hover:bg-white/5'}`}
                            >
                                <Icon size={16} />
                                {label}
                            </a>
                        )
                    })}
                </div>

                <div className="mt-auto">
                    <button
                        onClick={handleLogout}
                        className="flex items-center gap-3 px-3 py-2.5 rounded-xl text-white/40
                            hover:text-red-400 hover:bg-red-500/5 transition-all text-sm w-full"
                    >
                        <LogOut size={16} />
                        Sign Out
                    </button>
                </div>
            </aside>
        </>
    )
}
