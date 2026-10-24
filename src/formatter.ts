import type { AgentReadyOptions, ContactConfig, ContentDocument, SourceConfig } from './types.js';

/**
 * Normalizes a relative path into a fully qualified URL using siteUrl.
 */
function resolveUrl(pathOrUrl: string, siteUrl: string): string {
  if (pathOrUrl.startsWith('http://') || pathOrUrl.startsWith('https://')) {
    return pathOrUrl;
  }
  const cleanSite = siteUrl.replace(/\/$/, '');
  const cleanPath = pathOrUrl.startsWith('/') ? pathOrUrl : `/${pathOrUrl}`;
  return cleanSite ? `${cleanSite}${cleanPath}` : cleanPath;
}

/**
 * Formats contact information into clean markdown list items.
 */
function formatContactSection(contact: ContactConfig | string[]): string {
  if (Array.isArray(contact)) {
    return contact.map((c) => (c.startsWith('-') ? c : `- ${c}`)).join('\n');
  }

  const lines: string[] = [];

  if (contact.email) {
    lines.push(`- **Email:** ${contact.email}`);
  }
  if (contact.github) {
    const ghUrl = contact.github.startsWith('http')
      ? contact.github
      : `https://github.com/${contact.github.replace(/^@/, '')}`;
    const ghName = contact.github.split('/').pop() || contact.github;
    lines.push(`- **GitHub:** [${ghName}](${ghUrl})`);
  }
  if (contact.linkedin) {
    const liUrl = contact.linkedin.startsWith('http')
      ? contact.linkedin
      : `https://www.linkedin.com/in/${contact.linkedin.replace(/^@/, '')}/`;
    const liName = contact.linkedin.split('/').filter(Boolean).pop() || contact.linkedin;
    lines.push(`- **LinkedIn:** [${liName}](${liUrl})`);
  }
  if (contact.x || contact.twitter) {
    const handle = (contact.x || contact.twitter || '').replace(/^@/, '');
    const xUrl = handle.startsWith('http') ? handle : `https://x.com/${handle}`;
    lines.push(`- **X/Twitter:** [@${handle}](${xUrl})`);
  }

  // Format any custom keys
  for (const [key, val] of Object.entries(contact)) {
    if (['email', 'github', 'linkedin', 'x', 'twitter'].includes(key) || !val) continue;
    const formattedKey = key.charAt(0).toUpperCase() + key.slice(1);
    const linkMatch = val.match(/^https?:\/\//);
    if (linkMatch) {
      lines.push(`- **${formattedKey}:** [${val}](${val})`);
    } else {
      lines.push(`- **${formattedKey}:** ${val}`);
    }
  }

  return lines.join('\n');
}

/**
 * Generates the spec-compliant /llms.txt index markdown string.
 *
 * @param options - Configuration options for agent ready.
 * @param sourceResults - Map of source configuration to extracted documents.
 * @returns Formatted llms.txt string.
 */
export function generateLlmsTxt(
  options: AgentReadyOptions,
  sourceResults: Map<SourceConfig, ContentDocument[]>,
): string {
  const siteUrl = options.siteUrl || '';
  const parts: string[] = [];

  // 1. Title & Description
  parts.push(`# ${options.title.trim()}\n`);
  parts.push(`> ${options.description.trim()}\n`);

  // 2. Intro / Notes
  if (options.intro) {
    parts.push(`${options.intro.trim()}\n`);
  } else {
    parts.push(
      'This file is a map of the site optimized for Large Language Models (LLMs) and AI agents.\n',
    );
  }

  // 3. Core Pages
  if (options.corePages && options.corePages.length > 0) {
    const coreLines: string[] = ['## Core Pages'];
    for (const page of options.corePages) {
      const fullUrl = resolveUrl(page.path, siteUrl);
      const desc = page.description ? `: ${page.description.trim()}` : '';
      coreLines.push(`- [${page.title.trim()}](${fullUrl})${desc}`);
    }
    parts.push(`${coreLines.join('\n')}\n`);
  }

  // 4. Source Collections (e.g. Articles, Blog, Docs)
  for (const [source, docs] of sourceResults.entries()) {
    if (docs.length === 0) continue;

    const sectionLines: string[] = [`## ${source.heading.trim()}`];

    for (const doc of docs) {
      const details: string[] = [];
      if (doc.date) details.push(`Published: ${doc.date}`);
      if (doc.tag) details.push(`Tags: ${doc.tag}`);

      const metaSuffix = details.length > 0 ? ` (${details.join(', ')})` : '';
      const descPart = doc.description ? `: ${doc.description.trim()}` : '';

      sectionLines.push(`- [${doc.title.trim()}](${doc.url})${descPart}${metaSuffix}`);
    }

    parts.push(`${sectionLines.join('\n')}\n`);
  }

  // 5. Contact Section
  if (options.contact) {
    const contactBody = formatContactSection(options.contact);
    if (contactBody) {
      parts.push(`## Direct Contact\n${contactBody}\n`);
    }
  }

  // 6. Custom Footer
  if (options.customFooter !== undefined) {
    if (options.customFooter.trim()) {
      parts.push(`${options.customFooter.trim()}\n`);
    }
  } else {
    parts.push('*Data formatted in accordance with the llms.txt standard.*\n');
  }

  return `${parts.join('\n').trim()}\n`;
}

/**
 * Generates the /llms-full.txt concatenated full content context markdown string.
 *
 * @param options - Configuration options for agent ready.
 * @param sourceResults - Map of source configuration to extracted documents.
 * @returns Formatted llms-full.txt string.
 */
export function generateLlmsFullTxt(
  options: AgentReadyOptions,
  sourceResults: Map<SourceConfig, ContentDocument[]>,
): string {
  const parts: string[] = [];

  // Top-level document header
  parts.push(`# ${options.title.trim()} — Full Content Context\n`);
  parts.push(`> ${options.description.trim()}\n`);
  parts.push(
    `This file contains the concatenated full content of all documents from ${options.title.trim()}, optimized for ingestion by reasoning models and Large Language Models.\n`,
  );

  const includeInFull = options.includeInFull;

  for (const [source, docs] of sourceResults.entries()) {
    if (includeInFull && !includeInFull.includes(source.name)) {
      continue;
    }
    if (docs.length === 0) continue;

    for (const doc of docs) {
      const docHeader: string[] = ['---', '', `# ${doc.title.trim()}`];
      if (doc.url) docHeader.push(`URL: ${doc.url}`);
      if (doc.date) docHeader.push(`Date: ${doc.date}`);
      if (doc.tag) docHeader.push(`Tags: ${doc.tag}`);
      if (doc.description) docHeader.push(`Description: ${doc.description.trim()}`);
      docHeader.push('');

      const bodyText = doc.body?.trim() || '(No body content available)';

      parts.push(`${docHeader.join('\n')}\n${bodyText}\n`);
    }
  }

  return `${parts.join('\n').trim()}\n`;
}
