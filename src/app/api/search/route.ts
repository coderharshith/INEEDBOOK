/**
 * Brave Search Scraper Route
 *
 * Scrapes Brave Search results for PDF links matching the query.
 * Executes multiple query variants (filetype:pdf, quoted title, author-specific)
 * to maximize discovery of relevant PDF sources. Deduplicates results by URL.
 *
 * @route GET /api/search?title=<title>&author=<author>&isbn=<isbn>
 */

import { NextRequest, NextResponse } from 'next/server';
import * as cheerio from 'cheerio';

/** Disable static caching — search results are always fresh */
export const dynamic = 'force-dynamic';

/** A single PDF search result extracted from Brave Search HTML */
interface SearchResult {
  title: string;
  link: string;
  snippet: string;
  displayLink: string;
  fileFormat?: string;
}

/**
 * Scrapes Brave Search results for a given query.
 * Uses two extraction methods:
 *   1. Cheerio-based HTML parsing of anchor elements containing .pdf URLs
 *   2. Regex fallback to extract any PDF URLs missed by the HTML parser
 *
 * @param query - The search query string
 * @returns Array of SearchResult objects with PDF links
 */
async function scrapeBraveSearch(query: string): Promise<SearchResult[]> {
  const results: SearchResult[] = [];

  try {
    const url = `https://search.brave.com/search?q=${encodeURIComponent(query)}`;
    const response = await fetch(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0.0.0 Safari/537.36',
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
        'Accept-Language': 'en-US,en;q=0.9',
      },
      next: { revalidate: 0 }
    });

    if (!response.ok) return results;

    const html = await response.text();
    const $ = cheerio.load(html);

    // Method 1: Parse structured search results
    $('a[href]').each((i, el) => {
      const href = $(el).attr('href') || '';
      
      // Skip Brave internal links
      if (href.includes('brave.com') || href.startsWith('/') || href.startsWith('#')) return;
      
      // Only want external PDF links
      if (!href.toLowerCase().includes('.pdf')) return;

      let cleanUrl = href;
      try {
        const parsed = new URL(href);
        cleanUrl = parsed.href;
      } catch {
        return;
      }

      const linkText = $(el).text().trim();
      if (!linkText || linkText.length < 3) return;

      // Get snippet from parent or sibling elements
      let snippet = '';
      const card = $(el).closest('[class*="snippet"]');
      if (card.length) {
        snippet = card.find('[class*="description"], [class*="body"], p').first().text().trim();
      }
      if (!snippet) {
        // Try to get surrounding text
        const parent = $(el).parent();
        const nextP = parent.find('p, span[class*="desc"]').first();
        if (nextP.length) snippet = nextP.text().trim();
      }

      let displayLink = '';
      try {
        displayLink = new URL(cleanUrl).hostname;
      } catch {
        displayLink = 'unknown';
      }

      results.push({
        title: linkText.substring(0, 200),
        link: cleanUrl,
        snippet: snippet.substring(0, 500),
        displayLink,
        fileFormat: 'PDF',
      });
    });

    // Method 2: Fallback — extract all PDF URLs via regex if cheerio missed them
    if (results.length < 3) {
      const linkRegex = /href="(https?:\/\/[^"]+\.pdf[^"]*)"/gi;
      let match;
      const seenInFallback = new Set(results.map(r => r.link));
      
      while ((match = linkRegex.exec(html)) !== null) {
        let pdfUrl = match[1];
        if (pdfUrl.includes('brave.com')) continue;

        try {
          pdfUrl = decodeURIComponent(pdfUrl);
        } catch { /* keep original */ }

        if (seenInFallback.has(pdfUrl)) continue;
        seenInFallback.add(pdfUrl);

        let displayLink = '';
        try {
          displayLink = new URL(pdfUrl).hostname;
        } catch {
          displayLink = 'unknown';
        }

        // Extract a title from the URL path
        const pathParts = pdfUrl.split('/');
        const filename = pathParts[pathParts.length - 1]
          .replace('.pdf', '')
          .replace(/[_+%20-]+/g, ' ')
          .trim();

        results.push({
          title: `PDF ${filename || 'Document'}`,
          link: pdfUrl,
          snippet: '',
          displayLink,
          fileFormat: 'PDF',
        });
      }
    }

  } catch (err) {
    console.error('Brave scrape error:', err);
  }

  return results;
}

/**
 * GET handler for /api/search
 * Executes up to 3 search queries with increasing specificity and returns
 * deduplicated results sorted by relevance.
 */
export async function GET(request: NextRequest) {
  const { searchParams } = request.nextUrl;
  const title = searchParams.get('title') || '';
  const author = searchParams.get('author') || '';
  const isbn = searchParams.get('isbn') || '';

  if (!title.trim()) {
    return NextResponse.json({ error: 'Missing book title' }, { status: 400 });
  }

  const cleanTitle = title.trim();
  const allResults: SearchResult[] = [];
  const seenLinks = new Set<string>();

  // Primary query: best single search for finding book PDFs
  const primaryQuery = `${cleanTitle} filetype:pdf`;
  const primaryResults = await scrapeBraveSearch(primaryQuery);

  for (const result of primaryResults) {
    const normalizedLink = result.link.toLowerCase().split('?')[0].split('#')[0];
    if (!seenLinks.has(normalizedLink)) {
      seenLinks.add(normalizedLink);
      allResults.push(result);
    }
  }

  // If we got fewer than 5 results, try a second query
  if (allResults.length < 5) {
    const secondQuery = `"${cleanTitle}" PDF download book`;
    const secondResults = await scrapeBraveSearch(secondQuery);

    for (const result of secondResults) {
      const normalizedLink = result.link.toLowerCase().split('?')[0].split('#')[0];
      if (!seenLinks.has(normalizedLink)) {
        seenLinks.add(normalizedLink);
        allResults.push(result);
      }
    }
  }

  // Author-specific query if provided
  if (allResults.length < 3 && author.trim()) {
    const authorQuery = `${author.trim()} "${cleanTitle}" PDF`;
    const authorResults = await scrapeBraveSearch(authorQuery);

    for (const result of authorResults) {
      const normalizedLink = result.link.toLowerCase().split('?')[0].split('#')[0];
      if (!seenLinks.has(normalizedLink)) {
        seenLinks.add(normalizedLink);
        allResults.push(result);
      }
    }
  }

  return NextResponse.json({
    results: allResults,
    totalFound: allResults.length,
    queriesExecuted: allResults.length >= 5 ? 1 : allResults.length >= 3 ? 2 : 3,
  });
}
