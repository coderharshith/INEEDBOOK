# INEEDBOOK

A fast, clean book discovery engine that finds, validates, and previews PDF books in real-time. Search by title, author, or ISBN to find and preview books instantly.

---

## Features

- **Instant Search** — Find books across the web via PDF sources using Brave Search
- **Deep Validation** — Automatically verifies PDF authenticity, page count, and content match
- **Built-in Reader** — Preview books directly in the browser with page navigation
- **Table of Contents** — Auto-extracted TOC with clickable navigation
- **Dark Theme** — Clean, minimal dark UI
- **Advanced Search** — Filter by author and ISBN
- **Explore & Collections** — Quick access to popular books and categories
- **Book Metadata** — Fetches canonical book data from Google Books API

---

## Tech Stack

| Layer | Technology |
|-------|------------|
| Framework | Next.js 16 (App Router) |
| Language | TypeScript |
| Styling | Tailwind CSS 4 + CSS Variables |
| PDF Processing | pdfjs-dist |
| HTML Parsing | Cheerio |

---

## Prerequisites

- **Node.js** 18+ (recommended: 20 LTS)
- **npm**, **yarn**, or **pnpm**

---

## Installation

```bash
# 1. Clone the repository
git clone https://github.com/your-username/ineedbook.git
cd ineedbook

# 2. Install dependencies
npm install

# 3. Create environment file
cp .env.local.example .env.local
```

Edit `.env.local` with your credentials (see [Environment Variables](#environment-variables)).

```bash
# 4. Start development server
npm run dev
```

Open [http://localhost:3000](http://localhost:3000) in your browser.

---

## Environment Variables

Create a `.env.local` file in the project root:

```env
# Google Custom Search API (optional — for Google-based search)
GOOGLE_API_KEY=your_api_key_here
GOOGLE_SEARCH_ENGINE_ID=your_search_engine_id_here
```

| Variable | Required | Description |
|----------|----------|-------------|
| `GOOGLE_API_KEY` | No | Google Custom Search API key. Get one at [Google Cloud Console](https://console.cloud.google.com/apis/credentials) |
| `GOOGLE_SEARCH_ENGINE_ID` | No | Custom Search Engine ID. Create one at [Programmable Search Engine](https://programmablesearchengine.google.com/) |

> **Note:** The app uses Brave Search scraping by default. Google API keys are optional for enhanced results.

---

## Scripts

```bash
npm run dev      # Start development server
npm run build    # Create production build
npm run start    # Start production server
npm run lint     # Run ESLint
```

---

## Project Structure

```
ineedbook/
├── src/
│   ├── app/
│   │   ├── api/
│   │   │   ├── search/route.ts      # Book search endpoint (Brave scraping)
│   │   │   ├── validate/route.ts    # PDF validation endpoint
│   │   │   ├── books/route.ts       # Canonical book data (Google Books)
│   │   │   └── proxy/route.ts       # PDF proxy for CORS bypass
│   │   ├── globals.css              # Global styles & design tokens
│   │   ├── layout.tsx               # Root layout
│   │   └── page.tsx                 # Main app page
│   ├── components/
│   │   ├── Header.tsx               # Navigation with Explore & Collections
│   │   ├── SearchPanel.tsx          # Search UI & results
│   │   ├── BookDetail.tsx           # Book detail view
│   │   ├── BookReader.tsx           # Full-screen PDF reader
│   │   ├── PreviewCarousel.tsx      # Page preview & TOC carousel
│   │   ├── RecommendationRow.tsx    # Related books
│   │   └── LoadingStates.tsx        # Loading & skeleton components
│   └── lib/
│       ├── pdf-processor.ts         # PDF parsing & metadata extraction
│       ├── search-engine.ts         # Jaro-Winkler scoring & ranking
│       └── validators.ts            # Input validation
├── public/                          # Static assets
├── .env.local                       # Environment variables (not committed)
├── .gitignore
├── next.config.ts
├── package.json
├── postcss.config.mjs
└── tsconfig.json
```

---

## How It Works

1. **Search** — User enters a book title. The app scrapes Brave Search for PDF sources.
2. **Rank** — Results are scored using Jaro-Winkler similarity by title match, trust level, and domain reputation.
3. **Validate** — Each result is deep-validated: checks file accessibility, MIME type, PDF magic bytes, size, and content match.
4. **Preview** — Click "Preview" to open the book detail view with cover, metadata, and TOC.
5. **Read** — Click "Read Preview" to open the full-screen reader with keyboard navigation.

---

## Customization

### Colors

Edit CSS variables in `src/app/globals.css`:

```css
:root {
  --bg-base: #0a0a0b;
  --bg-surface: #111113;
  --accent: #22c55e;
  /* ... */
}
```

### Explore & Collections

Edit the book lists in `src/components/Header.tsx`:

```typescript
const exploreItems = [
  { label: '1984', query: '1984 George Orwell' },
  // Add more items...
];

const collectionItems = [
  { label: 'Science Fiction', query: 'science fiction bestseller' },
  // Add more categories...
];
```

### Domain Trust

Edit the trust table in `src/lib/search-engine.ts` to adjust which domains are considered authoritative:

```typescript
const DOMAIN_TRUST_TABLE = [
  { pattern: /\.edu$/i, score: 1.0, label: 'Educational Institution' },
  { pattern: /\.gov$/i, score: 1.0, label: 'Government' },
  // Add more domains...
];
```

---

## Build

```bash
npm run build
```

The output is in `.next/`. Deploy to any Node.js hosting (Vercel, Railway, etc.).

---

## License

MIT
