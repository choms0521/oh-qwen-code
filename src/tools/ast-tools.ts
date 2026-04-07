/**
 * AST Tools using ast-grep
 *
 * Provides AST-aware code search and transformation:
 * - Pattern matching with meta-variables ($VAR, $$$)
 * - Code replacement while preserving structure
 * - Support for 25+ programming languages
 */

import { z } from 'zod';
import { readFileSync, readdirSync, statSync, writeFileSync } from 'fs';
import { join, extname, resolve, normalize, relative, isAbsolute } from 'path';
import { createRequire } from 'module';

// Dynamic import for @ast-grep/napi with graceful degradation
let sgModule: typeof import('@ast-grep/napi') | null = null;
let sgLoadFailed = false;
let sgLoadError = '';

async function getSgModule(): Promise<typeof import('@ast-grep/napi') | null> {
  if (sgLoadFailed) return null;
  if (!sgModule) {
    try {
      const require = createRequire(import.meta.url);
      sgModule = require('@ast-grep/napi') as typeof import('@ast-grep/napi');
    } catch {
      try {
        sgModule = await import('@ast-grep/napi');
      } catch (error) {
        sgLoadFailed = true;
        sgLoadError = error instanceof Error ? error.message : String(error);
        return null;
      }
    }
  }
  return sgModule;
}

function toLangString(language: string): string {
  const langMap: Record<string, string> = {
    javascript: 'javascript', typescript: 'typescript', tsx: 'tsx',
    python: 'python', ruby: 'ruby', go: 'go', rust: 'rust',
    java: 'java', kotlin: 'kotlin', swift: 'swift',
    c: 'c', cpp: 'cpp', csharp: 'csharp',
    html: 'html', css: 'css', json: 'json', yaml: 'yaml',
  };
  const lang = langMap[language];
  if (!lang) throw new Error(`Unsupported language: ${language}. Supported: ${Object.keys(langMap).join(', ')}`);
  return lang;
}

export const SUPPORTED_LANGUAGES: [string, ...string[]] = [
  'javascript', 'typescript', 'tsx', 'python', 'ruby', 'go', 'rust',
  'java', 'kotlin', 'swift', 'c', 'cpp', 'csharp', 'html', 'css', 'json', 'yaml',
];

const EXT_TO_LANG: Record<string, string> = {
  '.js': 'javascript', '.mjs': 'javascript', '.cjs': 'javascript', '.jsx': 'javascript',
  '.ts': 'typescript', '.mts': 'typescript', '.cts': 'typescript', '.tsx': 'tsx',
  '.py': 'python', '.rb': 'ruby', '.go': 'go', '.rs': 'rust',
  '.java': 'java', '.kt': 'kotlin', '.kts': 'kotlin', '.swift': 'swift',
  '.c': 'c', '.h': 'c', '.cpp': 'cpp', '.cc': 'cpp', '.cxx': 'cpp', '.hpp': 'cpp',
  '.cs': 'csharp', '.html': 'html', '.htm': 'html', '.css': 'css',
  '.json': 'json', '.yaml': 'yaml', '.yml': 'yaml',
};

function getFilesForLanguage(dirPath: string, language: string, maxFiles = 1000): string[] {
  const files: string[] = [];
  const extensions = Object.entries(EXT_TO_LANG).filter(([, lang]) => lang === language).map(([ext]) => ext);

  function walk(dir: string) {
    if (files.length >= maxFiles) return;
    try {
      const entries = readdirSync(dir, { withFileTypes: true });
      for (const entry of entries) {
        if (files.length >= maxFiles) break;
        const fullPath = join(dir, entry.name);
        if (entry.isDirectory() && !entry.name.startsWith('.') && entry.name !== 'node_modules' && entry.name !== 'dist') {
          walk(fullPath);
        } else if (entry.isFile() && extensions.includes(extname(entry.name).toLowerCase())) {
          files.push(fullPath);
        }
      }
    } catch { /* skip unreadable dirs */ }
  }
  walk(dirPath);
  return files.slice(0, maxFiles);
}

// ============================================================
// Tool: ast_grep (pattern matching)
// ============================================================
export const astGrepTool = {
  name: 'ast_grep',
  description: 'Search code using AST pattern matching with ast-grep. Supports meta-variables ($VAR, $$$) for flexible matching across multiple languages.',
  inputSchema: z.object({
    pattern: z.string().describe('AST-grep pattern (e.g., "console.log($MSG)", "function $NAME($$$ARGS) { $$$ }")'),
    language: z.enum(SUPPORTED_LANGUAGES),
    paths: z.array(z.string()).optional().describe('Specific files to search (default: entire project)'),
  }),
  handler: async ({ pattern, language, paths }: { pattern: string; language: string; paths?: string[] }) => {
    const sg = await getSgModule();
    if (!sg) {
      return {
        isError: true,
        content: [{ type: 'text', text: `ast-grep module not available: ${sgLoadError}\n\nInstall: npm install @ast-grep/napi` }],
      };
    }

    const lang = toLangString(language);
    const cwd = process.cwd();
    const searchPaths = paths && paths.length > 0 ? paths.map(p => resolve(cwd, p)) : [cwd];

    const allMatches: Array<{ file: string; line: number; code: string }> = [];

    for (const searchPath of searchPaths) {
      const files = statSync(searchPath).isDirectory()
        ? getFilesForLanguage(searchPath, language)
        : [searchPath];

      for (const file of files) {
        try {
          const source = readFileSync(file, 'utf-8');
          const parsed = sg.parse(lang, source);
          const matches = parsed.root().findAll(pattern);

          for (const match of matches) {
            const start = match.range().start;
            allMatches.push({
              file: relative(cwd, file),
              line: start.line + 1,
              code: match.text().slice(0, 120).replace(/\n/g, ' '),
            });
          }
        } catch { /* skip parse errors */ }
      }
    }

    if (allMatches.length === 0) return { content: [{ type: 'text', text: `No matches for pattern: ${pattern}` }] };

    const summary = allMatches.slice(0, 50).map(m => `  ${m.file}:${m.line}\n    ${m.code}`).join('\n');
    return {
      content: [{ type: 'text', text: `Found ${allMatches.length} match(es) for "${pattern}" (${language}):\n\n${summary}${allMatches.length > 50 ? '\n\n... and ' + (allMatches.length - 50) + ' more' : ''}` }],
    };
  },
};

