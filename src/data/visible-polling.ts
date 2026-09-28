// Visibility/focus/online events share one in-flight request and a short
// cooldown, so returning to a tab does not trigger several identical reloads.
export function visiblePolling(task: () => Promise<void>, interval: number) {
  let stopped = false,
    running = false,
    lastStarted = -Infinity;
  const update = async () => {
    if (
      stopped ||
      document.hidden ||
      !navigator.onLine ||
      running ||
      Date.now() - lastStarted < 1000
    )
      return;
    running = true;
    lastStarted = Date.now();
    try {
      await task();
    } finally {
      running = false;
    }
  };
  const run = () => {
    void update().catch(() => {
      /* task owns its error UI */
    });
  };
  const start = setTimeout(run, 0);
  const timer = setInterval(run, interval);
  window.addEventListener("focus", run);
  window.addEventListener("online", run);
  document.addEventListener("visibilitychange", run);
  return () => {
    stopped = true;
    clearTimeout(start);
    clearInterval(timer);
    window.removeEventListener("focus", run);
    window.removeEventListener("online", run);
    document.removeEventListener("visibilitychange", run);
  };
}
