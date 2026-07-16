/**
 * Search Query Builder & Weighted Scoring Model
 *
 * Provides multi-pattern search query generation, domain trust classification,
 * and Jaro-Winkler string similarity for ranking PDF candidates against
 * expected book metadata (title, author, ISBN).
 *
 * @module search-engine
 */

// ─── Domain Trust Classification ─────────────────────────────────────────────

/** A single entry mapping a domain pattern to a trust score and label */
interface DomainTrustEntry {
  pattern: RegExp;
  score: number;
  label: string;
}

/**
 * Trust table for known domains.
 * Educational (.edu), government (.gov), and academic sites get the highest score.
 * Preprint servers and research registries get high trust.
 * Major publishers get moderate-high trust.
 */
const DOMAIN_TRUST_TABLE: DomainTrustEntry[] = [
  { pattern: /\.edu$/i, score: 1.0, label: 'Educational Institution' },
  { pattern: /\.ac\.[a-z]{2,}$/i, score: 1.0, label: 'Academic Institution' },
  { pattern: /\.gov$/i, score: 1.0, label: 'Government' },
  { pattern: /\.gov\.[a-z]{2,}$/i, score: 1.0, label: 'Government' },
  { pattern: /arxiv\.org$/i, score: 0.9, label: 'Research Registry' },
  { pattern: /researchgate\.net$/i, score: 0.9, label: 'Research Registry' },
  { pattern: /academia\.edu$/i, score: 0.9, label: 'Research Registry' },
  { pattern: /scholar\.google/i, score: 0.9, label: 'Research Registry' },
  { pattern: /semantic[s]?scholar\.org$/i, score: 0.9, label: 'Research Registry' },
  { pattern: /springer(open)?\.com$/i, score: 0.8, label: 'Open-Access Publisher' },
  { pattern: /wiley\.com$/i, score: 0.8, label: 'Publisher' },
  { pattern: /elsevier\.com$/i, score: 0.8, label: 'Publisher' },
  { pattern: /ieee\.org$/i, score: 0.8, label: 'Publisher' },
  { pattern: /acm\.org$/i, score: 0.8, label: 'Publisher' },
  { pattern: /mit\.edu$/i, score: 1.0, label: 'Educational Institution' },
  { pattern: /stanford\.edu$/i, score: 1.0, label: 'Educational Institution' },
  { pattern: /archive\.org$/i, score: 0.85, label: 'Digital Library' },
  { pattern: /openlibrary\.org$/i, score: 0.85, label: 'Digital Library' },
  { pattern: /gutenberg\.org$/i, score: 0.85, label: 'Digital Library' },
  { pattern: /pdfdrive\./i, score: 0.6, label: 'PDF Repository' },
  { pattern: /z-lib\./i, score: 0.6, label: 'PDF Repository' },
  { pattern: /libgen\./i, score: 0.65, label: 'Library Genesis' },
];

// ─── Scoring Weights ─────────────────────────────────────────────────────────

/**
 * Weight distribution for the composite scoring model.
 * Title match dominates at 50%, followed by author (25%), ISBN (20%), and trust (5%).
 */
const WEIGHTS = {
  title: 0.50,
  author: 0.25,
  isbn: 0.20,
  trust: 0.05,
} as const;

// ─── Search Query Types ──────────────────────────────────────────────────────

/** Represents a single search query variant to be executed against a search engine */
export interface SearchQuery {
  type: 'standard' | 'filetype' | 'author' | 'isbn';
  query: string;
  label: string;
}

/** A single PDF candidate extracted from search engine results */
export interface SearchCandidate {
  title: string;
  link: string;
  snippet: string;
  displayLink: string;
  fileFormat?: string;
}

/** Scored search candidate with individual component scores and a trust label */
export interface ScoredResult {
  candidate: SearchCandidate;
  scores: {
    title: number;
    author: number;
    isbn: number;
    trust: number;
    total: number;
  };
  trustLabel: string;
}

// ─── Multi-Pattern Query Builder ─────────────────────────────────────────────

/**
 * Generates multiple search query variants to maximize the chance of finding
 * the target PDF. Produces standard, filetype-restricted, author-specific,
 * and ISBN-targeted queries based on available metadata.
 *
 * @param title - Book title (required)
 * @param author - Optional author name
 * @param isbn - Optional ISBN
 * @returns Array of search queries to execute
 */
