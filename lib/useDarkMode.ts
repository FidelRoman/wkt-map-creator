"use client";

import { useState, useEffect, useCallback } from "react";

const STORAGE_KEY = "wkt-theme";

export function useDarkMode() {
    const [dark, setDark] = useState(false);

    useEffect(() => {
        const stored = localStorage.getItem(STORAGE_KEY);
        const prefersDark = window.matchMedia("(prefers-color-scheme: dark)").matches;
        const isDark = stored ? stored === "dark" : prefersDark;
        setDark(isDark);
        document.documentElement.classList.toggle("dark", isDark);
    }, []);

    const toggle = useCallback(() => {
        setDark(prev => {
            const next = !prev;
            document.documentElement.classList.toggle("dark", next);
            localStorage.setItem(STORAGE_KEY, next ? "dark" : "light");
            return next;
        });
    }, []);

    return { dark, toggle };
}
