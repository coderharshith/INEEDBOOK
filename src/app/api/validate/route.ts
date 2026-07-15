/**
 * PDF Validation API Route
 *
 * Server-side validation of remote PDF URLs. Performs:
 *   1. HEAD request for MIME type and file size checks
 *   2. Partial GET (first 8KB) for %PDF- magic byte verification
 *   3. Text extraction from header bytes for title content matching
 *   4. Size categorization (too-small / summary / short-book / full-book / large-book)
 *
 * @route GET /api/validate?url=<pdf_url>&title=<expected_title>
 */

import { NextRequest, NextResponse } from 'next/server';

/** Disable static caching — validation results should always be fresh */
export const dynamic = 'force-dynamic';

/** The %PDF- magic bytes used for file signature verification */
const PDF_MAGIC = [0x25, 0x50, 0x44, 0x46, 0x2D]; // %PDF-

/** Minimum file size in bytes for a real book PDF (500 KB) */
const MIN_SIZE_BOOK = 500000;

/** Minimum file size in bytes for a summary/excerpt (50 KB) */
const MIN_SIZE_SUMMARY = 50000;

/** Timeout in milliseconds for HTTP requests */
const TIMEOUT_MS = 15000;

/** GET handler — runs the full 4-step validation pipeline */
export async function GET(request: NextRequest) {
  const { searchParams } = request.nextUrl;
  const targetUrl = searchParams.get('url');
  const bookTitle = searchParams.get('title') || '';

  if (!targetUrl) {
    return NextResponse.json({ error: 'Missing URL parameter' }, { status: 400 });
  }

  try {
    // Step 1: HEAD request to check accessibility and MIME type
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), TIMEOUT_MS);

    const headRes = await fetch(targetUrl, {
      method: 'HEAD',
      signal: controller.signal,
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0.0.0 Safari/537.36',
      },
    });
    clearTimeout(timeout);

    if (!headRes.ok) {
      return NextResponse.json({
        valid: false,
        error: `HTTP ${headRes.status}: ${headRes.statusText}`,
      });
    }

    const contentType = headRes.headers.get('content-type') || '';
    const contentLength = headRes.headers.get('content-length');
    const acceptRanges = headRes.headers.get('accept-ranges');
    const fileSize = contentLength ? parseInt(contentLength, 10) : 0;

    // Check MIME type
    const validMime = contentType.includes('application/pdf') ||
                      contentType.includes('application/x-pdf') ||
                      contentType.includes('application/octet-stream');

    if (!validMime) {
      return NextResponse.json({
        valid: false,
        error: `Invalid content type: ${contentType}`,
        contentType,
        fileSize,
      });
    }

    // Step 2: Download first 8KB to verify PDF signature AND extract some text
    const controller2 = new AbortController();
    const timeout2 = setTimeout(() => controller2.abort(), TIMEOUT_MS);

    const rangeRes = await fetch(targetUrl, {
      method: 'GET',
      headers: {
        'Range': 'bytes=0-8191',
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0.0.0 Safari/537.36',
      },
      signal: controller2.signal,
    });
    clearTimeout(timeout2);

    if (!rangeRes.ok && rangeRes.status !== 206) {
      // If range not supported, still pass if MIME was pdf
      if (contentType.includes('application/pdf')) {
        return NextResponse.json({
          valid: true,
          contentType,
          fileSize,
          fileSizeFormatted: formatSize(fileSize),
          supportsRange: false,
          magicBytesVerified: false,
          contentMatch: 'unknown',
          sizeCategory: categorizeSize(fileSize),
        });
      }
      return NextResponse.json({
        valid: false,
        error: 'Cannot verify PDF signature',
      });
    }

    const buffer = await rangeRes.arrayBuffer();
    const bytes = new Uint8Array(buffer);
    const hasPdfSig = scanForSignature(bytes);

    if (!hasPdfSig) {
      return NextResponse.json({
        valid: false,
        error: 'No %PDF- signature found in file header',
        contentType,
        fileSize,
      });
    }

    // Step 3: Extract text from the PDF header bytes to check for title match
    const headerText = extractTextFromBytes(bytes);
    let contentMatch: 'strong' | 'weak' | 'none' | 'unknown' = 'unknown';
    
    if (bookTitle) {
      const titleWords = bookTitle.toLowerCase().split(/\s+/).filter(w => w.length > 2);
      const headerLower = headerText.toLowerCase();
      const matchingWords = titleWords.filter(w => headerLower.includes(w));
      const matchRatio = titleWords.length > 0 ? matchingWords.length / titleWords.length : 0;

      if (matchRatio >= 0.5) {
        contentMatch = 'strong';
      } else if (matchRatio > 0) {
        contentMatch = 'weak';
      } else {
        contentMatch = 'none';
      }
    }

    // Step 4: Size categorization for book PDFs
    const sizeCategory = categorizeSize(fileSize);

    return NextResponse.json({
      valid: hasPdfSig,
      contentType,
      fileSize,
      fileSizeFormatted: formatSize(fileSize),
      supportsRange: acceptRanges === 'bytes',
      magicBytesVerified: hasPdfSig,
      contentMatch,
      sizeCategory,
    });

  } catch (err: any) {
    return NextResponse.json({
      valid: false,
      error: err.name === 'AbortError' ? 'Timeout (15s)' : err.message,
    }, { status: 504 });
  }
}

