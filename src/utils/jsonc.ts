import { parse as parseJsoncLib, type ParseError } from 'jsonc-parser';

export function parseJsonc(text: string): unknown {
  const errors: ParseError[] = [];
  const result = parseJsoncLib(text, errors, { allowTrailingComma: true });
  if (errors.length > 0) {
    const messages = errors.map(e => String(e.error));
    throw new Error(`JSONC parse errors: ${messages.join(', ')}`);
  }
  return result;
}
