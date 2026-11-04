// The words a parent typed in an email reply, without the quoted digest
// underneath. Mail clients mark the quote differently; we cut at the first
// marker any of them use and drop trailing signatures.

const QUOTE_MARKERS: RegExp[] = [
  /^On .{0,200}wrote:\s*$/,            // Gmail / Apple Mail ("On Tue, Nov 4 … wrote:")
  /^-{2,}\s*Original Message\s*-{2,}/i, // Outlook classic
  /^_{10,}\s*$/,                        // Outlook divider
  /^From:\s.+$/,                        // Forwarded/quoted header block
  /^Le .{0,200}a écrit\s*:\s*$/,        // French clients
  /^El .{0,200}escribió:\s*$/,          // Spanish clients
];

const SIGNATURE_MARKERS: RegExp[] = [
  /^--\s*$/,
  /^Sent from my (iPhone|iPad|Galaxy|Android|phone)/i,
  /^Get Outlook for /i,
];

export function extractReplyText(text: string | null, html: string | null): string {
  let body = text ?? "";
  if (!body.trim() && html) body = htmlToText(html);

  const lines = body.replace(/\r\n/g, "\n").split("\n");
  const kept: string[] = [];
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    // Gmail sometimes wraps "On … wrote:" across two lines; join to test.
    const probe = line + (lines[i + 1] ? " " + lines[i + 1] : "");
    if (QUOTE_MARKERS.some((re) => re.test(line.trim()) || re.test(probe.trim()))) break;
    if (line.trim().startsWith(">")) break;
    if (SIGNATURE_MARKERS.some((re) => re.test(line.trim()))) break;
    kept.push(line);
  }
  return kept.join("\n").trim();
}

function htmlToText(html: string): string {
  // Everything after the client's quote container is the digest, not the reply.
  const cut = html.search(/<div[^>]+class="?gmail_quote|<blockquote|<div[^>]+id="?(divRplyFwdMsg|appendonsend)/i);
  const own = cut === -1 ? html : html.slice(0, cut);
  return own
    .replace(/<style[\s\S]*?<\/style>/gi, "")
    .replace(/<br\s*\/?>/gi, "\n")
    .replace(/<\/(p|div|li|tr|h[1-6])>/gi, "\n")
    .replace(/<[^>]+>/g, "")
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/\n{3,}/g, "\n\n");
}
