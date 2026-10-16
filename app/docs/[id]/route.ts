import { getDoc } from "@/lib/persist";
import { tryLoaded } from "@/lib/persist";

export const dynamic = "force-dynamic";

// A PDF that was e-mailed to a customer, exactly as it was sent (signed-in people only: the middleware checks the cookie).
export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  await tryLoaded();
  const d = await getDoc((await params).id);
  if (!d) return new Response("Not found", { status: 404 });
  return new Response(new Uint8Array(d.data), { headers: { "content-type": "application/pdf", "content-disposition": `inline; filename="${d.name.replace(/[^\w.\- ]+/g, "_")}"` } });
}
