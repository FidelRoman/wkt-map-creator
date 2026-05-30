import { useState, useCallback, useRef } from 'react';

export function useUndoableState<T>(initialValue: T, maxHistory = 10) {
    const [state, _setState] = useState<T>(initialValue);
    const [past, setPast] = useState<T[]>([]);
    const [future, setFuture] = useState<T[]>([]);
    const isTracking = useRef(true);

    const setState = useCallback((nextValue: T | ((prev: T) => T), track = true) => {
        _setState(prev => {
            const next = typeof nextValue === 'function' ? (nextValue as any)(prev) : nextValue;
            if (track && isTracking.current) {
                setPast(p => [...p.slice(-(maxHistory - 1)), prev]);
                setFuture([]);
            }
            return next;
        });
    }, [maxHistory]);

    const undo = useCallback(() => {
        setPast(p => {
            if (p.length === 0) return p;
            const prev = p[p.length - 1];
            _setState(current => {
                setFuture(f => [current, ...f.slice(0, maxHistory - 1)]);
                return prev;
            });
            return p.slice(0, -1);
        });
    }, [maxHistory]);

    const redo = useCallback(() => {
        setFuture(f => {
            if (f.length === 0) return f;
            const next = f[0];
            _setState(current => {
                setPast(p => [...p.slice(-(maxHistory - 1)), current]);
                return next;
            });
            return f.slice(1);
        });
    }, [maxHistory]);

    const reset = useCallback((newValue: T) => {
        _setState(newValue);
        setPast([]);
        setFuture([]);
    }, []);

    return [
        state,
        setState,
        undo,
        redo,
        past.length > 0,
        future.length > 0,
        isTracking,
        reset
    ] as const;
}
