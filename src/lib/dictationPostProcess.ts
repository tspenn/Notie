/**
 * Lightweight dictation cleanup.
 * - Spoken punctuation → symbols (word-boundary safe)
 * - Whitespace normalize
 * - Sentence-case after ".", "?", "!"
 */

export function polishDictation(raw: string): string {
  let text = (raw || '').replace(/\s+/g, ' ').trim();
  if (!text) return '';

  const spokenMap: Array<[RegExp, string]> = [
    [/\bnew line\b/gi, '\n'],
    [/\bnew paragraph\b/gi, '\n\n'],
    [/\bcomma\b/gi, ','],
    [/\b(period|dot)\b/gi, '.'],
    [/\bfull stop\b/gi, '.'],
    [/\bquestion mark\b/gi, '?'],
    [/\bexclamation point\b/gi, '!'],
    [/\bexclamation mark\b/gi, '!'],
    [/\bsemicolon\b/gi, ';'],
    [/\bcolon\b/gi, ':'],
    [/\bslash\b/gi, '/'],
    [/\bbackslash\b/gi, '\\'],
    [/\bdash\b/gi, '—'],
    [/\bhyphen\b/gi, '-'],
    [/\bopen quote\b/gi, '“'],
    [/\bclose quote\b/gi, '”'],
    [/\bquote\b/gi, '"'],
  ];

  for (const [re, rep] of spokenMap) {
    text = text.replace(re, rep);
  }

  text = text
    .replace(/\s+([,.;:!?])/g, '$1')
    .replace(/([,.;:!?])\s{2,}/g, '$1 ')
    .replace(/\s+\n/g, '\n')
    .replace(/\n\s+/g, '\n')
    .replace(/\n{3,}/g, '\n\n')
    .trim();

  text = text.replace(/([.!?]\s+)([a-z])/g, (_m, p1: string, ch: string) => `${p1}${ch.toUpperCase()}`);
  if (/^[a-z]/.test(text)) {
    text = text.charAt(0).toUpperCase() + text.slice(1);
  }

  return text;
}

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

/** Turn polished dictation into TipTap-friendly HTML paragraphs. */
export function dictationToHtml(text: string, opts?: { leadingSpace?: boolean }): string {
  const cleaned = String(text || '').trim();
  if (!cleaned) return '';
  const paras = cleaned.split(/\n\n+/);
  return paras
    .map((para, i) => {
      let body = escapeHtml(para).replace(/\n/g, '<br>');
      if (i === 0 && opts?.leadingSpace) body = ` ${body}`;
      return `<p>${body}</p>`;
    })
    .join('');
}
