/**
 * PDF Processing Engine
 *
 * Client-side PDF processing using PDF.js for:
 * - Document loading via optional CORS proxy
 * - Metadata extraction (title, author, page count)
 * - Table of contents / outline extraction
 * - TOC page heuristic detection
 * - Cover image rasterization
 * - Full-page canvas rendering for the reader view
 *
 * @module pdf-processor
 */

import * as pdfjsLib from 'pdfjs-dist';
import type { PDFDocumentProxy } from 'pdfjs-dist';

// ─── Types ───────────────────────────────────────────────────────────────────

/** Extracted book metadata from the PDF document */
export interface BookMetadata {
  title: string;
  author: string;
  totalPages: number;
  fileSize: string;
  pdfUrl: string;
}

/** A single entry in the table of contents */
export interface TOCItem {
  title: string;
  pageNumber: number;
  depth: number;
}

/** Combined result of the full document processing pipeline */
export interface ProcessingResult {
  metadata: BookMetadata;
  tableOfContents: TOCItem[];
  coverImageBase64: string;
  indexPageNumber: number;
}

// ─── Worker Configuration ────────────────────────────────────────────────────

/** Tracks whether the PDF.js worker has been configured to avoid duplicate setup */
let workerConfigured = false;

/**
 * Configures the PDF.js web worker for client-side PDF rendering.
 * Must be called before any PDF loading. Idempotent (safe to call multiple times).
 */
export function configurePdfWorker() {
  if (workerConfigured) return;
  pdfjsLib.GlobalWorkerOptions.workerSrc = '/pdf.worker.min.mjs';
  workerConfigured = true;
}

// ─── Load PDF Document ───────────────────────────────────────────────────────

/**
 * Loads a PDF document from a URL, optionally routing through a CORS proxy.
 * Disables auto-fetch to allow lazy loading of individual pages.
 *
 * @param pdfUrl - Direct URL to the PDF file
 * @param proxyBaseUrl - Optional base URL of the CORS proxy server
 * @returns Promise resolving to a PDFDocumentProxy
 */
export async function loadPdfDocument(pdfUrl: string, proxyBaseUrl: string = ''): Promise<PDFDocumentProxy> {
  configurePdfWorker();
  
  const proxiedUrl = proxyBaseUrl
    ? `${proxyBaseUrl}/api/proxy?url=${encodeURIComponent(pdfUrl)}`
    : pdfUrl;

  const loadingTask = pdfjsLib.getDocument({
    url: proxiedUrl,
    disableAutoFetch: true,
    disableStream: false,
  });

  return loadingTask.promise;
}

// ─── Extract Metadata ────────────────────────────────────────────────────────

/**
 * Extracts metadata from the PDF document object.
 * Falls back to URL-based title extraction if the PDF has no embedded title.
 *
 * @param pdfDoc - The loaded PDF document proxy
 * @param pdfUrl - The source URL (used as fallback for title)
 * @param fileSizeStr - Pre-formatted file size string
 * @returns BookMetadata with title, author, page count, and file info
 */
export async function extractMetadata(
  pdfDoc: PDFDocumentProxy,
  pdfUrl: string,
  fileSizeStr: string
): Promise<BookMetadata> {
  const metadata = await pdfDoc.getMetadata();
  const info = (metadata?.info as any) || {};

  return {
    title: info.Title || extractTitleFromUrl(pdfUrl),
    author: info.Author || 'Unknown Author',
    totalPages: pdfDoc.numPages,
    fileSize: fileSizeStr,
    pdfUrl,
  };
}

/**
 * Derives a human-readable title from a PDF URL by extracting the filename,
 * removing the .pdf extension, and replacing underscores/dashes with spaces.
 */
function extractTitleFromUrl(url: string): string {
  try {
    const pathname = new URL(url).pathname;
    const filename = pathname.split('/').pop() || '';
    return decodeURIComponent(filename)
      .replace(/\.pdf$/i, '')
      .replace(/[_-]/g, ' ')
      .replace(/\s+/g, ' ')
      .trim() || 'Untitled Document';
  } catch {
    return 'Untitled Document';
  }
}

// ─── Extract Table of Contents ───────────────────────────────────────────────

/**
 * Extracts the table of contents (outline) from a PDF document.
 * Resolves named destinations and page references into concrete page numbers.
 *
 * @param pdfDoc - The loaded PDF document proxy
 * @returns Array of TOCItem objects with title, page number, and nesting depth
 */
export async function extractTableOfContents(pdfDoc: PDFDocumentProxy): Promise<TOCItem[]> {
  const flatTOC: TOCItem[] = [];

  try {
    const outline = await pdfDoc.getOutline();
    if (outline && outline.length > 0) {
      await resolveOutlineNodes(pdfDoc, outline, 0, flatTOC);
    }
  } catch (err) {
    console.warn('Failed to extract outline:', err);
  }

  return flatTOC;
}

/**
 * Recursively resolves outline nodes into a flat TOCItem list.
 * Handles both named string destinations and direct page reference arrays.
 */
