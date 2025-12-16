import Fuse from 'fuse.js';
import { StandardMarket, MarketMatch } from '../types.js';

/**
 * MarketMatcher - Finds matching markets across platforms
 * 
 * Why do we need this?
 * PolyMarket might have "Trump win 2024?" and Kalshi has "Presidential Winner - Trump"
 * These are the SAME event, but computers don't know that from exact string matching.
 * 
 * This class uses:
 * 1. Pre-filtering (eliminate obviously different markets fast)
 * 2. Fuzzy matching (find similar text using smart algorithms)
 */
export class MarketMatcher {
  // Minimum similarity score (0-1) to consider a match
  // 0.60 = 60% similar - Adjusted after testing with real data
  // We use 60% because platforms phrase questions very differently
  // Example: "Will X happen?" vs "X to occur" scores ~60-65%
  private readonly MATCH_THRESHOLD = 0.60;

  /**
   * Find all matching markets between two platforms
   * 
   * @param marketsA - Markets from platform A (e.g., PolyMarket)
   * @param marketsB - Markets from platform B (e.g., Kalshi)
   * @returns Array of matched pairs with confidence scores
   */
  findMatches(marketsA: StandardMarket[], marketsB: StandardMarket[]): MarketMatch[] {
    console.log(`\n🔍 Starting matcher...`);
    console.log(`   Platform A: ${marketsA.length} markets`);
    console.log(`   Platform B: ${marketsB.length} markets`);
    console.log(`   Naive approach would do: ${marketsA.length} × ${marketsB.length} = ${marketsA.length * marketsB.length} comparisons`);

    const matches: MarketMatch[] = [];

    // Process each market from Platform A
    for (const marketA of marketsA) {
      // STEP 1: Pre-filter candidates (this is the optimization!)
      const candidates = this.preFilterCandidates(marketA, marketsB);
      
      if (candidates.length === 0) {
        continue; // No point in fuzzy matching if pre-filter found nothing
      }

      // STEP 2: Use Fuse.js to fuzzy match against candidates
      const bestMatch = this.findBestMatch(marketA, candidates);

      if (bestMatch) {
        matches.push(bestMatch);
      }
    }

    console.log(`\n✅ Found ${matches.length} matches`);
    return matches;
  }

  /**
   * PRE-FILTERING STEP
   * 
   * Before doing expensive fuzzy matching, eliminate markets that CAN'T be the same.
   * This reduces 500×500 = 250,000 comparisons down to ~50-100.
   * 
   * Filters applied:
   * 1. Date range - Events ending >30 days apart are different events
   * 2. Keyword overlap - If no common words, probably different
   */
  private preFilterCandidates(
    targetMarket: StandardMarket,
    candidateMarkets: StandardMarket[]
  ): StandardMarket[] {
    return candidateMarkets.filter(candidate => {
      // FILTER 1: Date Range Check
      // If both markets have end dates, they should be close
      if (targetMarket.endDate && candidate.endDate) {
        const daysDiff = Math.abs(
          targetMarket.endDate.getTime() - candidate.endDate.getTime()
        ) / (1000 * 60 * 60 * 24); // Convert milliseconds to days

        // Markets ending >30 days apart are likely different events
        if (daysDiff > 30) {
          return false; // Skip this candidate
        }
      }

      // FILTER 2: Keyword Overlap
      // Extract words from titles (lowercase, remove punctuation)
      const wordsA = this.extractKeywords(targetMarket.title);
      const wordsB = this.extractKeywords(candidate.title);

      // Check if they share at least 1 meaningful word
      // Example: "Trump 2024" and "Presidential Trump" share "Trump"
      const hasOverlap = wordsA.some(word => wordsB.includes(word));

      if (!hasOverlap) {
        return false; // No common words = different events
      }

      // FILTER 3: Outcome Count (optional but useful)
      // A binary market (Yes/No) shouldn't match a 5-option market
      if (targetMarket.outcomes.length !== candidate.outcomes.length) {
        return false;
      }

      // Passed all filters - this is a candidate worth fuzzy matching
      return true;
    });
  }

  /**
   * Extract important keywords from a market title
   * 
   * Process:
   * 1. Lowercase everything
   * 2. Remove punctuation
   * 3. Split into words
   * 4. Filter out "stop words" (common words like "the", "will", "be")
   * 
   * Example:
   * Input: "Will Trump win the 2024 election?"
   * Output: ["trump", "win", "2024", "election"]
   */
  private extractKeywords(title: string): string[] {
    // Stop words - common words we ignore because they don't help matching
    const stopWords = new Set([
      'will', 'the', 'be', 'in', 'on', 'at', 'to', 'a', 'an',
      'is', 'are', 'was', 'were', 'for', 'of', 'by', 'or'
    ]);

    return title
      .toLowerCase()
      .replace(/[^\w\s]/g, ' ') // Remove punctuation: "Trump?" → "Trump "
      .split(/\s+/) // Split on whitespace: "Trump win" → ["Trump", "win"]
      .filter(word => word.length > 2 && !stopWords.has(word)); // Remove short words and stop words
  }

  /**
   * FUZZY MATCHING STEP
   * 
   * Use Fuse.js to find the best match from candidates.
   * Fuse.js uses advanced algorithms (similar to how Google search works).
   * 
   * How it works:
   * - It calculates a "distance" score between strings
   * - Lower distance = more similar
   * - We convert distance to similarity percentage
   */
  private findBestMatch(
    targetMarket: StandardMarket,
    candidates: StandardMarket[]
  ): MarketMatch | null {
    // Configure Fuse.js
    const fuse = new Fuse(candidates, {
      keys: ['title'], // Which field to search in
      includeScore: true, // Return the similarity score
      threshold: 1 - this.MATCH_THRESHOLD, // 0.40 (inverse of 0.60)
      // Lower threshold = stricter matching
      // Fuse uses 0-1 where 0=perfect match, 1=no match (opposite of our convention)
      
      // Additional options for better matching:
      ignoreLocation: true, // Don't care where in the string the match occurs
      findAllMatches: true, // Find all matching patterns
      minMatchCharLength: 3, // Minimum length of matched patterns
    });

    // Search for markets similar to our target
    const results = fuse.search(targetMarket.title);

    if (results.length === 0) {
      return null; // No match found above threshold
    }

    // Get the best match (Fuse returns them sorted by score)
    const bestResult = results[0];
    
    // Convert Fuse's score (0=perfect) to our convention (100=perfect)
    // Fuse score of 0.1 → our score of 90
    const confidenceScore = Math.round((1 - (bestResult.score || 0)) * 100);

    // Return the match with metadata
    return {
      marketA: targetMarket,
      marketB: bestResult.item,
      score: confidenceScore,
      matchedBy: 'fuzzy',
    };
  }

  /**
   * Helper: Print a match in a readable format (for debugging)
   */
  static formatMatch(match: MarketMatch): string {
    return `
┌─ MATCH (${match.score}% confidence) ─────────────────────────
│ ${match.marketA.platform}: "${match.marketA.title}"
│ ${match.marketB.platform}: "${match.marketB.title}"
│ End dates: ${match.marketA.endDate?.toISOString().split('T')[0]} / ${match.marketB.endDate?.toISOString().split('T')[0]}
└─────────────────────────────────────────────────────────────
`;
  }
}
