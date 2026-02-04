// Copyright (C) 2025–2026 Robin L. M. Cheung, MBA
// All rights reserved.
// Unauthorized use without prior written consent is strictly prohibited.

// EnZIM - Offline ZIM Reader & Knowledge Explorer
// Copyright (C) 2025 Robin L. M. Cheung, MBA. All rights reserved.

import { zimService } from './zimService';

export interface GraphNode {
  id: string;
  title: string;
  type: 'article' | 'concept' | 'entity';
  relevance: number;
}

export interface GraphEdge {
  source: string;
  target: string;
  weight: number;
}

export interface SemanticGraph {
  nodes: GraphNode[];
  edges: GraphEdge[];
}

export class SemanticEngine {
  private static instance: SemanticEngine;

  static getInstance(): SemanticEngine {
    if (!SemanticEngine.instance) {
      SemanticEngine.instance = new SemanticEngine();
    }
    return SemanticEngine.instance;
  }

  async generateMesh(archiveId: string, articleUrl: string, content: string): Promise<SemanticGraph> {
    const nodes: GraphNode[] = [];
    const edges: GraphEdge[] = [];
    const processedUrls = new Set<string>();

    // Add current article as central node
    const currentEntry = zimService.getEntryByUrl(archiveId, articleUrl);
    const centerTitle = currentEntry?.title || articleUrl;

    nodes.push({
      id: articleUrl,
      title: centerTitle,
      type: 'article',
      relevance: 1.0
    });
    processedUrls.add(articleUrl);

    // Parse links from content
    const links = this.extractLinks(content);

    // Limit to top 15-20 links for performance/visual clarity
    const limitedLinks = links.slice(0, 20);

    for (const link of limitedLinks) {
      if (processedUrls.has(link.url)) continue;

      const entry = zimService.getEntryByUrl(archiveId, link.url);
      if (entry) {
        nodes.push({
          id: link.url,
          title: entry.title,
          type: 'article',
          relevance: 0.8 // Default relevance for direct links
        });

        edges.push({
          source: articleUrl,
          target: link.url,
          weight: 1
        });

        processedUrls.add(link.url);
      }
    }

    // Identify potential concepts (capitalized phrases that appear frequently but aren't links)
    // This is a naive implementation; a real one would use NLP/LLM
    const concepts = this.extractConcepts(content);
    for (const concept of concepts.slice(0, 5)) {
        const id = `concept-${concept}`;
        nodes.push({
            id,
            title: concept,
            type: 'concept',
            relevance: 0.7
        });
        edges.push({
            source: articleUrl,
            target: id,
            weight: 0.5
        });
    }

    return { nodes, edges };
  }

  private extractLinks(html: string): { url: string; text: string }[] {
    const links: { url: string; text: string }[] = [];
    const regex = /<a[^>]+href=["']([^"']+)["'][^>]*>(.*?)<\/a>/gi;
    let match;

    while ((match = regex.exec(html)) !== null) {
      const href = match[1];
      const text = match[2].replace(/<[^>]+>/g, ''); // Strip tags from text

      // Filter for internal article links (assuming relative paths or starting with A/)
      // Adjust logic based on actual ZIM link format
      if (!href.startsWith('http') && !href.startsWith('#') && !href.startsWith('mailto:')) {
          // Normalize URL if needed. ZimService expects the path as stored in directory.
          // Usually in ZIM, links in HTML are relative to the article or root.
          // If article is at A/Title, a link might be "Other_Title" or "../A/Other_Title".
          // We'll simplisticly assume it might be a valid ZIM path.
          let cleanHref = href;
          // Basic normalization
          if (cleanHref.startsWith('../')) cleanHref = cleanHref.substring(3);

          links.push({ url: cleanHref, text });
      }
    }

    return links;
  }

  private extractConcepts(html: string): string[] {
      // Very naive concept extractor: looks for capitalized words > 4 chars
      const text = html.replace(/<[^>]+>/g, ' ');
      const words = text.match(/\b[A-Z][a-z]{3,}\b/g) || [];

      const frequency: Record<string, number> = {};
      for (const word of words) {
          frequency[word] = (frequency[word] || 0) + 1;
      }

      return Object.entries(frequency)
          .sort((a, b) => b[1] - a[1])
          .map(([word]) => word)
          .filter((word, index, self) => self.indexOf(word) === index); // Unique
  }
}

export const semanticEngine = SemanticEngine.getInstance();
