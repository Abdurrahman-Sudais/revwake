// Bundles can contain $&, $`, $' and $$ literally. A callback prevents
// String.replace from interpreting these as replacement-string tokens.
export function insertBefore(html, marker, content) {
  if (!html.includes(marker)) throw new Error(`Missing HTML insertion marker: ${marker}`);
  return html.replace(marker, () => content + marker);
}
export function scriptElement(source) {
  // HTML end tags are case-insensitive, including inside JS strings.
  // Escaping the slash retains the string value and prevents an early end tag.
  const escaped = source.replace(/<\/script/gi, match => '<\\/' + match.slice(2));
  return `<script type="module">${escaped}</script>`;
}
