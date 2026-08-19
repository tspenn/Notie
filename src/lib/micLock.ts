type Owner = 'notebook-voice' | 'dashboard-voice';

type StopCallback = () => void;

interface Lock {
  owner: Owner;
  stop: StopCallback;
}

let current: Lock | null = null;

/** One mic owner at a time (notebook editor vs dashboard quick capture). */
export const micLock = {
  acquire(owner: Owner, stop: StopCallback): boolean {
    if (current && current.owner !== owner) {
      try {
        current.stop();
      } catch {
        // ignore
      }
      current = null;
    }
    current = { owner, stop };
    return true;
  },

  release(owner: Owner) {
    if (current?.owner === owner) {
      current = null;
    }
  },

  isHeldBy(owner: Owner): boolean {
    return current?.owner === owner;
  },
};
