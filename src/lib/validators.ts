/**
 * PDF Validation Utilities
 *
 * Provides client-side PDF URL validation without downloading the full document.
 * Uses two-phase validation: HTTP HEAD for metadata checks, then a partial GET
 * to verify the %PDF- magic number signature in the file header.
 *
 * @module validators
 */

// ─── Types ───────────────────────────────────────────────────────────────────

/** Result of a complete PDF validation pipeline */
export interface ValidationResult {
  isValid: boolean;
  contentType: string;
  fileSize: number;
  fileSizeFormatted: string;
  supportsRangeRequests: boolean;
  hasPdfSignature: boolean;
  error?: string;
}

// ─── Constants ───────────────────────────────────────────────────────────────

/** Minimum acceptable file size in bytes (100 KB) to filter out trivially small PDFs */
const MIN_FILE_SIZE_BYTES = 102400;

/** The PDF file magic bytes: %PDF- (hex: 25 50 44 46 2D) */
const PDF_MAGIC_BYTES = [0x25, 0x50, 0x44, 0x46, 0x2D];

/** Number of initial bytes to scan when looking for the %PDF- signature */
const MAGIC_CHECK_RANGE = 1024;

/** Timeout in milliseconds for HTTP validation requests */
const VALIDATION_TIMEOUT_MS = 15000;

// ─── Helpers ─────────────────────────────────────────────────────────────────

/**
 * Converts a byte count into a human-readable string (e.g., "1.5 MB").
 * @param bytes - The file size in bytes
 * @returns Formatted string with appropriate unit
 */
export function formatFileSize(bytes: number): string {
  if (bytes <= 0) return 'Unknown';
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  if (bytes < 1024 * 1024 * 1024) return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  return `${(bytes / (1024 * 1024 * 1024)).toFixed(2)} GB`;
}

// ─── HEAD Request Validation ─────────────────────────────────────────────────

/**
 * Validates a PDF URL via an HTTP HEAD request.
 * Checks for a successful response, valid PDF MIME type, minimum file size,
 * and whether the server supports range requests (needed for partial downloads).
 *
 * @param url - The remote PDF URL to validate
 * @returns Object with validation status, content type, file size, and range support
 */
export async function validatePdfHeaders(url: string): Promise<{
  ok: boolean;
  contentType: string;
  fileSize: number;
  supportsRange: boolean;
  error?: string;
}> {
  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), VALIDATION_TIMEOUT_MS);

    const response = await fetch(url, {
      method: 'HEAD',
      signal: controller.signal,
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) INEEDBOOK Discovery Engine',
      },
    });

    clearTimeout(timeout);

    if (!response.ok) {
      return {
        ok: false,
        contentType: '',
        fileSize: 0,
        supportsRange: false,
        error: `HTTP ${response.status}: ${response.statusText}`,
      };
    }

    const contentType = response.headers.get('content-type') || '';
    const contentLength = response.headers.get('content-length');
    const acceptRanges = response.headers.get('accept-ranges');
    const fileSize = contentLength ? parseInt(contentLength, 10) : 0;

    // Validate MIME type
    const isPdf = contentType.includes('application/pdf') || 
                  contentType.includes('application/x-pdf') ||
                  contentType.includes('application/octet-stream');

    if (!isPdf && !contentType.includes('octet-stream')) {
      return {
        ok: false,
        contentType,
        fileSize,
        supportsRange: false,
        error: `Invalid MIME type: ${contentType}`,
      };
    }

    // Validate file size
    if (fileSize > 0 && fileSize < MIN_FILE_SIZE_BYTES) {
      return {
        ok: false,
        contentType,
        fileSize,
        supportsRange: false,
        error: `File too small: ${formatFileSize(fileSize)} (minimum: 100 KB)`,
      };
    }

    return {
      ok: true,
      contentType,
      fileSize,
      supportsRange: acceptRanges === 'bytes',
    };
  } catch (err: any) {
    return {
      ok: false,
      contentType: '',
      fileSize: 0,
      supportsRange: false,
      error: err.name === 'AbortError' 
        ? 'Connection timed out (15s)' 
        : `Network error: ${err.message}`,
    };
  }
}