/**
 * Scans a byte array for the %PDF- magic signature.
 * Checks up to the first 1024 bytes for the 5-byte pattern.
 */
function scanForSignature(bytes: Uint8Array): boolean {
  const limit = Math.min(bytes.length, 1024);
  for (let i = 0; i <= limit - PDF_MAGIC.length; i++) {
    let match = true;
    for (let j = 0; j < PDF_MAGIC.length; j++) {
      if (bytes[i + j] !== PDF_MAGIC[j]) { match = false; break; }
    }
    if (match) return true;
  }
  return false;
}

/**
 * Extracts printable ASCII strings from raw PDF header bytes.
 * Used to detect embedded metadata like /Title and /Author in the PDF header,
 * enabling content-based matching without loading the full document.
 */
function extractTextFromBytes(bytes: Uint8Array): string {
  // Extract printable ASCII strings from the PDF header
  // This can catch embedded metadata like /Title, /Author, etc.
  let text = '';
  let currentWord = '';
  for (let i = 0; i < bytes.length; i++) {
    const byte = bytes[i];
    if (byte >= 32 && byte <= 126) {
      currentWord += String.fromCharCode(byte);
    } else {
      if (currentWord.length > 2) {
        text += currentWord + ' ';
      }
      currentWord = '';
    }
  }
  if (currentWord.length > 2) text += currentWord;
  return text;
}

/** Formats a byte count into a human-readable string (e.g., "1.5 MB") */
function formatSize(bytes: number): string {
  if (bytes <= 0) return 'Unknown';
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

/**
 * Categorizes a file size into book quality tiers:
 *   - too-small: < 50KB (likely not a real book)
 *   - summary:   50KB–500KB (likely summary or excerpt)
 *   - short-book: 500KB–2MB (short or compressed book)
 *   - full-book: 2MB–20MB (typical full book)
 *   - large-book: > 20MB (large illustrated book)
 */
function categorizeSize(bytes: number): string {
  if (bytes <= 0) return 'unknown';
  if (bytes < 50000) return 'too-small';        // < 50KB: likely not a real book
  if (bytes < 500000) return 'summary';          // 50KB-500KB: likely summary/excerpt
  if (bytes < 2000000) return 'short-book';      // 500KB-2MB: short book or compressed
  if (bytes < 20000000) return 'full-book';      // 2MB-20MB: typical full book
  return 'large-book';                           // > 20MB: large illustrated book
}
