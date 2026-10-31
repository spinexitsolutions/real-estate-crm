export async function register() {
  if (process.env.NEXT_RUNTIME === "nodejs") {
    const { applyAppTimezone } = await import("./lib/timezone");
    applyAppTimezone();
  }
}