export function generateSearchQueries(
  title: string,
  author?: string,
  isbn?: string
): SearchQuery[] {
  const queries: SearchQuery[] = [];
  const cleanTitle = title.trim();

  if (cleanTitle) {
    queries.push({
      type: 'standard',
      query: `${cleanTitle} PDF`,
      label: 'Standard Title Search',
    });
    queries.push({
      type: 'filetype',
      query: `${cleanTitle} filetype:pdf`,
      label: 'Filetype-Restricted Search',
    });
  }

  if (author && author.trim()) {
    queries.push({
      type: 'author',
      query: `${author.trim()} ${cleanTitle} PDF`,
      label: 'Author-Specific Search',
    });
  }

  if (isbn && isbn.trim()) {
    queries.push({
      type: 'isbn',
      query: `${isbn.trim()} PDF`,
      label: 'ISBN-Targeted Search',
    });
  }

  return queries;
}

// ─── Jaro Similarity ─────────────────────────────────────────────────────────

/**
 * Computes the Jaro similarity between two strings.
 * Jaro similarity counts matching characters and transpositions to produce
 * a value between 0 (no match) and 1 (identical).
 *
 * @param s1 - First string
 * @param s2 - Second string
 * @returns Similarity score between 0.0 and 1.0
 */
function jaroSimilarity(s1: string, s2: string): number {
  if (s1 === s2) return 1.0;
  
  const len1 = s1.length;
  const len2 = s2.length;
  
  if (len1 === 0 || len2 === 0) return 0.0;

  const matchWindow = Math.floor(Math.max(len1, len2) / 2) - 1;
  const matchesS1 = new Array(len1).fill(false);
  const matchesS2 = new Array(len2).fill(false);

  let matchCount = 0;
  for (let i = 0; i < len1; i++) {
    const start = Math.max(0, i - matchWindow);
    const end = Math.min(len2 - 1, i + matchWindow);
    for (let j = start; j <= end; j++) {
      if (!matchesS2[j] && s1[i] === s2[j]) {
        matchesS1[i] = true;
        matchesS2[j] = true;
        matchCount++;
        break;
      }
    }
  }

  if (matchCount === 0) return 0.0;

  let transpositions = 0;
  let k = 0;
  for (let i = 0; i < len1; i++) {
    if (matchesS1[i]) {
      while (!matchesS2[k]) k++;
      if (s1[i] !== s2[k]) transpositions++;
      k++;
    }
  }

  return (
    matchCount / len1 +
    matchCount / len2 +
    (matchCount - Math.floor(transpositions / 2)) / matchCount
  ) / 3.0;
}

// ─── Jaro-Winkler Similarity ─────────────────────────────────────────────────

/**
 * Computes the Jaro-Winkler similarity score, which gives higher weight to
 * strings that match from the beginning (prefix bonus). Uses a scaling
 * factor of 0.1 for the prefix bonus with a max prefix length of 4.
 *
 * @param s1 - First string
 * @param s2 - Second string
 * @returns Similarity score between 0.0 and 1.0
 */
export function calculateJaroWinkler(s1: string, s2: string): number {
  const cleanS1 = s1.toLowerCase().trim();
  const cleanS2 = s2.toLowerCase().trim();

  if (cleanS1 === cleanS2) return 1.0;
  if (cleanS1.length === 0 || cleanS2.length === 0) return 0.0;

  const jaroSim = jaroSimilarity(cleanS1, cleanS2);

  let prefixLength = 0;
  const maxPrefix = 4;
  for (let i = 0; i < Math.min(cleanS1.length, cleanS2.length, maxPrefix); i++) {
    if (cleanS1[i] === cleanS2[i]) {
      prefixLength++;
    } else {
      break;
    }
  }

  // sim_jw = sim_j + l * p * (1 - sim_j), where p = 0.1
  return jaroSim + prefixLength * 0.1 * (1.0 - jaroSim);
}

// ─── Domain Trust Scoring ────────────────────────────────────────────────────

/**
 * Classifies a URL's domain and returns a trust score and label.
 * Educational (.edu), government (.gov), and academic sites get score 1.0.
 * Preprint servers (arXiv, ResearchGate) get 0.9.
 * Major publishers (Springer, IEEE) get 0.8.
 * Unknown domains default to 0.4.
 *
 * @param url - The URL to classify
 * @returns Object with numeric score (0.0–1.0) and human-readable label
 */