// ─── Magic Number Validation ─────────────────────────────────────────────────

/**
 * Downloads the first 1024 bytes of a PDF to verify the %PDF- magic signature.
 * This catches files that claim to be PDF but aren't actually valid PDF documents.
 *
 * @param url - The remote PDF URL to inspect
 * @returns Object with validity status and optional error message
 */
export async function validatePdfMagicBytes(url: string): Promise<{
  isValid: boolean;
  error?: string;
}> {
  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), VALIDATION_TIMEOUT_MS);

    const response = await fetch(url, {
      method: 'GET',
      headers: {
        'Range': `bytes=0-${MAGIC_CHECK_RANGE - 1}`,
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) INEEDBOOK Discovery Engine',
      },
      signal: controller.signal,
    });

    clearTimeout(timeout);

    if (!response.ok && response.status !== 206) {
      return { isValid: false, error: `HTTP ${response.status}` };
    }

    const buffer = await response.arrayBuffer();
    const bytes = new Uint8Array(buffer);

    // Relaxed scan: look for %PDF- anywhere in first 1024 bytes
    // Handles BOM prefixes (EF BB BF) and binary padding
    const found = findPdfSignature(bytes);

    return {
      isValid: found,
      error: found ? undefined : 'No %PDF- signature found in first 1024 bytes',
    };
  } catch (err: any) {
    return {
      isValid: false,
      error: err.name === 'AbortError'
        ? 'Connection timed out'
        : `Fetch error: ${err.message}`,
    };
  }
}

// ─── PDF Signature Scanner ───────────────────────────────────────────────────

/**
 * Scans a byte array for the %PDF- signature (magic bytes).
 * Handles BOM prefixes and binary padding that some servers add.
 *
 * @param bytes - The byte array to scan (typically the first 1024 bytes of a PDF)
 * @returns true if the PDF signature is found, false otherwise
 */
function findPdfSignature(bytes: Uint8Array): boolean {
  const searchLimit = Math.min(bytes.length, MAGIC_CHECK_RANGE);
  
  for (let i = 0; i <= searchLimit - PDF_MAGIC_BYTES.length; i++) {
    let match = true;
    for (let j = 0; j < PDF_MAGIC_BYTES.length; j++) {
      if (bytes[i + j] !== PDF_MAGIC_BYTES[j]) {
        match = false;
        break;
      }
    }
    if (match) return true;
  }
  
  return false;
}

// ─── Full Validation Pipeline ────────────────────────────────────────────────

/**
 * Runs the complete two-phase PDF validation pipeline:
 *   1. HTTP HEAD to check MIME type, file size, and range support
 *   2. Partial GET to verify the %PDF- magic bytes signature
 *
 * @param url - The remote PDF URL to validate
 * @returns Comprehensive validation result with metadata and error details
 */
export async function validatePdfUrl(url: string): Promise<ValidationResult> {
  // Step 1: HEAD request validation
  const headResult = await validatePdfHeaders(url);
  
  if (!headResult.ok) {
    return {
      isValid: false,
      contentType: headResult.contentType,
      fileSize: headResult.fileSize,
      fileSizeFormatted: formatFileSize(headResult.fileSize),
      supportsRangeRequests: false,
      hasPdfSignature: false,
      error: headResult.error,
    };
  }

  // Step 2: Magic byte validation
  const magicResult = await validatePdfMagicBytes(url);

  return {
    isValid: magicResult.isValid,
    contentType: headResult.contentType,
    fileSize: headResult.fileSize,
    fileSizeFormatted: formatFileSize(headResult.fileSize),
    supportsRangeRequests: headResult.supportsRange,
    hasPdfSignature: magicResult.isValid,
    error: magicResult.error,
  };
}
