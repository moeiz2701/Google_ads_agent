"use client";

import { useEffect, useState } from "react";
import { COUNTRIES } from "@gaa/shared";
import { Select } from "@/components/ui/primitives";

/**
 * Country dropdown. Renders immediately from the small curated `COUNTRIES`
 * fallback, then upgrades to the full ISO list from /api/geo/countries (the
 * country-state-city dataset) once it loads — so the list is data-backed, not
 * hand-maintained, without blocking first paint.
 */
type Option = { code: string; name: string };

export function CountrySelect({
  id,
  value,
  onChange,
}: {
  id?: string;
  value: string;
  onChange: (code: string) => void;
}) {
  const [options, setOptions] = useState<Option[]>(COUNTRIES);

  useEffect(() => {
    let alive = true;
    fetch("/api/geo/countries")
      .then((r) => r.json())
      .then((d) => {
        if (alive && Array.isArray(d.countries) && d.countries.length) {
          setOptions(d.countries as Option[]);
        }
      })
      .catch(() => {
        /* keep the fallback list */
      });
    return () => {
      alive = false;
    };
  }, []);

  return (
    <Select id={id} value={value} onChange={(e) => onChange(e.target.value)}>
      {options.map((c) => (
        <option key={c.code} value={c.code}>
          {c.name}
        </option>
      ))}
    </Select>
  );
}
