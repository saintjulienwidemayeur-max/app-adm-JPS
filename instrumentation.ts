// Runs once when the server starts: loads the data from the database before the first page is served.
export async function register() {
  if (process.env.NEXT_RUNTIME === "nodejs") {
    const { start } = await import("./instrumentation-node");
    await start();
  }
}
