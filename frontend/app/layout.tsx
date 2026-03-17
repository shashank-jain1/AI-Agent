import type { Metadata } from 'next'
import './globals.css'

export const metadata: Metadata = {
    title: 'VoiceBot — AI Voice Assistant',
    description: 'Multilingual RAG AI Voice Assistant. Ask questions in Hindi or English and get instant, document-grounded answers.',
    keywords: ['AI', 'voice assistant', 'RAG', 'Hindi', 'English', 'chatbot'],
    openGraph: {
        title: 'VoiceBot — AI Voice Assistant',
        description: 'Multilingual RAG AI Voice Assistant',
        type: 'website',
    },
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
    return (
        <html lang="en" className="dark">
            <body>{children}</body>
        </html>
    )
}
