import { NextResponse, type NextRequest } from 'next/server';

/** Passes the requested path to server components, so the shell can send people back after sign-in. */
export function middleware(req: NextRequest) {
  const headers = new Headers(req.headers);
  headers.set('x-pathname', req.nextUrl.pathname + req.nextUrl.search);
  return NextResponse.next({ request: { headers } });
}

export const config = { matcher: ['/((?!api|_next|favicon.ico).*)'] };
