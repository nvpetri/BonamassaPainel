import { afterEach, expect, test, vi } from "vitest";
import { visiblePolling } from "./visible-polling";
afterEach(() => {
  vi.useRealTimers();
  vi.unstubAllGlobals();
});
test("pauses hidden/offline polling, coalesces events, resumes and cleans up", async () => {
  vi.useFakeTimers();
  const doc = Object.assign(new EventTarget(), { hidden: true });
  const win = new EventTarget();
  const net = { onLine: true };
  vi.stubGlobal("document", doc);
  vi.stubGlobal("window", win);
  vi.stubGlobal("navigator", net);
  let done!: () => void;
  const task = vi.fn(
    () =>
      new Promise<void>((resolve) => {
        done = resolve;
      }),
  );
  const stop = visiblePolling(task, 5000);
  await vi.advanceTimersByTimeAsync(5000);
  expect(task).not.toHaveBeenCalled();
  doc.hidden = false;
  doc.dispatchEvent(new Event("visibilitychange"));
  win.dispatchEvent(new Event("focus"));
  expect(task).toHaveBeenCalledTimes(1);
  await vi.advanceTimersByTimeAsync(10000);
  expect(task).toHaveBeenCalledTimes(1);
  done();
  await Promise.resolve();
  net.onLine = false;
  await vi.advanceTimersByTimeAsync(5000);
  expect(task).toHaveBeenCalledTimes(1);
  net.onLine = true;
  win.dispatchEvent(new Event("online"));
  expect(task).toHaveBeenCalledTimes(2);
  stop();
  done();
  await Promise.resolve();
  await vi.advanceTimersByTimeAsync(10000);
  win.dispatchEvent(new Event("focus"));
  expect(task).toHaveBeenCalledTimes(2);
});
