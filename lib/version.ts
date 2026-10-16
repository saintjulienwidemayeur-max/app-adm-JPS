// Which version is running (Render sets RENDER_GIT_COMMIT to the commit it deployed): shown on the sign-in page and under the menu.
export const VERSION = (process.env.RENDER_GIT_COMMIT || process.env.VERCEL_GIT_COMMIT_SHA || "local").slice(0, 7);
