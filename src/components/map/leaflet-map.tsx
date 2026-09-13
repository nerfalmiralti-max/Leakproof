"use client";
import { useEffect, useState } from "react";
import { divIcon } from "leaflet";
import {
  MapContainer,
  Marker,
  TileLayer,
  Tooltip,
  useMap,
  useMapEvents,
} from "react-leaflet";
import "leaflet/dist/leaflet.css";
import type { Coordinates } from "@/domain/report";
import { RISK_META } from "@/lib/presentation";
import type { AktauMapProps } from "./aktau-map";
const AKTAU: [number, number] = [43.653, 51.16];
function MapControls({
  point,
  onPin,
}: {
  point?: Coordinates | null;
  onPin?: (point: Coordinates) => void;
}) {
  const map = useMap();
  useMapEvents({
    click(event) {
      onPin?.({
        lat: Number(event.latlng.lat.toFixed(6)),
        lng: Number(event.latlng.lng.toFixed(6)),
      });
    },
  });
  useEffect(() => {
    if (point)
      map.setView([point.lat, point.lng], Math.max(map.getZoom(), 14), {
        animate: false,
      });
  }, [map, point]);
  useEffect(() => {
    const observer = new ResizeObserver(() => map.invalidateSize());
    observer.observe(map.getContainer());
    return () => observer.disconnect();
  }, [map]);
  return null;
}
export default function LeafletMap({
  reports = [],
  selectedId,
  onSelect,
  pin,
  onPin,
  preview = false,
}: AktauMapProps) {
  const [tileError, setTileError] = useState(false);
  const selected = reports.find((report) => report.id === selectedId);
  return (
    <>
      <MapContainer
        center={AKTAU}
        zoom={preview ? 12 : 13}
        scrollWheelZoom={false}
        zoomControl={!preview}
        dragging={!preview}
        doubleClickZoom={!preview}
        touchZoom={!preview}
        keyboard={!preview}
        attributionControl
      >
        <TileLayer
          attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
          url="https://tile.openstreetmap.org/{z}/{x}/{y}.png"
          maxZoom={19}
          eventHandlers={{ tileerror: () => setTileError(true) }}
        />
        <MapControls point={pin ?? selected?.location} onPin={onPin} />
        {reports.map((report) => (
          <Marker
            key={report.id}
            position={[report.location.lat, report.location.lng]}
            title={`${report.locationLabel}, ${RISK_META[report.analysis.leakRisk].label}`}
            icon={divIcon({
              className: "",
              html: `<div class="incident-marker ${selectedId === report.id ? "selected" : ""}" style="--marker-color:${RISK_META[report.analysis.leakRisk].markerColor}"><span></span></div>`,
              iconSize: [30, 36],
              iconAnchor: [15, 34],
            })}
            eventHandlers={{ click: () => onSelect?.(report.id) }}
          >
            <Tooltip direction="top" offset={[0, -28]}>
              {report.locationLabel} ·{" "}
              {RISK_META[report.analysis.leakRisk].label}
            </Tooltip>
          </Marker>
        ))}
        {pin && (
          <Marker
            position={[pin.lat, pin.lng]}
            title="Selected report location"
            icon={divIcon({
              className: "",
              html: '<div class="pin-marker"></div>',
              iconSize: [22, 22],
              iconAnchor: [11, 11],
            })}
          />
        )}
      </MapContainer>
      {tileError && (
        <div
          role="status"
          className="absolute bottom-7 left-3 right-3 z-10 rounded-md bg-white/95 px-3 py-2 text-xs text-muted shadow-sm"
        >
          Map tiles are unavailable.{" "}
          {onPin
            ? "Use the coordinate fields below or try again when connected."
            : "Incident details remain available in the list."}
        </div>
      )}
    </>
  );
}
