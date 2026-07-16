/**
 * Google Books API Proxy Route
 *
 * Fetches canonical book metadata (title, authors, page count, description)
 * from the Google Books API. Used to validate search results against the
 * official edition and display metadata to the user.
 *
 * @route GET /api/books?q=<search_query>
 */

import { NextRequest, NextResponse } from 'next/server';

/** Disable static caching — always fetch fresh data from Google Books */
export const dynamic = 'force-dynamic';

/**
 * GET handler for /api/books
 * Queries Google Books API and returns the first result's volume info.
 */
export async function GET(request: NextRequest) {
  const { searchParams } = request.nextUrl;
  const q = searchParams.get('q');

  if (!q) {
    return NextResponse.json({ error: 'Missing query parameter' }, { status: 400 });
  }

  try {
    const response = await fetch(`https://www.googleapis.com/books/v1/volumes?q=${encodeURIComponent(q)}&maxResults=1`);
    if (!response.ok) {
      throw new Error('Failed to fetch from Google Books API');
    }

    const data = await response.json();
    if (data.items && data.items.length > 0) {
      const volumeInfo = data.items[0].volumeInfo;
      return NextResponse.json({
        title: volumeInfo.title || '',
        authors: volumeInfo.authors || [],
        publisher: volumeInfo.publisher || 'Unknown',
        publishedDate: volumeInfo.publishedDate || 'Unknown',
        pageCount: volumeInfo.pageCount || 0,
        description: volumeInfo.description || '',
        categories: volumeInfo.categories || [],
        imageLinks: volumeInfo.imageLinks || null,
      });
    }

    return NextResponse.json({ error: 'No canonical book found' }, { status: 404 });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