// ============================================================
// Tool: ast_replace
// ============================================================
export const astReplaceTool = {
  name: 'ast_replace',
  description: 'Replace code using AST pattern matching. Searches for a pattern and replaces with a template, preserving formatting.',
  inputSchema: z.object({
    pattern: z.string().describe('AST-grep pattern to find'),
    replacement: z.string().describe('Replacement template (can use $VAR from pattern)'),
    language: z.enum(SUPPORTED_LANGUAGES),
    paths: z.array(z.string()).optional().describe('Files to modify (default: entire project)'),
    dryRun: z.boolean().optional().default(false).describe('Preview changes without applying'),
  }),
  handler: async ({ pattern, replacement, language, paths, dryRun }: { pattern: string; replacement: string; language: string; paths?: string[]; dryRun?: boolean }) => {
    const sg = await getSgModule();
    if (!sg) {
      return {
        isError: true,
        content: [{ type: 'text', text: `ast-grep module not available: ${sgLoadError}` }],
      };
    }

    const lang = toLangString(language);
    const cwd = process.cwd();
    const searchPaths = paths && paths.length > 0 ? paths.map(p => resolve(cwd, p)) : [cwd];

    let filesChanged = 0;
    const changes: Array<{ file: string; before: string; after: string }> = [];

    for (const searchPath of searchPaths) {
      const files = statSync(searchPath).isDirectory()
        ? getFilesForLanguage(searchPath, language)
        : [searchPath];

      for (const file of files) {
        try {
          const source = readFileSync(file, 'utf-8');
          const parsed = sg.parse(lang, source);
          const matches = parsed.root().findAll(pattern);

          if (matches.length === 0) continue;

          let newSource = source;
          for (const match of matches.reverse()) {
            const range = match.range();
            const replacementText = match.replace(replacement);
            newSource = newSource.slice(0, range.start.index) + replacementText + newSource.slice(range.end.index);
          }

          if (newSource !== source) {
            changes.push({ file: relative(cwd, file), before: source, after: newSource });
            if (!dryRun) writeFileSync(file, newSource, 'utf-8');
            filesChanged++;
          }
        } catch { /* skip errors */ }
      }
    }

    const action = dryRun ? 'Would change' : 'Changed';
    if (filesChanged === 0) return { content: [{ type: 'text', text: `No matches found for pattern: ${pattern}` }] };

    const summary = changes.slice(0, 10).map(c => `  ${c.file}`).join('\n');
    return {
      content: [{ type: 'text', text: `${action} ${filesChanged} file(s) matching "${pattern}":\n\n${summary}${changes.length > 10 ? '\n\n... and ' + (changes.length - 10) + ' more' : ''}` }],
    };
  },
};

// ============================================================
// Tool: ast_structure
// ============================================================
export const astStructureTool = {
  name: 'ast_structure',
  description: 'Get the AST structure summary of a file: top-level definitions, imports, complexity metrics.',
  inputSchema: z.object({
    file: z.string().describe('Path to the source file'),
    language: z.enum(SUPPORTED_LANGUAGES),
  }),
  handler: async ({ file, language }: { file: string; language: string }) => {
    const sg = await getSgModule();
    if (!sg) {
      return {
        isError: true,
        content: [{ type: 'text', text: `ast-grep not available: ${sgLoadError}` }],
      };
    }

    const lang = toLangString(language);
    const cwd = process.cwd();
    const filePath = resolve(cwd, file);

    const source = readFileSync(filePath, 'utf-8');
    const parsed = sg.parse(lang, source);
    const root = parsed.root();

    // Count nodes by kind
    const stats: Record<string, number> = {};
    function countNode(node: any) {
      const kind = node.kind();
      stats[kind] = (stats[kind] || 0) + 1;
      for (const child of node.children()) countNode(child);
    }
    countNode(root);

    // Get top-level definitions
    const kinds = ['function', 'class', 'interface', 'enum', 'struct', 'method', 'field', 'property'];
    const defs = root.findAll(`{${kinds.join(',')}}`);
    const defList = defs.slice(0, 30).map((d: any) => {
      const pos = d.startPos();
      return `  ${pos.line + 1}: ${d.kind()} ${d.text().slice(0, 60).replace(/\n/g, ' ')}`;
    }).join('\n');

    const totalNodes = Object.values(stats).reduce((a, b) => a + b, 0);
    return {
      content: [{ type: 'text', text: `AST Structure for ${file}\n\nTotal nodes: ${totalNodes}\nNode types: ${Object.entries(stats).sort((a, b) => b[1] - a[1]).slice(0, 15).map(([k, v]) => `  ${k}: ${v}`).join('\n')}\n\nDefinitions (${defs.length}):\n${defList || '  (none)'}${defs.length > 30 ? '\n\n... and ' + (defs.length - 30) + ' more' : ''}` }],
    };
  },
};

// ============================================================
// All AST tools
// ============================================================
export const astTools = [astGrepTool, astReplaceTool, astStructureTool];
