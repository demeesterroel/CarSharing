"use client";
import { useEffect, useRef, useState } from "react";
import { paper, fontMono, fontSerif } from "@/lib/paper-theme";
import { t } from "@/lib/i18n";

interface Props {
  address: string | null;      // human-readable; stored in location column
  coords: string | null;       // "lat, lng"; stored in gps_coords column
  onAddressChange: (v: string | null) => void;
  onCoordsChange: (v: string | null) => void;
}

function parseCoords(val: string | null): [number, number] | null {
  if (!val) return null;
  const m = val.match(/^([\d.-]+)\s*,\s*([\d.-]+)$/);
  return m ? [parseFloat(m[1]), parseFloat(m[2])] : null;
}

async function reverseGeocode(lat: number, lng: number): Promise<string> {
  try {
    const res = await fetch(
      `https://nominatim.openstreetmap.org/reverse?format=json&lat=${lat}&lon=${lng}&accept-language=nl`,
      { headers: { Accept: "application/json" } }
    );
    const data = await res.json();
    const addr = data.address ?? {};
    const parts = [
      addr.road || addr.pedestrian || addr.cycleway || addr.path,
      addr.house_number,
      addr.suburb || addr.neighbourhood || addr.quarter,
      addr.city || addr.town || addr.village || addr.municipality,
    ].filter(Boolean);
    return parts.join(", ") || data.display_name || `${lat.toFixed(5)}, ${lng.toFixed(5)}`;
  } catch {
    return `${lat.toFixed(5)}, ${lng.toFixed(5)}`;
  }
}

function makeIcon(L: any) {
  return L.divIcon({
    className: "",
    html: `<svg viewBox="0 0 24 32" fill="none" xmlns="http://www.w3.org/2000/svg" style="width:24px;height:32px;display:block">
      <path d="M12 0C5.373 0 0 5.373 0 12c0 8.5 12 20 12 20S24 20.5 24 12C24 5.373 18.627 0 12 0z" fill="${paper.ink}"/>
      <circle cx="12" cy="12" r="5" fill="${paper.paper}"/>
    </svg>`,
    iconSize: [24, 32],
    iconAnchor: [12, 32],
  });
}

