"use client";

import { MapContainer, TileLayer, Marker, Popup } from "react-leaflet";
import L from "leaflet";
import "leaflet/dist/leaflet.css";
import Link from "next/link";
import { CITY_COORDINATES } from "@/lib/data/cityCoordinates";

// Leaflet's default marker icon references image URLs that don't survive
// bundling as-is — re-point them at the package's own bundled assets, the
// standard workaround for Leaflet + a JS bundler.
delete (L.Icon.Default.prototype as unknown as { _getIconUrl?: unknown })._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png",
  iconUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png",
  shadowUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png",
});

const SPAIN_CENTER: [number, number] = [40.2, -3.7];

export interface MapLocation {
  id: string;
  name: string;
  city: string;
}

export function LocationsMap({ locations, openLocationLabel }: { locations: MapLocation[]; openLocationLabel: string }) {
  const markers = locations
    .map((loc) => {
      const coords = CITY_COORDINATES[loc.city];
      return coords ? { ...loc, coords } : null;
    })
    .filter((l): l is MapLocation & { coords: [number, number] } => l !== null);

  return (
    <MapContainer
      center={SPAIN_CENTER}
      zoom={6}
      scrollWheelZoom={false}
      className="h-full min-h-[320px] w-full rounded-xl"
    >
      <TileLayer
        attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
        url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
      />
      {markers.map((loc) => (
        <Marker key={loc.id} position={loc.coords}>
          <Popup>
            <strong>{loc.name}</strong>
            <br />
            {loc.city}
            <br />
            <Link href={`/locations/${loc.id}`} className="underline">
              {openLocationLabel}
            </Link>
          </Popup>
        </Marker>
      ))}
    </MapContainer>
  );
}
