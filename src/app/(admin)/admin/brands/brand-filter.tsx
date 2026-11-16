"use client";

/**
 * "Narrow this list to one shop", as a picker of shop names rather than a box
 * for a pasted id. Used by the products, settlements and imports lists, which
 * all filter by `brandId` on the API side.
 */
import {
  NativeSelect,
  NativeSelectOption,
} from "@/components/ui/native-select";
import { ApiError } from "@/lib/api";
import { useMessages } from "@/lib/locale-context";

import { useBrandOptions } from "./brands-data";

/**
 * The API refused the filter (400/422) — a bad id in the URL, say. That is
 * "this filter is not valid", not "check the connection".
 */
export const isFilterRefused = (error: unknown): boolean =>
  error instanceof ApiError && (error.statusCode === 400 || error.statusCode === 422);

export function BrandFilter({
  id,
  value,
  onChange,
}: {
  id: string;
  value: string;
  onChange: (brandId: string) => void;
}) {
  const a = useMessages().admin;
  const brands = useBrandOptions();
  const options = brands.data ?? [];
  // An id from the URL that is not in the list stays selectable, so the
  // select never silently shows "all shops" while the list is filtered.
  const unknown = value !== "" && !options.some((brand) => brand.id === value);

  return (
    <div className="grid gap-2">
      <label htmlFor={id} className="text-sm font-medium text-foreground">
        {a.filterShop}
      </label>
      <NativeSelect
        id={id}
        className="w-full max-w-xs"
        value={value}
        onChange={(event) => onChange(event.target.value)}
      >
        <NativeSelectOption value="">{a.allShops}</NativeSelectOption>
        {unknown ? <NativeSelectOption value={value}>{value}</NativeSelectOption> : null}
        {options.map((brand) => (
          <NativeSelectOption key={brand.id} value={brand.id}>
            {brand.name}
          </NativeSelectOption>
        ))}
      </NativeSelect>
      {brands.error ? (
        <p className="max-w-xs text-xs text-state-bad-fg">{a.importBrandsFailed}</p>
      ) : null}
    </div>
  );
}