export function getDomainTrust(url: string): { score: number; label: string } {
  try {
    const hostname = new URL(url).hostname.toLowerCase();
    for (const entry of DOMAIN_TRUST_TABLE) {
      if (entry.pattern.test(hostname)) {
        return { score: entry.score, label: entry.label };
      }
    }
  } catch {
    // Invalid URL
  }
  return { score: 0.4, label: 'Standard Web Domain' };
}

// ─── Weighted Scoring Model ──────────────────────────────────────────────────

/**
 * Scores a single search candidate against expected book metadata.
 * Combines title similarity (50%), author similarity (25%), ISBN match (20%),
 * and domain trust (5%) into a composite score.
 *
 * @param candidate - The search result to score
 * @param expectedTitle - The expected book title
 * @param expectedAuthor - Optional expected author name
 * @param expectedIsbn - Optional expected ISBN
 * @returns ScoredResult with individual and total scores
 */
export function scoreCandidate(
  candidate: SearchCandidate,
  expectedTitle: string,
  expectedAuthor?: string,
  expectedIsbn?: string
): ScoredResult {
  const cleanExpected = expectedTitle.toLowerCase().trim();
  const cleanCandidate = candidate.title.toLowerCase().trim();
  const candidateText = `${candidate.title} ${candidate.snippet}`.toLowerCase();

  let titleScore = calculateJaroWinkler(expectedTitle, candidate.title);

  const expectedTerms = cleanExpected.split(/\s+/).filter(t => t.length > 2);
  if (expectedTerms.length > 0) {
    const matchedTerms = expectedTerms.filter(term => candidateText.includes(term));
    const termRatio = matchedTerms.length / expectedTerms.length;
    titleScore = Math.max(titleScore, termRatio * 0.95);
  }

  if (cleanCandidate.includes(cleanExpected) || cleanExpected.includes(cleanCandidate)) {
    titleScore = Math.max(titleScore, 0.98);
  }

  let authorScore = 0;
  if (expectedAuthor && expectedAuthor.trim()) {
    const authorLower = expectedAuthor.toLowerCase().trim();
    const combinedText = `${candidate.title} ${candidate.snippet}`;
    authorScore = calculateJaroWinkler(expectedAuthor, combinedText);
    if (combinedText.toLowerCase().includes(authorLower)) {
      authorScore = Math.max(authorScore, 0.95);
    }
    const authorParts = authorLower.split(/\s+/).filter(p => p.length > 2);
    if (authorParts.length > 0) {
      const matchedAuthorParts = authorParts.filter(part => candidateText.includes(part));
      const authorPartRatio = matchedAuthorParts.length / authorParts.length;
      authorScore = Math.max(authorScore, authorPartRatio * 0.9);
    }
  }

  let isbnScore = 0;
  if (expectedIsbn && expectedIsbn.trim()) {
    const normalizedIsbn = expectedIsbn.replace(/[-\s]/g, '');
    const combinedText = `${candidate.title} ${candidate.snippet} ${candidate.link}`;
    if (combinedText.includes(normalizedIsbn)) {
      isbnScore = 1.0;
    }
  }

  const trust = getDomainTrust(candidate.link);

  const total =
    WEIGHTS.title * titleScore +
    WEIGHTS.author * authorScore +
    WEIGHTS.isbn * isbnScore +
    WEIGHTS.trust * trust.score;

  return {
    candidate,
    scores: {
      title: titleScore,
      author: authorScore,
      isbn: isbnScore,
      trust: trust.score,
      total,
    },
    trustLabel: trust.label,
  };
}

// ─── Rank Candidates ─────────────────────────────────────────────────────────

/**
 * Scores and ranks an array of search candidates against expected metadata.
 * Returns results sorted by total score in descending order.
 *
 * @param candidates - Array of search candidates to rank
 * @param expectedTitle - The expected book title
 * @param expectedAuthor - Optional expected author name
 * @param expectedIsbn - Optional expected ISBN
 * @returns Array of ScoredResult objects sorted by total score (highest first)
 */
export function rankCandidates(
  candidates: SearchCandidate[],
  expectedTitle: string,
  expectedAuthor?: string,
  expectedIsbn?: string
): ScoredResult[] {
  return candidates
    .map(c => scoreCandidate(c, expectedTitle, expectedAuthor, expectedIsbn))
    .sort((a, b) => b.scores.total - a.scores.total);
}
