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
 * Extracts frontmatter block and body separated by `---` fences without ReDoS vulnerability.
 */
function extractFrontmatterBlock(content: string): { frontmatter: string; body: string } | null {
  const trimmed = content.trimStart();
  if (!trimmed.startsWith('---')) {
    return null;
  }

  // Find closing --- that starts on its own line after opening fence
  const closingMatch = trimmed.slice(3).match(/\r?\n---[ \t]*(?:\r?\n|$)/);
  if (!closingMatch || closingMatch.index === undefined) {
    return null;
  }

  const frontmatterEnd = 3 + closingMatch.index;
  const frontmatter = trimmed.slice(3, frontmatterEnd);
  const bodyStart = frontmatterEnd + closingMatch[0].length;
  const body = trimmed.slice(bodyStart).trim();

  return { frontmatter, body };
}

/**
 * Parses a Markdown or MDX file, extracting frontmatter and returning the clean body.
 */
export function parseMarkdownFile(content: string): ParsedFileContent {
  const block = extractFrontmatterBlock(content);
  if (!block) {
    return {
      metadata: {},
      body: content.trim(),
    };
  }

  const metadata = parseYamlFrontmatter(block.frontmatter);
  return { metadata, body: block.body };
}

/**
 * Parses an Astro component file (.astro), extracting exported variables (title, description, date, etc.)
 * and extracting the main body text/markdown below the frontmatter fence.
 */
export function parseAstroFile(content: string): ParsedFileContent {
  const block = extractFrontmatterBlock(content);
  const metadata: Record<string, unknown> = {};

  if (block) {
    const frontmatterCode = block.frontmatter;

    // Match export const/let/var name = "value" or 'value' or `value` with escape-safe patterns
    const strExportRegex =
      /export[ \t]+(?:const|let|var)[ \t]+([a-zA-Z0-9_$]+)[ \t]*=[ \t\r\n]*(?:'([^'\\]*(?:\\.[^'\\]*)*)'|"([^"\\]*(?:\\.[^"\\]*)*)"|`([^`\\]*(?:\\.[^`\\]*)*)`)/g;
    let strMatch = strExportRegex.exec(frontmatterCode);
    while (strMatch) {
      const field = strMatch[1];
      const val = (strMatch[2] ?? strMatch[3] ?? strMatch[4] ?? '').trim();
      metadata[field] = val;
      strMatch = strExportRegex.exec(frontmatterCode);
    }

    // Match export const boolean exports: export const draft = true
    const boolExportRegex =
      /export[ \t]+(?:const|let|var)[ \t]+([a-zA-Z0-9_$]+)[ \t]*=[ \t\r\n]*(true|false)\b/g;
    let boolMatch = boolExportRegex.exec(frontmatterCode);
    while (boolMatch) {
      const field = boolMatch[1];
      metadata[field] = boolMatch[2] === 'true';
      boolMatch = boolExportRegex.exec(frontmatterCode);
    }

    // Match export const number exports: export const order = 42
    const numExportRegex =
      /export[ \t]+(?:const|let|var)[ \t]+([a-zA-Z0-9_$]+)[ \t]*=[ \t\r\n]*(-?\d+(?:\.\d+)?)\b/g;
    let numMatch = numExportRegex.exec(frontmatterCode);
    while (numMatch) {
      const field = numMatch[1];
      metadata[field] = Number(numMatch[2]);
      numMatch = numExportRegex.exec(frontmatterCode);
    }

    // Match export const tags = [...] or array exports (linear [^\]]*, no backtracking)
    const arrayExportRegex =
      /export[ \t]+(?:const|let|var)[ \t]+([a-zA-Z0-9_$]+)[ \t]*=[ \t\r\n]*\[([^\]]*)\]/g;
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
  let body = block ? block.body : content.trim();

  // Strip layout wrapper tags (e.g. <ArticleLayout ...>, <BlogLayout>, <DefaultLayout>, <Layout ...>)
  let previousBody: string;
  do {
    previousBody = body;
    body = body.replace(/<\/?[a-zA-Z0-9_$]*Layout\b[^>]*>/gi, '');
  } while (body !== previousBody);
  body = body.trim();

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
