export interface Clock {
  now(): number;
  sleep(ms: number, signal?: AbortSignal): Promise<void>;
}

export class SystemClock implements Clock {
  now(): number {
    return Date.now();
  }

  sleep(ms: number, signal?: AbortSignal): Promise<void> {
    return sleepWithSignal(ms, signal);
  }
}

export class FakeClock implements Clock {
  private current: number;
  private waiters: Array<{ at: number; resolve: () => void; reject: (err: Error) => void; signal?: AbortSignal }> = [];

  constructor(start = 1_000_000) {
    this.current = start;
  }

  now(): number {
    return this.current;
  }

  async sleep(ms: number, signal?: AbortSignal): Promise<void> {
    if (ms <= 0) return;
    const at = this.current + ms;
    await new Promise<void>((resolve, reject) => {
      const waiter = { at, resolve, reject, signal };
      this.waiters.push(waiter);
      const onAbort = () => {
        this.waiters = this.waiters.filter((item) => item !== waiter);
        reject(Object.assign(new Error("aborted"), { name: "AbortError" }));
      };
      if (signal?.aborted) {
        onAbort();
        return;
      }
      signal?.addEventListener("abort", onAbort, { once: true });
    });
  }

  advance(ms: number): void {
    this.current += ms;
    const due = this.waiters.filter((waiter) => waiter.at <= this.current);
    this.waiters = this.waiters.filter((waiter) => waiter.at > this.current);
    for (const waiter of due) waiter.resolve();
  }
}

export function sleepWithSignal(ms: number, signal?: AbortSignal): Promise<void> {
  if (signal?.aborted) {
    return Promise.reject(Object.assign(new Error("aborted"), { name: "AbortError" }));
  }
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => {
      signal?.removeEventListener("abort", onAbort);
      resolve();
    }, ms);
    const onAbort = () => {
      clearTimeout(timer);
      reject(Object.assign(new Error("aborted"), { name: "AbortError" }));
    };
    signal?.addEventListener("abort", onAbort, { once: true });
  });
}
