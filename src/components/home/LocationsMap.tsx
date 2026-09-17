"use client";

import { MapContainer, TileLayer, Marker, Popup } from "react-leaflet";
import L from "leaflet";
import "leaflet/dist/leaflet.css";
import Link from "next/link";
import markerIcon from "leaflet/dist/images/marker-icon.png";
import markerIcon2x from "leaflet/dist/images/marker-icon-2x.png";
import markerShadow from "leaflet/dist/images/marker-shadow.png";
import { CITY_COORDINATES } from "@/lib/data/cityCoordinates";

/**
 * Next's type declarations describe an image import as `StaticImageData`, but
 * Turbopack hands back the URL string directly. Reading `.src` off that string
 * yielded `undefined`, so Leaflet threw "iconUrl not set in Icon options" on
 * every marker and took the whole home page down with it — and TypeScript
 * could not catch it, because the declared type says `.src` exists. Accept
 * both shapes instead of trusting either.
 */
function assetUrl(asset: unknown): string {
  return typeof asset === "string" ? asset : (asset as { src: string }).src;
}

// Leaflet resolves its default marker icons via relative CSS paths that don't
// survive bundling — re-point them at the bundler's own hashed asset URLs so
// markers render without depending on an external CDN.
delete (L.Icon.Default.prototype as unknown as { _getIconUrl?: unknown })._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl: assetUrl(markerIcon2x),
  iconUrl: assetUrl(markerIcon),
  shadowUrl: assetUrl(markerShadow),
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
