import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'
import { createServerClient, type CookieOptions } from '@supabase/ssr'

export async function middleware(req: NextRequest) {
    let res = NextResponse.next({ request: { headers: req.headers } })

    // Only guard /admin routes
    if (!req.nextUrl.pathname.startsWith('/admin')) {
        return res
    }

    const supabase = createServerClient(
        process.env.NEXT_PUBLIC_SUPABASE_URL!,
        process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
        {
            cookies: {
                get(name: string) {
                    return req.cookies.get(name)?.value
                },
                set(name: string, value: string, options: CookieOptions) {
                    req.cookies.set({ name, value, ...options })
                    res = NextResponse.next({ request: { headers: req.headers } })
                    res.cookies.set({ name, value, ...options })
                },
                remove(name: string, options: CookieOptions) {
                    req.cookies.set({ name, value: '', ...options })
                    res = NextResponse.next({ request: { headers: req.headers } })
                    res.cookies.set({ name, value: '', ...options })
                },
            },
        }
    )

    const {
        data: { session },
    } = await supabase.auth.getSession()

    const isLoginPage = req.nextUrl.pathname === '/admin'

    // Not authenticated → redirect to admin login page
    if (!session && !isLoginPage) {
        const redirectUrl = req.nextUrl.clone()
        redirectUrl.pathname = '/admin'
        return NextResponse.redirect(redirectUrl)
    }

    // Already authenticated and on login page → redirect to dashboard
    if (session && isLoginPage) {
        const redirectUrl = req.nextUrl.clone()
        redirectUrl.pathname = '/admin/dashboard'
        return NextResponse.redirect(redirectUrl)
    }

    return res
}

export const config = {
    matcher: ['/admin/:path*'],
}
