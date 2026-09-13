"use client";

import { useEffect, useRef, useState } from "react";
import { ArrowLeft, ArrowRight, LocateFixed, MapPin } from "lucide-react";
import type { AnalysisResult } from "@/domain/analysis";
import type { Coordinates, LeakReport } from "@/domain/report";
import { getReportRepository } from "@/lib/reports";
import { AktauMap } from "../map/aktau-map";
import { ErrorNotice } from "../ui";
import type { SelectedVideo } from "../scan/video-upload";

export function ReportForm({
  result,
  selected,
  onCreated,
  onBack,
}: {
  result: AnalysisResult;
  selected: SelectedVideo;
  onCreated: (report: LeakReport) => void;
  onBack: () => void;
}) {
  const [latitude, setLatitude] = useState("");
  const [longitude, setLongitude] = useState("");
  const [locationLabel, setLocationLabel] = useState("");
  const [description, setDescription] = useState("");
  const [locating, setLocating] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const saveLock = useRef(false);
  const locationRequest = useRef(0);
  useEffect(
    () => () => {
      locationRequest.current++;
    },
    [],
  );
  const lat = Number(latitude),
    lng = Number(longitude);
  const pin: Coordinates | null =
    latitude.trim() &&
    longitude.trim() &&
    Number.isFinite(lat) &&
    Number.isFinite(lng) &&
    Math.abs(lat) <= 90 &&
    Math.abs(lng) <= 180
      ? { lat, lng }
      : null;

  function setPoint(point: Coordinates) {
    locationRequest.current++;
    setLocating(false);
    setLatitude(point.lat.toFixed(6));
    setLongitude(point.lng.toFixed(6));
    setError(null);
  }
  function locate() {
    if (!navigator.geolocation) {
      setError(
        "Location is unavailable in this browser. Place a pin on the map or enter coordinates.",
      );
      return;
    }
    const request = ++locationRequest.current;
    setLocating(true);
    setError(null);
    navigator.geolocation.getCurrentPosition(
      (position) => {
        if (request !== locationRequest.current) return;
        setPoint({
          lat: position.coords.latitude,
          lng: position.coords.longitude,
        });
      },
      (failure) => {
        if (request !== locationRequest.current) return;
        setLocating(false);
        setError(
          failure.code === 1
            ? "Location access was denied. You can still place a pin on the map or enter coordinates."
            : "Your location could not be found. Place a pin on the map or enter coordinates.",
        );
      },
      { enableHighAccuracy: true, timeout: 12000, maximumAge: 0 },
    );
  }
  async function submit(event: React.FormEvent) {
    event.preventDefault();
    if (!pin || saveLock.current) return;
    saveLock.current = true;
    setSaving(true);
    setError(null);
    try {
      const report = await getReportRepository().create(
        {
          analysis: result,
          location: pin,
          locationLabel:
            locationLabel.trim() ||
            `${pin.lat.toFixed(5)}, ${pin.lng.toFixed(5)}`,
          description: description.trim(),
          video: selected.metadata,
        },
        selected.file,
      );
      onCreated(report);
    } catch (failure) {
      setError(
        failure instanceof Error
          ? failure.message
          : "The report could not be saved. Please try again.",
      );
    } finally {
      saveLock.current = false;
      setSaving(false);
    }
  }
  return (
    <form onSubmit={submit} className="panel mx-auto max-w-2xl overflow-hidden">
      <div className="border-b border-line px-6 py-5">
        <h2 className="text-lg font-bold">Where did you notice it?</h2>
        <p className="mt-1.5 text-xs text-muted">
          Use your location or tap the map to place a pin.
        </p>
      </div>
      <div className="space-y-5 p-5 sm:p-6">
        <button
          type="button"
          className="btn btn-secondary w-full"
          onClick={locate}
          disabled={locating || saving}
        >
          <LocateFixed size={17} />
          {locating ? "Finding your location…" : "Use my current location"}
        </button>
        <div
          className="map-shell h-64 rounded-xl border border-line sm:h-72"
          aria-label="Choose a report location on the Aktau map"
        >
          <AktauMap pin={pin} onPin={saving ? undefined : setPoint} />
        </div>
        <p className="flex items-start gap-1.5 text-[11px] text-muted">
          <MapPin size={13} className="shrink-0" />
          {pin
            ? `Pin selected: ${pin.lat.toFixed(5)}, ${pin.lng.toFixed(5)}. Check that it marks the observation.`
            : "No location selected. Tap the map, use your location or enter coordinates below."}
        </p>
        <fieldset disabled={saving} className="grid grid-cols-2 gap-3">
          <legend className="mb-2 text-xs font-semibold">Coordinates</legend>
          <div>
            <label
              htmlFor="latitude"
              className="mb-1.5 block text-[11px] text-muted"
            >
              Latitude
            </label>
            <input
              id="latitude"
              className="field"
              type="number"
              step="any"
              min="-90"
              max="90"
              value={latitude}
              placeholder="43.653"
              onChange={(event) => {
                locationRequest.current++;
                setLocating(false);
                setLatitude(event.target.value);
              }}
              required
            />
          </div>
          <div>
            <label
              htmlFor="longitude"
              className="mb-1.5 block text-[11px] text-muted"
            >
              Longitude
            </label>
            <input
              id="longitude"
              className="field"
              type="number"
              step="any"
              min="-180"
              max="180"
              value={longitude}
              placeholder="51.160"
              onChange={(event) => {
                locationRequest.current++;
                setLocating(false);
                setLongitude(event.target.value);
              }}
              required
            />
          </div>
        </fieldset>
        <div>
          <label
            htmlFor="location-reference"
            className="mb-2 block text-xs font-semibold"
          >
            Nearby street or landmark{" "}
            <span className="font-normal text-muted">(optional)</span>
          </label>
          <input
            id="location-reference"
            className="field"
            value={locationLabel}
            onChange={(event) => setLocationLabel(event.target.value)}
            maxLength={120}
            placeholder="e.g. Microdistrict 14, near the crossing"
            disabled={saving}
          />
        </div>
        <div>
          <label
            htmlFor="description"
            className="mb-2 block text-xs font-semibold"
          >
            Anything else to add?{" "}
            <span className="font-normal text-muted">(optional)</span>
          </label>
          <textarea
            id="description"
            className="field min-h-25 resize-y"
            maxLength={500}
            value={description}
            onChange={(event) => setDescription(event.target.value)}
            placeholder="What did you notice? Add context that could help an inspection."
            disabled={saving}
          />
          <p className="mt-1 text-right text-[10px] text-muted">
            {description.length}/500
          </p>
        </div>
        <ErrorNotice message={error} />
        <div className="rounded-lg bg-paper p-3 text-[11px] leading-relaxed text-muted">
          Your video, assessment and location will be stored together in this
          browser. This demo does not contact the city or dispatch an
          inspection.
        </div>
        <button
          type="submit"
          className="btn btn-primary w-full"
          disabled={!pin || saving || locating}
        >
          {saving ? "Saving report…" : "Submit report"}
          <ArrowRight size={17} />
        </button>
        <button
          type="button"
          className="flex min-h-10 w-full items-center justify-center gap-2 text-xs font-medium text-muted"
          onClick={onBack}
          disabled={saving}
        >
          <ArrowLeft size={14} /> Back to assessment
        </button>
      </div>
    </form>
  );
}
