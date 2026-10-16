"use server";
import { redirect } from "next/navigation";
import { db, nowStr, timeNow } from "./wh-store";
import { ensureLoaded, flush } from "./persist";
import { requireAdmin } from "./users";
import { logAudit } from "./audit";
import { runInvites } from "./invites";

const PAGE = "/settings/invite";

// "Send today's invitations". Administrators only. At most 100 a day; people already invited wait until everybody has been invited once.
export async function sendInvitations() {
  await ensureLoaded();
  const me = await requireAdmin();
  let target = PAGE;
  try {
    const r = await runInvites();
    if (r.error) { logAudit(me.name, "send invitations", "", `refused: ${r.error}`); target = `${PAGE}?${new URLSearchParams({ err: r.error })}`; }
    else {
      const bits = [`${r.sent} invitation${r.sent === 1 ? "" : "s"} sent`, r.created && `${r.created} account${r.created === 1 ? "" : "s"} opened`, r.reminded && `${r.reminded} reminder${r.reminded === 1 ? "" : "s"}`, r.linked && `${r.linked} already had an account`].filter(Boolean).join(", ");
      logAudit(me.name, "send invitations", bits, r.failed.length ? `${r.failed.length} failed` : "ok");
      db.maillog.unshift({ id: db.n.mail++, date: nowStr(), time: timeNow(), by: me.name, subject: "Invitation to the customer website", to: "Invitations", sent: r.sent, total: r.sent + r.failed.length, failed: r.failed.slice(0, 20) });
      target = `${PAGE}?${new URLSearchParams({ ok: `${bits || "Nobody to invite right now"}.`, ...(r.failed.length && { fail: r.failed.slice(0, 5).join("; ") + (r.failed.length > 5 ? ` and ${r.failed.length - 5} more` : "") }) })}`;
    }
  } finally { await flush(); }
  redirect(target);
}