export function LocationPicker({ address, coords, onAddressChange, onCoordsChange }: Props) {
  const mapRef = useRef<HTMLDivElement>(null);
  const mapInstance = useRef<any>(null);
  const markerRef = useRef<any>(null);

  const [displayText, setDisplayText] = useState(address ?? "");
  const [geocoding, setGeocoding] = useState(false);
  const [gpsStatus, setGpsStatus] = useState<"idle" | "loading" | "error">("idle");

  // Initialise Leaflet map
  useEffect(() => {
    if (!mapRef.current) return;
    if (mapInstance.current) {
      mapInstance.current.remove();
      mapInstance.current = null;
      markerRef.current = null;
    }
    let cancelled = false;

    (async () => {
      const L = await import("leaflet");
      if (cancelled || !mapRef.current) return;

      const icon = makeIcon(L);
      const parsedCoords = parseCoords(coords);
      const center: [number, number] = parsedCoords ?? [51.22, 4.40];

      const map = L.map(mapRef.current, { zoomControl: false }).setView(center, parsedCoords ? 15 : 11);
      L.control.zoom({ position: "bottomright" }).addTo(map);
      L.tileLayer(
        "https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png",
        {
          attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OSM</a> &copy; <a href="https://carto.com/attributions">CARTO</a>',
          subdomains: "abcd",
          maxZoom: 19,
        }
      ).addTo(map);

      if (parsedCoords) {
        markerRef.current = L.marker(parsedCoords, { icon, draggable: true }).addTo(map);
        attachDrag(markerRef.current);
      }

      map.on("click", async (e: any) => {
        const { lat, lng } = e.latlng;
        if (markerRef.current) {
          markerRef.current.setLatLng([lat, lng]);
        } else {
          markerRef.current = L.marker([lat, lng], { icon, draggable: true }).addTo(map);
          attachDrag(markerRef.current);
        }
        await applyCoords(lat, lng);
      });

      function attachDrag(marker: any) {
        marker.on("dragend", async () => {
          const { lat, lng } = marker.getLatLng();
          await applyCoords(lat, lng);
        });
      }

      async function applyCoords(lat: number, lng: number) {
        const coordStr = `${lat.toFixed(6)}, ${lng.toFixed(6)}`;
        onCoordsChange(coordStr);
        setGeocoding(true);
        const addr = await reverseGeocode(lat, lng);
        setGeocoding(false);
        setDisplayText(addr);
        onAddressChange(addr);
      }

      mapInstance.current = map;
      setTimeout(() => { if (!cancelled) map.invalidateSize(); }, 200);
    })();

    return () => {
      cancelled = true;
      mapInstance.current?.remove();
      mapInstance.current = null;
      markerRef.current = null;
    };
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const captureGPS = () => {
    setGpsStatus("loading");
    navigator.geolocation.getCurrentPosition(
      async (pos) => {
        const { latitude: lat, longitude: lng } = pos.coords;
        setGpsStatus("idle");

        const coordStr = `${lat.toFixed(6)}, ${lng.toFixed(6)}`;
        onCoordsChange(coordStr);

        if (mapInstance.current) {
          const L = await import("leaflet");
          const icon = makeIcon(L);
          mapInstance.current.setView([lat, lng], 16);
          if (markerRef.current) {
            markerRef.current.setLatLng([lat, lng]);
          } else {
            markerRef.current = L.marker([lat, lng], { icon, draggable: true }).addTo(mapInstance.current);
            markerRef.current.on("dragend", async () => {
              const { lat: la, lng: ln } = markerRef.current.getLatLng();
              const cs = `${la.toFixed(6)}, ${ln.toFixed(6)}`;
              onCoordsChange(cs);
              setGeocoding(true);
              const a = await reverseGeocode(la, ln);
              setGeocoding(false);
              setDisplayText(a);
              onAddressChange(a);
            });
          }
        }

        setGeocoding(true);
        const addr = await reverseGeocode(lat, lng);
        setGeocoding(false);
        setDisplayText(addr);
        onAddressChange(addr);
      },
      () => setGpsStatus("error")
    );
  };

  const hasGps = !!coords;

  return (
    <div>
      <div style={{
        display: "flex", alignItems: "center", gap: 8,
        border: `1.5px dashed ${paper.paperDark}`, padding: "10px 14px",
        marginBottom: 8,
      }}>
        <div style={{ flex: 1, minWidth: 0 }}>
          {/* Always editable — shows geocoded address or free-text */}
          <input
            type="text"
            value={geocoding ? "Adres ophalen…" : displayText}
            onChange={(e) => {
              setDisplayText(e.target.value);
              onAddressChange(e.target.value || null);
              // Typing free text clears the GPS pin
              if (hasGps) onCoordsChange(null);
            }}
            placeholder={t("form.location_placeholder")}
            readOnly={geocoding}
            style={{
              width: "100%", fontFamily: fontSerif, fontSize: 17, fontWeight: 600,
              color: geocoding ? paper.inkMute : paper.ink,
              background: "transparent", border: "none", outline: "none", padding: 0,
            }}
          />
          {hasGps && (
            <div style={{ fontFamily: fontMono, fontSize: 8, color: paper.inkMute, letterSpacing: 1, marginTop: 2 }}>
              📍 {coords}
            </div>
          )}
        </div>
        <button type="button" onClick={captureGPS} style={{
          fontFamily: fontMono, fontSize: 9, letterSpacing: 1.5, textTransform: "uppercase",
          background: "transparent", border: `1px solid ${paper.paperDark}`, color: paper.inkDim,
          padding: "4px 8px", cursor: "pointer", flexShrink: 0,
          opacity: gpsStatus === "loading" ? 0.5 : 1,
        }}>
          {gpsStatus === "loading" ? "…" : "GPS"}
        </button>
        {hasGps && (
          <button type="button" onClick={() => { onCoordsChange(null); }} title="Wis GPS pin" style={{
            fontFamily: fontMono, fontSize: 11, background: "transparent",
            border: "none", color: paper.inkMute, cursor: "pointer", padding: "0 2px", lineHeight: 1,
          }}>✕</button>
        )}
      </div>

      {gpsStatus === "error" && (
        <div style={{ fontFamily: fontMono, fontSize: 9, color: paper.accent, letterSpacing: 1, marginBottom: 6 }}>
          GPS niet beschikbaar
        </div>
      )}

      <div ref={mapRef} style={{ height: 200, border: `1.5px solid ${paper.paperDark}` }} />
      <div style={{ fontFamily: fontMono, fontSize: 8, color: paper.inkMute, letterSpacing: 1, marginTop: 4 }}>
        Klik op kaart of sleep de pin om locatie aan te passen
      </div>
    </div>
  );
}
