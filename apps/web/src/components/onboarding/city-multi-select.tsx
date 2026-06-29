"use client";

import { useEffect, useRef, useState } from "react";
import type { CityHit } from "@/lib/geo/filter";

/**
 * City multi-select: a chip/typeahead input backed by /api/geo/cities (the
 * country-state-city dataset, served server-side). Replaces free-text comma
 * entry so cities are picked from real data and can't be mistyped. Stores the
 * disambiguated label ("Los Angeles, CA") in `value`.
 */
export function CityMultiSelect({
  country,
  value,
  onChange,
  id,
}: {
  country: string;
  value: string[];
  onChange: (next: string[]) => void;
  id?: string;
}) {
  const [query, setQuery] = useState("");
  const [suggestions, setSuggestions] = useState<CityHit[]>([]);
  const [open, setOpen] = useState(false);
  const [active, setActive] = useState(0);
  const [loading, setLoading] = useState(false);
  const boxRef = useRef<HTMLDivElement>(null);

  // Debounced typeahead fetch (aborts the in-flight request on each keystroke).
  useEffect(() => {
    const q = query.trim();
    if (!q || !country) {
      setSuggestions([]);
      return;
    }
    setLoading(true);
    const ctrl = new AbortController();
    const timer = setTimeout(async () => {
      try {
        const res = await fetch(
          `/api/geo/cities?country=${encodeURIComponent(country)}&q=${encodeURIComponent(q)}`,
          { signal: ctrl.signal },
        );
        const data = await res.json();
        setSuggestions(Array.isArray(data.cities) ? (data.cities as CityHit[]) : []);
        setActive(0);
        setOpen(true);
      } catch {
        /* aborted or network error — leave previous suggestions */
      } finally {
        setLoading(false);
      }
    }, 200);
    return () => {
      clearTimeout(timer);
      ctrl.abort();
    };
  }, [query, country]);

  // Close the dropdown on outside click.
  useEffect(() => {
    function onDoc(e: MouseEvent) {
      if (boxRef.current && !boxRef.current.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener("mousedown", onDoc);
    return () => document.removeEventListener("mousedown", onDoc);
  }, []);

  function add(label: string) {
    const v = label.trim();
    if (v && !value.includes(v)) onChange([...value, v]);
    setQuery("");
    setSuggestions([]);
    setOpen(false);
  }

  function remove(label: string) {
    onChange(value.filter((c) => c !== label));
  }

  function onKeyDown(e: React.KeyboardEvent<HTMLInputElement>) {
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setOpen(true);
      setActive((a) => Math.min(a + 1, suggestions.length - 1));
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setActive((a) => Math.max(a - 1, 0));
    } else if (e.key === "Enter") {
      e.preventDefault();
      const pick = open ? suggestions[active] : undefined;
      if (pick) add(pick.label);
    } else if (e.key === "Backspace" && !query && value.length) {
      const last = value[value.length - 1];
      if (last) remove(last);
    } else if (e.key === "Escape") {
      setOpen(false);
    }
  }

  const disabled = !country;
  const listboxId = id ? `${id}-listbox` : undefined;

  return (
    <div ref={boxRef} className="relative">
      <div className="flex flex-wrap items-center gap-2 border border-border bg-surface-2 px-2 py-2">
        {value.map((c) => (
          <span
            key={c}
            className="inline-flex items-center gap-1 border border-border bg-bg px-2 py-1 text-xs text-ink"
          >
            {c}
            <button
              type="button"
              aria-label={`Remove ${c}`}
              onClick={() => remove(c)}
              className="leading-none text-ink-3 hover:text-ink"
            >
              ×
            </button>
          </span>
        ))}
        <input
          id={id}
          className="min-w-[9rem] flex-1 bg-transparent px-2 py-1 text-sm text-ink outline-none placeholder:text-ink-3"
          placeholder={
            disabled
              ? "Select a country first"
              : value.length
                ? "Add another city…"
                : "Type a city…"
          }
          value={query}
          disabled={disabled}
          onChange={(e) => setQuery(e.target.value)}
          onKeyDown={onKeyDown}
          onFocus={() => suggestions.length > 0 && setOpen(true)}
          role="combobox"
          aria-expanded={open}
          aria-controls={listboxId}
          aria-autocomplete="list"
          autoComplete="off"
        />
      </div>
      {open && (loading || suggestions.length > 0) && (
        <ul
          id={listboxId}
          role="listbox"
          className="absolute z-20 mt-1 max-h-60 w-full overflow-auto border border-border bg-surface-2 shadow-lg"
        >
          {loading && suggestions.length === 0 && (
            <li className="px-3 py-2 text-xs text-ink-3">Searching…</li>
          )}
          {suggestions.map((s, i) => {
            const already = value.includes(s.label);
            return (
              <li
                key={s.label}
                role="option"
                aria-selected={i === active}
                onMouseEnter={() => setActive(i)}
                onMouseDown={(e) => {
                  e.preventDefault();
                  if (!already) add(s.label);
                }}
                className={`flex cursor-pointer items-center justify-between px-3 py-2 text-sm ${
                  i === active ? "bg-bg text-ink" : "text-ink-2"
                } ${already ? "opacity-40" : ""}`}
              >
                <span>
                  {s.name}
                  {s.region ? <span className="text-ink-3">, {s.region}</span> : null}
                </span>
                {already && <span className="text-[10px] text-ink-3">added</span>}
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
