import { NextRequest, NextResponse } from 'next/server';
import * as cheerio from 'cheerio';

export const dynamic = 'force-dynamic';

interface SearchResult {
  title: string;
  link: string;
  snippet: string;
  displayLink: string;
  fileFormat?: string;
}

function cleanTitle(raw: string): string {
  let t = raw;
  t = t.replace(/\([^)]*\.(pdf|com|org|net|edu)[^)]*\)/gi, '');
  t = t.replace(/\[[^\]]*\.(pdf|com|org|net|edu)[^\]]*\]/gi, '');
  t = t.replace(/[-–—|_]+ *(PDFDrive|z-lib|libgen|pdf|download|free|online).*$/gi, '');
  t = t.replace(/\.(pdf|epub|djvu|zip)$/gi, '');
  t = t.replace(/\\?\(.*?\\?\)\.pdf/gi, '');
  t = t.replace(/[^a-zA-Z0-9\s:'.,!?&\-]/g, ' ');
  t = t.replace(/\s+/g, ' ').trim();
  return t || raw;
}

function isPdfUrl(url: string): boolean {
  const lower = url.toLowerCase();
  if (lower.includes('.pdf')) return true;
  const noQuery = lower.split('?')[0];
  if (noQuery.endsWith('.pdf')) return true;
  return false;
}

function shouldExclude(url: string, title: string): boolean {
  const lower = url.toLowerCase();
  if (lower.includes('google.com') || lower.includes('youtube.com')) return true;
  if (lower.includes('wikipedia.org') || lower.includes('reddit.com')) return true;
  if (lower.includes('facebook.com') || lower.includes('twitter.com')) return true;
  if (lower.includes('goodreads.com') && !lower.includes('.pdf')) return true;
  if (title.toLowerCase().includes('summary') && title.toLowerCase().includes('book')) return true;
  if (title.toLowerCase().includes('review') && !title.toLowerCase().includes('.pdf')) return true;
  return false;
}

async function scrapeDuckDuckGo(query: string): Promise<SearchResult[]> {
  const results: SearchResult[] = [];

  try {
    const url = `https://html.duckduckgo.com/html/?q=${encodeURIComponent(query)}`;
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

    $('.result__body').each((i, el) => {
      const linkEl = $(el).find('.result__a');
      const href = linkEl.attr('href') || '';
      const rawTitle = linkEl.text().trim();
      const snippet = $(el).find('.result__snippet').text().trim();

      let cleanUrl = '';
      try {
        if (href.includes('uddg=')) {
          const uddg = href.split('uddg=')[1].split('&')[0];
          cleanUrl = decodeURIComponent(uddg);
        } else if (href.startsWith('http')) {
          cleanUrl = href;
        }
      } catch { return; }

      if (!cleanUrl || !cleanUrl.startsWith('http')) return;

      if (!isPdfUrl(cleanUrl)) return;
      if (shouldExclude(cleanUrl, rawTitle)) return;

      let displayLink = '';
      try {
        displayLink = new URL(cleanUrl).hostname;
      } catch {
        displayLink = 'unknown';
      }

      const cleaned = cleanTitle(rawTitle);

      results.push({
        title: cleaned.substring(0, 200),
        link: cleanUrl,
        snippet: snippet.substring(0, 500),
        displayLink,
        fileFormat: 'PDF',
      });
    });

  } catch (err) {
    console.error('DuckDuckGo scrape error:', err);
  }

  return results;
}

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

  const queries = [
    `"${cleanTitle}" filetype:pdf book`,
    `"${cleanTitle}" PDF download full book`,
  ];

  if (author.trim()) {
    queries.push(`"${author.trim()}" "${cleanTitle}" PDF`);
  }

  for (const query of queries) {
    const results = await scrapeDuckDuckGo(query);

    for (const result of results) {
      const normalizedLink = result.link.toLowerCase().split('?')[0].split('#')[0];
      if (!seenLinks.has(normalizedLink)) {
        seenLinks.add(normalizedLink);
        allResults.push(result);
      }
    }

    if (allResults.length >= 8) break;
  }

  return NextResponse.json({
    results: allResults,
    totalFound: allResults.length,
    queriesExecuted: allResults.length >= 8 ? 1 : allResults.length >= 4 ? 2 : 3,
  });
}
