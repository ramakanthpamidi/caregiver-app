import React from 'react';
import { BackHandler, StyleSheet, View } from 'react-native';

type DialogPortalContextValue = {
  setEntry: (id: string, node: React.ReactNode) => void;
  removeEntry: (id: string) => void;
  setBackHandler: (id: string, handler: (() => boolean | void) | null | undefined) => void;
  removeBackHandler: (id: string) => void;
};

const DialogPortalContext = React.createContext<DialogPortalContextValue | null>(null);

export function DialogPortalProvider({ children }: { children: React.ReactNode }) {
  const [entries, setEntries] = React.useState<Array<{ id: string; node: React.ReactNode }>>([]);
  const entriesRef = React.useRef<Array<{ id: string; node: React.ReactNode }>>([]);
  const backHandlersRef = React.useRef(new Map<string, () => boolean | void>());
  const [backStackVersion, bumpBackStackVersion] = React.useReducer((value: number) => value + 1, 0);

  React.useEffect(() => {
    entriesRef.current = entries;
  }, [entries]);

  const setEntry = React.useCallback((id: string, node: React.ReactNode) => {
    setEntries((prev) => {
      const index = prev.findIndex((entry) => entry.id === id);
      if (index === -1) return [...prev, { id, node }];

      const next = prev.slice();
      next[index] = { id, node };
      return next;
    });
  }, []);

  const removeEntry = React.useCallback((id: string) => {
    setEntries((prev) => {
      if (!prev.some((entry) => entry.id === id)) return prev;
      return prev.filter((entry) => entry.id !== id);
    });
    backHandlersRef.current.delete(id);
    bumpBackStackVersion();
  }, []);

  const setBackHandler = React.useCallback((id: string, handler: (() => boolean | void) | null | undefined) => {
    if (!handler) {
      backHandlersRef.current.delete(id);
      bumpBackStackVersion();
      return;
    }
    backHandlersRef.current.set(id, handler);
    bumpBackStackVersion();
  }, []);

  const removeBackHandler = React.useCallback((id: string) => {
    backHandlersRef.current.delete(id);
    bumpBackStackVersion();
  }, []);

  React.useEffect(() => {
    // Only subscribe while something is open so empty back-presses are not handled here.
    if (entries.length === 0 && backHandlersRef.current.size === 0) {
      return;
    }

    const sub = BackHandler.addEventListener('hardwareBackPress', () => {
      const currentEntries = entriesRef.current;

      for (let index = currentEntries.length - 1; index >= 0; index -= 1) {
        const handler = backHandlersRef.current.get(currentEntries[index].id);
        if (!handler) continue;
        return handler() !== false;
      }

      const standalone = Array.from(backHandlersRef.current.entries()).reverse();
      for (const [id, handler] of standalone) {
        if (currentEntries.some((entry) => entry.id === id)) continue;
        return handler() !== false;
      }

      return false;
    });
    return () => sub.remove();
  }, [backStackVersion, entries]);

  const value = React.useMemo(
    () => ({ setEntry, removeEntry, setBackHandler, removeBackHandler }),
    [removeBackHandler, removeEntry, setBackHandler, setEntry],
  );

  return (
    <DialogPortalContext.Provider value={value}>
      <View style={styles.root}>
        <View style={styles.content}>{children}</View>
        {entries.length > 0 ? (
          <View pointerEvents="box-none" style={styles.portalLayer}>
            {entries.map((entry) => (
              <React.Fragment key={entry.id}>{entry.node}</React.Fragment>
            ))}
          </View>
        ) : null}
      </View>
    </DialogPortalContext.Provider>
  );
}

export function useDialogPortal() {
  return React.useContext(DialogPortalContext);
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
  },
  content: {
    flex: 1,
  },
  portalLayer: {
    ...StyleSheet.absoluteFillObject,
    zIndex: 10000,
    elevation: 10000,
  },
});