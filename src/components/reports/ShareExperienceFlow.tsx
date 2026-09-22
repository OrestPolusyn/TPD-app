"use client";

import { useState } from "react";
import type { LocationRow } from "@/lib/matching/types";
import type { ProvinceOption } from "@/lib/data/locations";
import type { DocumentTypeRow } from "@/lib/data/documentTypes";
import { ReportForm, type ReportFormLabels } from "@/components/reports/ReportForm";

type PickerLocation = Pick<LocationRow, "id" | "name" | "province_slug" | "city">;

export interface ShareExperienceFlowLabels {
  provinceLabel: string;
  provincePlaceholder: string;
  officeLabel: string;
  officePlaceholder: string;
}

export function ShareExperienceFlow({
  provinces,
  locations,
  documentTypes,
  pickerLabels,
  reportFormLabels,
}: {
  provinces: ProvinceOption[];
  locations: PickerLocation[];
  documentTypes: DocumentTypeRow[];
  pickerLabels: ShareExperienceFlowLabels;
  reportFormLabels: ReportFormLabels;
}) {
  const [provinceSlug, setProvinceSlug] = useState("");
  const [locationId, setLocationId] = useState("");

  const offices = locations.filter((l) => l.province_slug === provinceSlug);
  const selectedLocation = offices.find((o) => o.id === locationId);

  return (
    <div className="flex flex-col gap-5">
      <div>
        <label htmlFor="share-province" className="mb-1 block text-sm font-medium">
          {pickerLabels.provinceLabel}
        </label>
        <select
          id="share-province"
          value={provinceSlug}
          onChange={(e) => {
            setProvinceSlug(e.target.value);
            setLocationId("");
          }}
          className="w-full rounded-md border border-[var(--border-strong)] bg-[var(--surface)] p-2"
        >
          <option value="" disabled>
            {pickerLabels.provincePlaceholder}
          </option>
          {provinces.map((p) => (
            <option key={p.province_slug} value={p.province_slug}>
              {p.province}
            </option>
          ))}
        </select>
      </div>

      <div>
        <label htmlFor="share-office" className="mb-1 block text-sm font-medium">
          {pickerLabels.officeLabel}
        </label>
        <select
          id="share-office"
          value={locationId}
          disabled={!provinceSlug}
          onChange={(e) => setLocationId(e.target.value)}
          className="w-full rounded-md border border-[var(--border-strong)] bg-[var(--surface)] p-2 disabled:opacity-50"
        >
          <option value="" disabled>
            {pickerLabels.officePlaceholder}
          </option>
          {offices.map((o) => (
            <option key={o.id} value={o.id}>
              {o.name} — {o.city}
            </option>
          ))}
        </select>
      </div>

      {selectedLocation ? (
        <div className="flex flex-col gap-3 border-t border-[var(--border)] pt-5">
          <p className="text-sm font-medium">{selectedLocation.name}</p>
          <ReportForm locationId={selectedLocation.id} documentTypes={documentTypes} labels={reportFormLabels} />
        </div>
      ) : null}
    </div>
  );
}
