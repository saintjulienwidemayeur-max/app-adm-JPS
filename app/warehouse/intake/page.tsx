import { redirect } from "next/navigation";

// Intake was an old stand-alone prototype (fake data, nothing saved). Received items + Consolidate replaced it: old bookmarks land there.
export default function Page() { redirect("/warehouse/receiving"); }
