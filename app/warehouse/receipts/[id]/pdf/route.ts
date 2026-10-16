import { db, wrCode } from "@/lib/wh-store";
import { tryLoaded } from "@/lib/persist";
import { receiptPdf } from "@/lib/pdf";

export const dynamic = "force-dynamic";

// The warehouse receipt as a PDF, made now from the receipt as it is.
export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  await tryLoaded();
  const { id } = await params;
  const w = db.wrs.find((x) => x.id === id);
  if (!w) return new Response("Not found", { status: 404 });
  return new Response(Buffer.from(await receiptPdf(w)), { headers: { "content-type": "application/pdf", "content-disposition": `inline; filename="Receipt-${wrCode(w)}.pdf"` } });
}
