/**
 * CORS Proxy Route for Remote PDF Files
 *
 * Proxies requests to external PDF URLs, bypassing browser CORS restrictions.
 * Forwards Range headers for partial content requests (needed by PDF.js).
 * Adds CORS headers to allow the client-side PDF viewer to load the content.
 *
 * @route GET /api/proxy?url=<target_url>
 * @route HEAD /api/proxy?url=<target_url>
 * @route OPTIONS /api/proxy (CORS preflight)
 */

import { NextRequest, NextResponse } from 'next/server';

/** Disable static caching — proxy requests are always forwarded fresh */
export const dynamic = 'force-dynamic';

/**
 * GET handler — proxies the full PDF content (or partial via Range header).
 * Validates the target URL protocol, forwards relevant headers, and streams
 * the upstream response back to the client with CORS headers.
 */
export async function GET(request: NextRequest) {
  const { searchParams } = request.nextUrl;
  const targetUrl = searchParams.get('url');

  if (!targetUrl) {
    return NextResponse.json({ error: 'Missing target URL parameter' }, { status: 400 });
  }

  try {
    const parsedUrl = new URL(targetUrl);
    if (!['http:', 'https:'].includes(parsedUrl.protocol)) {
      return NextResponse.json({ error: 'Forbidden protocol scheme' }, { status: 400 });
    }
  } catch {
    return NextResponse.json({ error: 'Malformed target URL' }, { status: 400 });
  }

  const clientHeaders = new Headers();
  const incomingRange = request.headers.get('range');
  
  if (incomingRange) {
    clientHeaders.set('Range', incomingRange);
  }
  
  clientHeaders.set('User-Agent', 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) Web Discovery Engine');

  try {
    const upstreamResponse = await fetch(targetUrl, {
      method: 'GET',
      headers: clientHeaders,
      next: { revalidate: 0 }
    });

    if (!upstreamResponse.body) {
      return new Response(null, { status: upstreamResponse.status });
    }

    const responseHeaders = new Headers();
    
    const copyHeaders = [
      'content-type',
      'content-length',
      'content-range',
      'accept-ranges',
      'etag',
      'last-modified'
    ];

    copyHeaders.forEach(header => {
      const val = upstreamResponse.headers.get(header);
      if (val) responseHeaders.set(header, val);
    });

    responseHeaders.set('Access-Control-Allow-Origin', '*');
    responseHeaders.set('Access-Control-Allow-Methods', 'GET, HEAD, OPTIONS');
    responseHeaders.set('Access-Control-Allow-Headers', 'Range, Content-Type');
    responseHeaders.set('Access-Control-Expose-Headers', 'Accept-Ranges, Content-Encoding, Content-Length, Content-Range');

    if (upstreamResponse.status === 206) {
      return new Response(upstreamResponse.body, {
        status: 206,
        statusText: 'Partial Content',
        headers: responseHeaders,
      });
    }

    return new Response(upstreamResponse.body, {
      status: upstreamResponse.status,
      headers: responseHeaders,
    });

  } catch (error: any) {
    return NextResponse.json(
      { error: 'Failed to fetch upstream PDF resource', details: error.message },
      { status: 502 }
    );
  }
}

/**
 * HEAD handler — returns upstream headers without downloading the body.
 * Used by the validation pipeline to check file size and MIME type.
 */
export async function HEAD(request: NextRequest) {
  const { searchParams } = request.nextUrl;
  const targetUrl = searchParams.get('url');

  if (!targetUrl) {
    return NextResponse.json({ error: 'Missing target URL' }, { status: 400 });
  }

  try {
    const upstreamResponse = await fetch(targetUrl, {
      method: 'HEAD',
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) Web Discovery Engine',
      },
    });

    const responseHeaders = new Headers();
    ['content-type', 'content-length', 'accept-ranges', 'etag', 'last-modified'].forEach(h => {
      const val = upstreamResponse.headers.get(h);
      if (val) responseHeaders.set(h, val);
    });
    responseHeaders.set('Access-Control-Allow-Origin', '*');
    responseHeaders.set('Access-Control-Expose-Headers', 'Accept-Ranges, Content-Length, Content-Type');

    return new Response(null, {
      status: upstreamResponse.status,
      headers: responseHeaders,
    });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 502 });
  }
}

/**
 * OPTIONS handler — responds to CORS preflight requests.
 * Allows any origin to access the proxy endpoint.
 */
export async function OPTIONS() {
  const preflightHeaders = new Headers({
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'GET, HEAD, OPTIONS',
    'Access-Control-Allow-Headers': 'Range, Content-Type',
    'Access-Control-Max-Age': '86400',
  });
  return new Response(null, { status: 204, headers: preflightHeaders });
}
