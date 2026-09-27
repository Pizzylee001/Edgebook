"use client";

import { useEffect, useRef } from "react";

const CELL_COUNT = 22;
const CELL_SIZE = 44;

export default function AppBackground() {
  const cellsRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const container = cellsRef.current;
    if (!container) {
      return;
    }

    const mediaQuery = window.matchMedia("(prefers-reduced-motion: reduce)");
    if (mediaQuery.matches) {
      return;
    }

    const timers: ReturnType<typeof setTimeout>[] = [];
    let isCancelled = false;

    for (let i = 0; i < CELL_COUNT; i++) {
      const cell = document.createElement("span");
      cell.className = "app-bg-cell";

      const maxCols = Math.max(1, Math.floor(window.innerWidth / CELL_SIZE));
      const maxRows = Math.max(1, Math.floor(window.innerHeight / CELL_SIZE));
      cell.style.left = `${Math.floor(Math.random() * maxCols) * CELL_SIZE}px`;
      cell.style.top = `${Math.floor(Math.random() * maxRows) * CELL_SIZE}px`;

      container.appendChild(cell);

      const pulse = () => {
        if (isCancelled) {
          return;
        }

        const cols = Math.max(1, Math.floor(window.innerWidth / CELL_SIZE));
        const rows = Math.max(1, Math.floor(window.innerHeight / CELL_SIZE));
        cell.style.left = `${Math.floor(Math.random() * cols) * CELL_SIZE}px`;
        cell.style.top = `${Math.floor(Math.random() * rows) * CELL_SIZE}px`;
        cell.style.opacity = (Math.random() * 0.5 + 0.15).toFixed(2);

        const tFade = setTimeout(() => {
          if (!isCancelled) {
            cell.style.opacity = "0";
          }
        }, 700);
        timers.push(tFade);

        const tNext = setTimeout(pulse, 1400 + Math.random() * 2600);
        timers.push(tNext);
      };

      const tInitial = setTimeout(pulse, Math.random() * 2000);
      timers.push(tInitial);
    }

    return () => {
      isCancelled = true;
      for (const t of timers) {
        clearTimeout(t);
      }
      container.replaceChildren();
    };
  }, []);

  return (
    <div className="app-bg-void" aria-hidden="true">
      <div className="app-bg-grid" />
      <div className="app-bg-backlight" />
      <div ref={cellsRef} className="app-bg-cells" />
    </div>
  );
}
