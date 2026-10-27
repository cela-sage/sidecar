let open = 0;

const join = (): (() => void) => {
  open += 1;
  let left = false;
  return () => {
    if (left) return;
    left = true;
    open -= 1;
  };
};

export const EventListeners = { count: (): number => open, join };
