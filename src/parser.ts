/**
 * Parses simple YAML frontmatter string into key-value pairs without external dependencies.
 */
export function parseYamlFrontmatter(yamlStr: string): Record<string, unknown> {
  const result: Record<string, unknown> = {};
  const lines = yamlStr.split(/\r?\n/);

  let currentKey: string | null = null;
  let currentArray: string[] | null = null;

  for (const rawLine of lines) {
    const line = rawLine.trim();
    if (!line || line.startsWith('#')) continue;

    // Array item under currentKey
    if (line.startsWith('- ') && currentKey) {
      if (!currentArray) {
        currentArray = [];
        result[currentKey] = currentArray;
      }
      const item = line
        .slice(2)
        .trim()
        .replace(/^["']|["']$/g, '');
      currentArray.push(item);
      continue;
    }

    currentArray = null;

    const colonIdx = line.indexOf(':');
    if (colonIdx === -1) continue;

    const key = line.slice(0, colonIdx).trim();
    const rawVal = line.slice(colonIdx + 1).trim();

    if (!rawVal) {
      // Possible start of a list on next lines
      currentKey = key;
      continue;
    }

    currentKey = key;

    // Inline array: [a, b, c]
    if (rawVal.startsWith('[') && rawVal.endsWith(']')) {
      const items = rawVal
        .slice(1, -1)
        .split(',')
        .map((s) => s.trim().replace(/^["']|["']$/g, ''))
        .filter(Boolean);
      result[key] = items;
      continue;
    }

    // Boolean
    if (rawVal.toLowerCase() === 'true') {
      result[key] = true;
      continue;
    }
    if (rawVal.toLowerCase() === 'false') {
      result[key] = false;
      continue;
    }

    // Number
    if (/^-?\d+(\.\d+)?$/.test(rawVal)) {
      result[key] = Number(rawVal);
      continue;
    }

    // Quoted string or plain string
    const unquoted = rawVal.replace(/^["']|["']$/g, '');
    result[key] = unquoted;
  }

  return result;
}

/**
 * Parsed output from any source file.
 */
export interface ParsedFileContent {
  metadata: Record<string, unknown>;
  body: string;
}

/**
 * Parses a Markdown or MDX file, extracting frontmatter and returning the clean body.
 */
export function parseMarkdownFile(content: string): ParsedFileContent {
  const frontmatterRegex = /^---\s*[\r\n]([\s\S]*?)[\r\n]---\s*[\r\n]?/;
  const match = content.match(frontmatterRegex);

  if (!match) {
    return {
      metadata: {},
      body: content.trim(),
    };
  }

  const yamlStr = match[1];
  const body = content.slice(match[0].length).trim();
  const metadata = parseYamlFrontmatter(yamlStr);

  return { metadata, body };
}

/**
 * Parses an Astro component file (.astro), extracting exported variables (title, description, date, etc.)
 * and extracting the main body text/markdown below the frontmatter fence.
 */
export function parseAstroFile(content: string): ParsedFileContent {
  const fenceRegex = /^---\s*[\r\n]([\s\S]*?)[\r\n]---\s*[\r\n]?/;
  const match = content.match(fenceRegex);

  const metadata: Record<string, unknown> = {};

  if (match) {
    const frontmatterCode = match[1];

    // Match export const/let/var name = "value" or 'value' or `value`
    const exportRegex =
      /export\s+(?:const|let|var)\s+([a-zA-Z0-9_$]+)\s*=\s*[\r\n\s]*(["'`])([\s\S]*?)\2/g;
    let exportMatch = exportRegex.exec(frontmatterCode);
    while (exportMatch) {
      const field = exportMatch[1];
      const val = exportMatch[3].trim();
      metadata[field] = val;
      exportMatch = exportRegex.exec(frontmatterCode);
    }

    // Match export const tags = [...] or array exports
    const arrayExportRegex = /export\s+(?:const|let|var)\s+([a-zA-Z0-9_$]+)\s*=\s*\[([\s\S]*?)\]/g;
    let arrayMatch = arrayExportRegex.exec(frontmatterCode);
    while (arrayMatch) {
      const field = arrayMatch[1];
      const rawItems = arrayMatch[2];
      const items = rawItems
        .split(',')
        .map((s) => s.trim().replace(/^["'`]|["'`]$/g, ''))
        .filter(Boolean);
      metadata[field] = items;
      arrayMatch = arrayExportRegex.exec(frontmatterCode);
    }
  }

  // Body is whatever is below the second ---
  let body = match ? content.slice(match[0].length).trim() : content.trim();

  // Strip layout wrapper tags (e.g. <ArticleLayout ...> ... </ArticleLayout>) but keep content inside
  body = body.replace(/<\/?(?:ArticleLayout|Layout|BaseLayout|MainLayout)[^>]*>/gi, '').trim();

  return { metadata, body };
}

/**
 * Universal file parser determining the file type and returning structured metadata and body.
 */
export function parseSourceFile(filePath: string, content: string): ParsedFileContent {
  if (filePath.endsWith('.astro')) {
    return parseAstroFile(content);
  }
  return parseMarkdownFile(content);
}
