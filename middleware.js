import { NextResponse } from 'next/server';

export function middleware(request) {
  const { pathname } = request.nextUrl;

  // Pass through static files, API routes, Next internals
  if (
    pathname.startsWith('/api/') ||
    pathname.startsWith('/_next/') ||
    pathname.startsWith('/favicon') ||
    pathname.match(/\.(png|jpg|jpeg|gif|svg|ico|css|js|webp|woff|woff2|ttf|json|html)$/)
  ) {
    return NextResponse.next();
  }

  // Root → index.html
  if (pathname === '/') {
    const url = request.nextUrl.clone();
    url.pathname = '/index.html';
    return NextResponse.rewrite(url);
  }

  // /player/slug → player.html
  if (pathname.startsWith('/player/')) {
    const url = request.nextUrl.clone();
    url.pathname = '/player.html';
    return NextResponse.rewrite(url);
  }

  return NextResponse.next();
}

export const config = {
  matcher: ['/((?!_next/static|_next/image).*)'],
};
