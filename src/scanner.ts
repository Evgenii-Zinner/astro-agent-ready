import * as fs from 'node:fs';
import * as path from 'node:path';
import { parseSourceFile } from './parser.js';
import type { ContentDocument, SourceConfig } from './types.js';

const DEFAULT_EXTENSIONS = ['.md', '.mdx', '.astro'];

/**
 * Scans a single content source directory and returns an array of structured ContentDocument items.
 *
 * @param source - Configuration for the content source.
 * @param projectRoot - Absolute project root directory.
 * @param siteUrl - Website base URL for generating absolute links.
 * @returns Array of ContentDocument items.
 */
export function scanSourceDirectory(
  source: SourceConfig,
  projectRoot: string,
  siteUrl: string,
): ContentDocument[] {
  const targetDir = path.isAbsolute(source.dir)
    ? source.dir
    : path.resolve(projectRoot, source.dir);

  if (!fs.existsSync(targetDir)) {
    return [];
  }

  const extensions = source.extensions || DEFAULT_EXTENSIONS;
  const entries = fs.readdirSync(targetDir, { withFileTypes: true });
  const documents: ContentDocument[] = [];

  const urlPrefix = (source.urlPrefix || '').replace(/\/$/, '');
  const cleanSiteUrl = siteUrl.replace(/\/$/, '');

  const titleField = source.titleField || 'title';
  const descField = source.descriptionField || 'description';
  const dateField = source.dateField || 'date';
  const tagField = source.tagField || 'tag';
  const draftField = source.draftField || 'draft';
  const excludeDrafts = source.excludeDrafts ?? true;

  for (const entry of entries) {
    if (!entry.isFile()) continue;

    const ext = path.extname(entry.name).toLowerCase();
    if (!extensions.includes(ext)) continue;

    const fullPath = path.join(targetDir, entry.name);
    let rawContent = '';
    try {
      rawContent = fs.readFileSync(fullPath, 'utf-8');
    } catch {
      continue;
    }

    const { metadata, body } = parseSourceFile(fullPath, rawContent);

    // Exclude drafts if enabled (default: true)
    if (excludeDrafts && (metadata[draftField] === true || metadata.draft === true)) {
      continue;
    }

    const baseName = entry.name.slice(0, -ext.length);
    const slug = `${urlPrefix}/${baseName}`;
    const url = cleanSiteUrl ? `${cleanSiteUrl}${slug}` : slug;

    // Extract title with fallbacks
    const title =
      typeof metadata[titleField] === 'string'
        ? (metadata[titleField] as string)
        : baseName.replace(/[-_]/g, ' ');

    // Extract description / preview
    const description =
      typeof metadata[descField] === 'string'
        ? (metadata[descField] as string)
        : typeof metadata.preview === 'string'
          ? (metadata.preview as string)
          : undefined;

    // Extract date
    const dateVal = metadata[dateField];
    const date =
      typeof dateVal === 'string' || typeof dateVal === 'number' ? String(dateVal) : undefined;

    // Extract tag/category
    const tagVal = metadata[tagField] ?? metadata.tags;
    let tag: string | undefined;
    if (Array.isArray(tagVal) && tagVal.length > 0) {
      tag = tagVal.join(', ');
    } else if (typeof tagVal === 'string') {
      tag = tagVal;
    }

    const doc: ContentDocument = {
      slug,
      url,
      title,
      description,
      date,
      tag,
      body,
      metadata,
    };

    if (source.filter && !source.filter(doc)) {
      continue;
    }

    documents.push(doc);
  }

  // Sort documents
  const sortBy = source.sortBy ?? 'date-desc';
  if (sortBy === 'date-desc') {
    documents.sort((a, b) => (b.date || '').localeCompare(a.date || ''));
  } else if (sortBy === 'date-asc') {
    documents.sort((a, b) => (a.date || '').localeCompare(b.date || ''));
  } else if (sortBy === 'title') {
    documents.sort((a, b) => a.title.localeCompare(b.title));
  }

  return documents;
}
