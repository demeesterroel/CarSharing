"use client";
import { useEffect, useRef, useState } from "react";
import { MapPin } from "lucide-react";
import { t } from "@/lib/i18n";

interface Props {
  value: string | null;
  onChange: (coords: string) => void;
}

export function LocationPicker({ value, onChange }: Props) {
  const mapRef = useRef<HTMLDivElement>(null);
  const mapInstance = useRef<any>(null);
  const markerRef = useRef<any>(null);
  const initAttempted = useRef(false);
  const [status, setStatus] = useState<"idle"|"loading"|"error">("idle");

  useEffect(() => {
    if (!mapRef.current || initAttempted.current) return;
    initAttempted.current = true;
    let cancelled = false;

    (async () => {
      const L = await import("leaflet");
      if (cancelled || !mapRef.current) return;

      delete (L.Icon.Default.prototype as any)._getIconUrl;
      L.Icon.Default.mergeOptions({
        iconRetinaUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png",
        iconUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png",
        shadowUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png",
      });

      const coords: [number, number] = value
        ? (value.split(",").map(Number) as [number, number])
        : [51.05, 4.45];
      const map = L.map(mapRef.current).setView(coords, 13);
      L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
        attribution: "&copy; OpenStreetMap",
      }).addTo(map);
      if (value) markerRef.current = L.marker(coords).addTo(map);

      map.on("click", (e: any) => {
        const { lat, lng } = e.latlng;
        const coordStr = `${lat.toFixed(6)}, ${lng.toFixed(6)}`;
        onChange(coordStr);
        if (markerRef.current) markerRef.current.setLatLng([lat, lng]);
        else markerRef.current = L.marker([lat, lng]).addTo(map);
      });

      mapInstance.current = map;
    })();

    return () => {
      cancelled = true;
      mapInstance.current?.remove();
      mapInstance.current = null;
      markerRef.current = null;
    };
  }, []);

  const captureGPS = () => {
    setStatus("loading");
    navigator.geolocation.getCurrentPosition(
      async (pos) => {
        const coordStr = `${pos.coords.latitude.toFixed(6)}, ${pos.coords.longitude.toFixed(6)}`;
        onChange(coordStr);
        setStatus("idle");
        if (mapInstance.current) {
          const [lat, lng] = coordStr.split(",").map(Number);
          mapInstance.current.setView([lat, lng], 15);
          if (markerRef.current) markerRef.current.setLatLng([lat, lng]);
          else {
            const L = await import("leaflet");
            markerRef.current = L.marker([lat, lng]).addTo(mapInstance.current);
          }
        }
      },
      () => setStatus("error")
    );
  };

  return (
    <div className="space-y-2">
      <div className="flex items-center gap-2">
        <input
          readOnly
          value={value ?? ""}
          placeholder={t("form.location_placeholder")}
          className="flex-1 border rounded-md px-3 py-2 text-sm bg-gray-50"
        />
        <button type="button" onClick={captureGPS} className="p-2 border rounded-md hover:bg-gray-50">
          <MapPin className={`w-4 h-4 ${status === "loading" ? "animate-pulse text-blue-500" : "text-gray-600"}`} />
        </button>
      </div>
      {status === "error" && <p className="text-xs text-red-500">{t("error.gps_unavailable")}</p>}
      <div ref={mapRef} className="h-48 rounded-md border overflow-hidden" />
    </div>
  );
}
