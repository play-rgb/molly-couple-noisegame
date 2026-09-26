import { getStore } from "@netlify/blobs";

const ALPHABET = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789"; // 헷갈리는 0/O, 1/I 제외
const CODE_RE = /^(?:[A-HJ-NP-Z2-9]{8}|[A-HJ-NP-Z2-9]{16})$/; // 기존 8자리도 계속 사용 가능
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
  const store = getStore({ name: "molly-rooms", consistency: "strong" });

  if (req.method === "GET") {
    const code = new URL(req.url).searchParams.get("code") || "";
    if (!CODE_RE.test(code)) return json({ error: "bad_code" }, 400);
    const room = await store.get(code, { type: "json" });
    if (!room) return json({ error: "not_found" }, 404);
    return json({ room });
  }

  if (req.method !== "POST") return json({ error: "method_not_allowed" }, 405);

  let body;
  try { body = await req.json(); } catch { return json({ error: "bad_json" }, 400); }

  if (body.op === "create") {
    let code = newCode();
    for (let i = 0; i < 5 && (await store.get(code)); i++) code = newCode();
    const items = (Array.isArray(body.items) ? body.items : [])
      .slice(0, MAX_ITEMS).map(cleanItem).filter(Boolean);
    const room = { items, pinned: items[0] ? items[0].id : null, updatedAt: Date.now() };
    await store.setJSON(code, room);
    return json({ code, room });
  }

  const code = String(body.code || "");
  if (!CODE_RE.test(code)) return json({ error: "bad_code" }, 400);
  const room = await store.get(code, { type: "json" });
  if (!room) return json({ error: "not_found" }, 404);

  if (body.op === "add") {
    const item = cleanItem(body.item);
    if (!item) return json({ error: "bad_item" }, 400);
    if (room.items.length >= MAX_ITEMS) return json({ error: "too_many" }, 400);
    room.items.push(item);
    if (!room.pinned) room.pinned = item.id;
  } else if (body.op === "delete") {
    room.items = room.items.filter((i) => i.id !== body.id);
    if (room.pinned === body.id) room.pinned = room.items[0] ? room.items[0].id : null;
  } else if (body.op === "pin") {
    if (room.items.some((i) => i.id === body.id)) room.pinned = body.id;
  } else {
    return json({ error: "bad_op" }, 400);
  }

  room.updatedAt = Date.now();
  await store.setJSON(code, room);
  return json({ room });
};

export const config = { path: "/api/room" };