async function resolveOutlineNodes(
  pdfDoc: PDFDocumentProxy,
  nodes: any[],
  depth: number,
  outputList: TOCItem[]
): Promise<void> {
  for (const node of nodes) {
    let resolvedPageNum = -1;

    if (node.dest) {
      try {
        let destArr = node.dest;

        // If destination is a named string, resolve it
        if (typeof node.dest === 'string') {
          destArr = await pdfDoc.getDestination(node.dest);
        }

        if (destArr && destArr.length > 0) {
          const pageRef = destArr[0];
          if (pageRef && typeof pageRef === 'object') {
            const pageIndex = await pdfDoc.getPageIndex(pageRef);
            resolvedPageNum = pageIndex + 1; // Convert 0-indexed to 1-indexed
          }
        }
      } catch {
        resolvedPageNum = -1;
      }
    }

    if (resolvedPageNum > 0) {
      outputList.push({
        title: node.title || 'Untitled Section',
        pageNumber: resolvedPageNum,
        depth,
      });
    }

    // Recurse into children
    if (node.items && node.items.length > 0) {
      await resolveOutlineNodes(pdfDoc, node.items, depth + 1, outputList);
    }
  }
}

// ─── Find TOC Page by Heuristic Text Search ──────────────────────────────────

/**
 * Scans the first 25 pages of the PDF looking for a "Table of Contents" heading
 * using common patterns (Contents, Index, Chapter N, Part N).
 * Returns the page number where the TOC starts, defaulting to page 1.
 *
 * @param pdfDoc - The loaded PDF document proxy
 * @returns The 1-indexed page number where the TOC begins
 */
export async function findTOCPageIndex(pdfDoc: PDFDocumentProxy): Promise<number> {
  const scanLimit = Math.min(pdfDoc.numPages, 25);
  const tocPatterns = [
    /^(?:contents|table\s+of\s+contents)\b/i,
    /^(?:index|toc)\b/i,
    /^(?:chapter\s+\d|part\s+\d)/i,
  ];

  for (let pageNum = 1; pageNum <= scanLimit; pageNum++) {
    try {
      const page = await pdfDoc.getPage(pageNum);
      const content = await page.getTextContent();
      const textLines = content.items.map((item: any) => item.str.trim()).filter(Boolean);

      for (const line of textLines) {
        for (const pattern of tocPatterns) {
          if (pattern.test(line)) {
            return pageNum;
          }
        }
      }
    } catch {
      continue;
    }
  }

  return 1; // Default to first page
}

// ─── Render Page to Canvas ───────────────────────────────────────────────────

/**
 * Renders a specific PDF page onto an HTML canvas element.
 * Used by the reader view for full-page display.
 *
 * @param pdfDoc - The loaded PDF document proxy
 * @param pageNumber - 1-indexed page number to render
 * @param canvas - Target HTML canvas element
 * @param scale - Render scale factor (default: 1.5)
 */
export async function renderPageToCanvas(
  pdfDoc: PDFDocumentProxy,
  pageNumber: number,
  canvas: HTMLCanvasElement,
  scale: number = 1.5
): Promise<void> {
  const page = await pdfDoc.getPage(pageNumber);
  const viewport = page.getViewport({ scale });

  canvas.height = viewport.height;
  canvas.width = viewport.width;

  const context = canvas.getContext('2d');
  if (!context) throw new Error('Cannot get 2D canvas context');

  const renderTask = page.render({
    canvasContext: context,
    canvas,
    viewport,
  });

  await renderTask.promise;
}

// ─── Generate Cover Image ────────────────────────────────────────────────────

/**
 * Renders the first page of the PDF as a JPEG data URL for use as a cover thumbnail.
 * Uses a reduced scale (0.5) to keep the image small.
 *
 * @param pdfDoc - The loaded PDF document proxy
 * @param scale - Render scale factor (default: 0.5)
 * @returns Base64 data URL of the cover image, or empty string on failure
 */
export async function generateCoverImage(
  pdfDoc: PDFDocumentProxy,
  scale: number = 0.5
): Promise<string> {
  try {
    const page = await pdfDoc.getPage(1);
    const viewport = page.getViewport({ scale });

    const canvas = document.createElement('canvas');
    canvas.height = viewport.height;
    canvas.width = viewport.width;

    const ctx = canvas.getContext('2d');
    if (!ctx) return '';

    await page.render({ canvasContext: ctx, canvas, viewport }).promise;
    return canvas.toDataURL('image/jpeg', 0.85);
  } catch {
    return '';
  }
}

// ─── Full Processing Pipeline ────────────────────────────────────────────────

/**
 * Runs the complete document processing pipeline:
 *   1. Load the PDF via the CORS proxy
 *   2. Extract metadata, TOC, and cover image in parallel
 *   3. Detect the TOC page index via heuristic search
 *
 * @param pdfUrl - Direct URL to the PDF file
 * @param fileSizeStr - Pre-formatted file size string
 * @param proxyBaseUrl - Optional base URL of the CORS proxy server
 * @returns ProcessingResult containing metadata, TOC, cover, and index page
 */
export async function processDocument(
  pdfUrl: string,
  fileSizeStr: string,
  proxyBaseUrl: string = ''
): Promise<ProcessingResult> {
  const pdfDoc = await loadPdfDocument(pdfUrl, proxyBaseUrl);

  const [metadata, toc, tocPageIndex, coverImage] = await Promise.all([
    extractMetadata(pdfDoc, pdfUrl, fileSizeStr),
    extractTableOfContents(pdfDoc),
    findTOCPageIndex(pdfDoc),
    typeof document !== 'undefined' 
      ? generateCoverImage(pdfDoc) 
      : Promise.resolve(''),
  ]);

  return {
    metadata,
    tableOfContents: toc,
    coverImageBase64: coverImage,
    indexPageNumber: tocPageIndex,
  };
}
