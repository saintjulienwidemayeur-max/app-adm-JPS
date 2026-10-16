// The billing system is a separate app (repo JPS-billing) on the same database. BILLING_URL is its address (set it in Render > Environment).
export const BILLING_URL = (process.env.BILLING_URL ?? "").replace(/\/$/, "");
export const billingUrl = (path = "") => (BILLING_URL ? BILLING_URL + path : "");
