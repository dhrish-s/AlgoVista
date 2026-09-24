interface InFlightEntry<T> {
  controller: AbortController;
  promise: Promise<T>;
  consumers: number;
  settled: boolean;
}

const abortError = (): Error => {
  const error = new Error('Request was cancelled');
  error.name = 'AbortError';
  return error;
};

export class InFlightRequestDeduplicator<T> {
  private readonly entries = new Map<string, InFlightEntry<T>>();

  run(
    key: string,
    consumerSignal: AbortSignal | undefined,
    execute: (sharedSignal: AbortSignal) => Promise<T>
  ): Promise<T> {
    if (consumerSignal?.aborted) return Promise.reject(abortError());

    let entry = this.entries.get(key);
    if (!entry) {
      const controller = new AbortController();
      entry = { controller, promise: Promise.resolve(undefined as T), consumers: 0, settled: false };
      const currentEntry = entry;
      entry.promise = Promise.resolve()
        .then(() => execute(controller.signal))
        .then(
          (value) => {
            currentEntry.settled = true;
            return value;
          },
          (error) => {
            currentEntry.settled = true;
            throw error;
          }
        )
        .finally(() => {
          if (this.entries.get(key) === currentEntry) this.entries.delete(key);
        });
      this.entries.set(key, entry);
    }

    entry.consumers += 1;
    const sharedEntry = entry;
    return new Promise<T>((resolve, reject) => {
      let released = false;
      const release = () => {
        if (released) return;
        released = true;
        consumerSignal?.removeEventListener('abort', onAbort);
        sharedEntry.consumers -= 1;
        if (sharedEntry.consumers === 0 && !sharedEntry.settled) {
          sharedEntry.controller.abort();
          if (this.entries.get(key) === sharedEntry) this.entries.delete(key);
        }
      };
      const onAbort = () => {
        release();
        reject(abortError());
      };

      consumerSignal?.addEventListener('abort', onAbort, { once: true });
      sharedEntry.promise.then(
        (value) => {
          if (released) return;
          release();
          resolve(value);
        },
        (error) => {
          if (released) return;
          release();
          reject(error);
        }
      );
    });
  }
}
