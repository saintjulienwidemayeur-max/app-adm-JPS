// What every server action goes through: the database copy is loaded, the person must be signed in, the action runs, it is written to the
// activity log (who, which action, with what, how it ended), and what changed is saved (also when the action ends with a redirect).
import { ensureLoaded, flush, refresh } from "./persist";
import { requireUser } from "./users";
import { logAudit, summarize } from "./audit";

const decode = (s: string) => { try { return decodeURIComponent(s.replace(/\+/g, " ")); } catch { return s; } };
const words = (n: string) => n.replace(/([a-z])([A-Z])/g, "$1 $2").toLowerCase();

export const act = <A extends unknown[]>(name: string, fn: (...a: A) => Promise<void>) => async (...a: A): Promise<void> => {
  await ensureLoaded();
  await refresh();
  const user = await requireUser();
  let result = "ok";
  try { await fn(...a); }
  catch (e) {
    const digest = (e as { digest?: string })?.digest;
    if (typeof digest === "string" && digest.startsWith("NEXT_REDIRECT")) { const m = digest.match(/[?&]err=([^&;]*)/); result = m ? `refused: ${decode(m[1])}` : "ok"; }
    else result = `error: ${e instanceof Error ? e.message : String(e)}`;
    throw e;
  } finally { logAudit(user.name, words(name), summarize(a), result); await flush(); }
};
