"use client";

import "leaflet/dist/leaflet.css";

import L from "leaflet";
import { useEffect, useRef } from "react";

import type { LocationWire } from "./settings-wire";

const CAIRO: L.LatLngTuple = [30.0444, 31.2357];

/*
  A div pin in the dashboard's own tokens. Leaflet's default pin points at PNGs
  through a CSS path that bundlers break, and it would not match anyway.
*/
const pin = L.divIcon({
  className: "",
  html: '<span class="block size-5 rounded-full border-2 border-background bg-primary shadow-md"></span>',
  iconSize: [20, 20],
  iconAnchor: [10, 10],
});

/**
 * Leaflet + OpenStreetMap tiles. Browser only — loaded through `next/dynamic`
 * with `ssr: false`, because Leaflet touches `window` the moment it is imported.
 *
 * Controlled from outside: `point` places the pin, and a click or a drag only
 * REPORTS a point through `onPick`; the section decides what to keep.
 */
export default function LocationMap({
  point,
  onPick,
  label,
}: {
  point: LocationWire | null;
  onPick: (point: LocationWire) => void;
  label: string;
}) {
  const box = useRef<HTMLDivElement>(null);
  const map = useRef<L.Map | null>(null);
  const marker = useRef<L.Marker | null>(null);
  const pick = useRef(onPick);
  const start = useRef(point);

  useEffect(() => {
    pick.current = onPick;
  }, [onPick]);

  useEffect(() => {
    if (!box.current) return;
    const first = start.current;
    const m = L.map(box.current).setView(
      first ? [first.latitude, first.longitude] : CAIRO,
      first ? 16 : 12
    );
    L.tileLayer("https://tile.openstreetmap.org/{z}/{x}/{y}.png", {
      maxZoom: 19,
      attribution:
        '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>',
    }).addTo(m);
    m.on("click", (event) =>
      pick.current({ latitude: event.latlng.lat, longitude: event.latlng.lng })
    );
    map.current = m;
    return () => {
      m.remove();
      map.current = null;
      marker.current = null;
    };
  }, []);

  useEffect(() => {
    const m = map.current;
    if (!m) return;
    if (!point) {
      marker.current?.remove();
      marker.current = null;
      return;
    }
    const at: L.LatLngTuple = [point.latitude, point.longitude];
    if (marker.current) {
      marker.current.setLatLng(at);
    } else {
      const placed = L.marker(at, { draggable: true, icon: pin }).addTo(m);
      placed.on("dragend", () => {
        const { lat, lng } = placed.getLatLng();
        pick.current({ latitude: lat, longitude: lng });
      });
      marker.current = placed;
    }
    if (!m.getBounds().contains(at)) m.setView(at, Math.max(m.getZoom(), 15));
  }, [point]);

  return (
    <div
      ref={box}
      dir="ltr"
      role="region"
      aria-label={label}
      // `isolate`: Leaflet's panes sit at z-index 400+, which would otherwise
      // float over the sticky save bar.
      className="isolate h-72 w-full overflow-hidden rounded-md border border-border"
    />
  );
}
