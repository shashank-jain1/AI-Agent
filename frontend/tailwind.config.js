/** @type {import('tailwindcss').Config} */
module.exports = {
    content: [
        './app/**/*.{js,ts,jsx,tsx,mdx}',
        './components/**/*.{js,ts,jsx,tsx,mdx}',
        './lib/**/*.{js,ts,jsx,tsx,mdx}',
    ],
    theme: {
        extend: {
            colors: {
                brand: {
                    blue: '#3B82F6',
                    violet: '#8B5CF6',
                    'blue-dark': '#1D4ED8',
                },
                surface: {
                    DEFAULT: '#0D0D1A',
                    card: 'rgba(255,255,255,0.04)',
                    border: 'rgba(255,255,255,0.10)',
                },
            },
            fontFamily: {
                syne: ['Syne', 'sans-serif'],
                inter: ['Inter', 'sans-serif'],
            },
            animation: {
                'pulse-slow': 'pulse-slow 3s ease-in-out infinite',
                'ring-expand': 'ring-expand 1.5s ease-out infinite',
                'spin-gradient': 'spin-gradient 1.2s linear infinite',
                'bar-bounce': 'bar-bounce 0.4s ease-in-out alternate infinite',
            },
            keyframes: {
                'pulse-slow': {
                    '0%, 100%': { transform: 'scale(1)', opacity: '0.9' },
                    '50%': { transform: 'scale(1.08)', opacity: '1' },
                },
                'ring-expand': {
                    '0%': { transform: 'scale(1)', opacity: '0.7' },
                    '100%': { transform: 'scale(2.5)', opacity: '0' },
                },
                'spin-gradient': {
                    '0%': { transform: 'rotate(0deg)' },
                    '100%': { transform: 'rotate(360deg)' },
                },
                'bar-bounce': {
                    '0%': { height: '8px' },
                    '100%': { height: '32px' },
                },
            },
        },
    },
    plugins: [],
}
