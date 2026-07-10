import { readAll, addMemory } from "../../../lib/store";
import { checkAuth } from "../../../lib/auth";

export async function GET(req) {
  const denied = checkAuth(req);
  if (denied) return denied;
  const memories = await readAll();
  memories.sort((a, b) => Number(b.pinned) - Number(a.pinned) || b.createdAt - a.createdAt);
  return Response.json({ memories });
}

export async function POST(req) {
  const denied = checkAuth(req);
  if (denied) return denied;
  try {
    const body = await req.json();
    const mem = await addMemory(body);
    return Response.json({ memory: mem }, { status: 201 });
  } catch (e) {
    return Response.json({ error: e.message }, { status: 400 });
  }
}
