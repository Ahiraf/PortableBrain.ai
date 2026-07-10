import { deleteMemory, updateMemory } from "../../../../lib/store";
import { checkAuth } from "../../../../lib/auth";

export async function PATCH(req, { params }) {
  const denied = checkAuth(req);
  if (denied) return denied;
  const { id } = await params;
  const patch = await req.json();
  const mem = await updateMemory(id, patch);
  if (!mem) return Response.json({ error: "Not found" }, { status: 404 });
  return Response.json({ memory: mem });
}

export async function DELETE(req, { params }) {
  const denied = checkAuth(req);
  if (denied) return denied;
  const { id } = await params;
  const ok = await deleteMemory(id);
  if (!ok) return Response.json({ error: "Not found" }, { status: 404 });
  return Response.json({ ok: true });
}
