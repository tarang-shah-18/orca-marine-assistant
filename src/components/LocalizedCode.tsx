/**
 * Renders a translated sentence while keeping the literal identifiers inside
 * it in monospace.
 *
 * The identifier tokens — `GEMINI_API_KEY`, `mobile/src/services/api.js`,
 * `eas.json`, `EXPO_PUBLIC_ORCA_API=https://your-host` — are not prose. They are
 * spelled out verbatim in every one of the eleven translations, because a
 * translation is not allowed to rename an environment variable or a file path.
 *
 * That gives us a way to highlight them without adding an i18n key per token: the
 * translated string is split on the identifiers and the matches are wrapped in a
 * `<code>` chip. A token that is absent from a given translation simply never
 * matches, so a wording change can never break the render.
 *
 * Nothing else about the sentence is touched — no reordering, no re-punctuation —
 * because a translated safety sentence must reach the screen exactly as it was
 * written.
 */
import React from 'react';

const escapeForRegExp = (value: string): string => value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

const escapeForHtml = (value: string): string =>
  value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');

/**
 * @param text    the translated sentence
 * @param tokens  identifiers to render in monospace
 * @param className classes for each `<code>` chip
 */
export const codeText = (
  text: string,
  tokens: string[],
  className = 'text-cyan-300 bg-slate-900 px-1 py-0.5 rounded',
): React.ReactNode => {
  const present = tokens.filter((token) => token && text.includes(token));
  if (present.length === 0) return text;

  const pattern = new RegExp(`(${present.map(escapeForRegExp).join('|')})`, 'g');
  return text.split(pattern).map((part, index) =>
    present.includes(part) ? (
      <code key={index} className={className}>
        {part}
      </code>
    ) : (
      <React.Fragment key={index}>{part}</React.Fragment>
    ),
  );
};

/**
 * Same as {@link codeText}, for strings that are injected as HTML — a Leaflet
 * tooltip, for instance. The tokens are escaped before insertion, so a token can
 * never be used to smuggle markup in.
 */
export const codeTextHtml = (text: string, tokens: string[], className = ''): string => {
  const present = tokens.filter((token) => token && text.includes(token));
  if (present.length === 0) return escapeForHtml(text);

  const pattern = new RegExp(`(${present.map(escapeForRegExp).join('|')})`, 'g');
  return text
    .split(pattern)
    .map((part) =>
      present.includes(part)
        ? `<code${className ? ` class="${className}"` : ''}>${escapeForHtml(part)}</code>`
        : escapeForHtml(part),
    )
    .join('');
};

export default codeText;