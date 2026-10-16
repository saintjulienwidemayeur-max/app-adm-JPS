// What a scanner reads is not always the tracking number: a QR code or 2D label (PDF417, Data Matrix, MaxiCode) holds a whole record, a USPS
// barcode starts with 420 + the ZIP code, a FedEx barcode is 34 digits, a QR code can be a tracking link. extractTracking() finds the
// tracking number in whatever was scanned. Pure functions: used by the server actions and the browser.

const PARAMS = ["tracknum", "tracknumbers", "trackingnumber", "trackingnumbers", "tracking_number", "trackingid", "tracking", "trknbr", "inquirynumber1", "tlabels", "labels", "numbers", "number", "tn", "id"];

// Letters and digits only, upper case. Scanners add control characters (GS, RS, EOT, Enter): they go.
const squash = (v: string) => v.toUpperCase().replace(/[^A-Z0-9]/g, "");

export function extractTracking(raw: string): string {
  let t = String(raw ?? "").replace(/[\u0000-\u001f\u007f]+/g, " ").trim(); // control characters between the fields of a 2D code
  if (!t) return "";
  // A link (QR code on a label or a receipt): the number is in a parameter or the last part of the path.
  if (/^https?:\/\//i.test(t)) {
    try {
      const u = new URL(t);
      for (const k of PARAMS) { const v = [...u.searchParams].find(([n]) => n.toLowerCase() === k)?.[1]; if (v) { const x = extractTracking(v.split(/[,\s]/)[0]); if (x) return x; } }
      const last = decodeURIComponent(u.pathname.split("/").filter(Boolean).pop() ?? "");
      if (squash(last).length >= 8) return extractTracking(last);
    } catch { /* not a link after all */ }
  }
  const s = t.toUpperCase();
  const flat = s.replace(/[\s-]+/g, "");
  // UPS: 1Z + 16 characters, anywhere in the text (also inside the MaxiCode / PDF417 record).
  const ups = flat.match(/1Z[0-9A-Z]{16}/);
  if (ups) return ups[0];
  // Amazon Logistics.
  const tba = flat.match(/TBA\d{9,15}/);
  if (tba) return tba[0];
  // Other well-known formats inside a longer text: USPS S10 / international (2 letters, 9 digits, US), 13-character postal numbers.
  const s10 = flat.match(/[A-Z]{2}\d{9}[A-Z]{2}/);
  if (s10 && flat !== s10[0] && /^[A-Z]{2}/.test(s10[0]) && !/^\d+$/.test(flat)) return s10[0];
  const digits = flat.replace(/\D/g, "");
  if (/^\d+$/.test(flat) || (digits.length >= 18 && digits.length >= flat.length - 2)) {
    const d = /^\d+$/.test(flat) ? flat : digits;
    // USPS: 420 + ZIP (5 or 9 digits) + the 20-22 digit tracking number (starting with 9).
    const m = d.match(/^420(?:\d{9}(9\d{19,21})|\d{5}(9\d{19,21}))$/);
    if (m) return m[1] ?? m[2];
    // FedEx Ground / Express label barcode: 34 digits (starting with 96 or 00...): the tracking number is at the end.
    if (d.length === 34 || d.length === 32) return d.slice(-12);
    if (d.length >= 30 && d.length < 34) return d;
    return d;
  }
  // A short record "TRACK:xxxxxxxx" or fields separated by spaces/commas: take the longest token that has a digit and is at least 8 long.
  const tokens = s.split(/[^A-Z0-9]+/).filter((x) => x.length >= 8 && x.length <= 40 && /\d/.test(x)).sort((a, b) => b.length - a.length);
  if (tokens.length && !/^[A-Z0-9]{8,40}$/.test(flat)) return tokens[0];
  return squash(s);
}

// Two tracking numbers are the same parcel: equal, or one is the tail of the other (FedEx barcodes carry extra leading digits).
export const sameTracking = (a: string, b: string) => {
  const x = squash(a), y = squash(b);
  if (!x || !y) return false;
  if (x === y) return true;
  const [short, long] = x.length <= y.length ? [x, y] : [y, x];
  return short.length >= 10 && long.endsWith(short);
};
