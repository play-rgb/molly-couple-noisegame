import { getStore } from "@netlify/blobs";

const ALPHABET = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
const CODE_RE = /^(?:[A-HJ-NP-Z2-9]{8}|[A-HJ-NP-Z2-9]{16})$/;
const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;
const MAX_ITEMS = 100;

const json = (data, status = 200) =>
  new Response(JSON.stringify(data), {
    status,
    headers: { "content-type": "application/json", "cache-control": "no-store" },
  });

function newCode() {
  const bytes = crypto.getRandomValues(new Uint8Array(16));
  return Array.from(bytes, (b) => ALPHABET[b % 32]).join("");
}

function cleanItem(raw) {
  if (!raw || typeof raw !== "object") return null;
  const title = String(raw.title || "").trim().slice(0, 40);
  const date = String(raw.date || "");
  if (!title || !DATE_RE.test(date)) return null;
  return { id: crypto.randomUUID().slice(0, 8), title, date, startOne: raw.startOne === true, auto: raw.auto === true };
}

export default async (req) => {
  const store =
