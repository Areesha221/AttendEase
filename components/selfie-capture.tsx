"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import {
  AlertTriangle,
  Camera,
  CheckCircle2,
  Loader2,
  MapPin,
  RefreshCw,
  ShieldCheck,
  WifiOff,
} from "lucide-react";
import { distanceMeters } from "@/lib/time";
import { enqueue, newEventId, type QueuedEvent } from "@/lib/offline-queue";

type Office = { name: string; lat: number; lng: number; radiusM: number };
type CaptureType = "check_in" | "check_out";

type Props = {
  type: CaptureType;
  office: Office;
  employeeName: string;
  employeeCode: string;
};

type CameraState = "idle" | "starting" | "ready" | "error";
type LocationState = "idle" | "loading" | "ready" | "error";

export default function SelfieCapture({ type, office, employeeName, employeeCode }: Props) {
  const router = useRouter();
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const streamRef = useRef<MediaStream | null>(null);

  const [cameraState, setCameraState] = useState<CameraState>("idle");
  const [cameraError, setCameraError] = useState<string | null>(null);
  const [photo, setPhoto] = useState<string | null>(null);

  const [location, setLocation] = useState<{ lat: number; lng: number; accuracy: number } | null>(null);
  const [locationState, setLocationState] = useState<LocationState>("idle");
  const [locationError, setLocationError] = useState<string | null>(null);

  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const stopCamera = useCallback(() => {
    streamRef.current?.getTracks().forEach((track) => track.stop());
    streamRef.current = null;
  }, []);

  const startCamera = useCallback(async () => {
    if (typeof navigator === "undefined" || !navigator.mediaDevices?.getUserMedia) {
      setCameraState("error");
      setCameraError(
        "This browser cannot access a camera. Attendance needs a live selfie, so open the site in Chrome, Safari or Edge with camera permission allowed.",
      );
      return;
    }
    setCameraError(null);
    setCameraState("starting");
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: "user", width: { ideal: 640 }, height: { ideal: 480 } },
        audio: false,
      });
      streamRef.current = stream;
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        await videoRef.current.play().catch(() => undefined);
      }
      setCameraState("ready");
    } catch (err) {
      const name = (err as { name?: string })?.name;
      setCameraState("error");
      setCameraError(
        name === "NotAllowedError"
          ? "Camera permission was blocked. Allow camera access for this site in your browser settings, then tap Retry camera."
          : "No camera was found. A live selfie is required for attendance, so use a phone or laptop with a working camera.",
      );
    }
  }, []);

  const requestLocation = useCallback(() => {
    if (typeof navigator === "undefined" || !navigator.geolocation) {
      setLocationState("error");
      setLocationError("This device does not support location.");
      return;
    }
    setLocationState("loading");
    setLocationError(null);
    navigator.geolocation.getCurrentPosition(
      (position) => {
        setLocation({
          lat: position.coords.latitude,
          lng: position.coords.longitude,
          accuracy: position.coords.accuracy,
        });
        setLocationState("ready");
      },
      (err) => {
        setLocationState("error");
        setLocationError(err.message || "Location permission was denied.");
      },
      { enableHighAccuracy: true, timeout: 12000, maximumAge: 0 },
    );
  }, []);

  useEffect(() => {
    // Start the camera and request location on the next tick: this keeps the
    // first paint responsive and avoids setting state synchronously inside the
    // effect body.
    let active = true;
    const timer = window.setTimeout(() => {
      if (!active) return;
      void startCamera();
      requestLocation();
    }, 0);
    return () => {
      active = false;
      window.clearTimeout(timer);
      stopCamera();
    };
  }, [requestLocation, startCamera, stopCamera]);

  const capture = () => {
    const video = videoRef.current;
    if (!video || !video.videoWidth) {
      setError("The camera is not ready yet. Wait a moment and try again.");
      return;
    }
    const width = 480;
    const height = Math.round((video.videoHeight / video.videoWidth) * width) || 360;
    const canvas = document.createElement("canvas");
    canvas.width = width;
    canvas.height = height;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    ctx.drawImage(video, 0, 0, width, height);
    setPhoto(canvas.toDataURL("image/jpeg", 0.7));
    setError(null);
    stopCamera();
    setCameraState("idle");
  };

  const retake = () => {
    setPhoto(null);
    void startCamera();
  };

  const distance = location ? distanceMeters(location.lat, location.lng, office.lat, office.lng) : null;
  const inside = distance !== null ? distance <= office.radiusM : null;

  const submit = async () => {
    if (!photo) {
      setError("Take a selfie before continuing.");
      return;
    }
    setSubmitting(true);
    setError(null);

    const event: QueuedEvent = {
      eventId: newEventId(),
      type,
      deviceTime: new Date().toISOString(),
      photo,
      latitude: location?.lat ?? null,
      longitude: location?.lng ?? null,
      accuracyM: location?.accuracy ?? null,
    };

    try {
      const response = await fetch("/api/attendance", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ events: [event] }),
      });
      if (!response.ok) throw new Error("server error");
      const data = (await response.json()) as {
        results?: {
          status: string;
          message?: string;
          serverTime?: string;
          locationStatus?: string;
          distanceM?: number | null;
          verification?: string;
          fraudFlags?: string;
        }[];
      };
      const result = data.results?.[0];
      if (!result || result.status === "rejected") {
        setError(result?.message ?? "The server rejected this record.");
        setSubmitting(false);
        return;
      }
      const params = new URLSearchParams({
        type,
        offline: "0",
        time: result.serverTime ?? "",
        status: result.locationStatus ?? "unavailable",
        distance: result.distanceM !== null && result.distanceM !== undefined ? String(result.distanceM) : "",
        verification: result.verification ?? "",
        fraud: result.fraudFlags ?? "",
      });
      router.push(`/app/success?${params}`);
    } catch {
      enqueue(event);
      const params = new URLSearchParams({
        type,
        offline: "1",
        status: location ? (inside ? "inside" : "outside") : "unavailable",
        distance: distance !== null ? String(distance) : "",
      });
      router.push(`/app/success?${params}`);
    }
  };

  const isCheckIn = type === "check_in";

  return (
    <div className="grid gap-5 lg:grid-cols-2">
      <div className="card">
        <p className="section-title">1 · Take your selfie</p>

        <div className="mt-3 overflow-hidden rounded-2xl bg-slate-900">
          {photo ? (
            // eslint-disable-next-line @next/next/no-img-element -- inline data URI selfie
            <img src={photo} alt="Captured selfie" className="aspect-4/3 w-full object-cover" />
          ) : (
            <video
              ref={videoRef}
              autoPlay
              playsInline
              muted
              className="aspect-4/3 w-full object-cover"
            />
          )}
        </div>

        {!photo && cameraState === "starting" && (
          <p className="mt-3 flex items-center gap-2 text-xs text-slate-500">
            <Loader2 className="h-3.5 w-3.5 animate-spin" /> Starting camera…
          </p>
        )}
        {!photo && cameraState === "error" && cameraError && (
          <p className="mt-3 flex items-start gap-2 rounded-xl bg-amber-50 p-3 text-xs font-medium text-amber-800 ring-1 ring-amber-200">
            <AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0" />
            {cameraError}
          </p>
        )}

        <div className="mt-3 flex flex-wrap gap-2">
          {!photo && cameraState === "ready" && (
            <button type="button" onClick={capture} className="btn btn-primary">
              <Camera className="h-4 w-4" /> Capture selfie
            </button>
          )}
          {!photo && cameraState !== "ready" && (
            <button type="button" onClick={() => void startCamera()} className="btn btn-ghost">
              <RefreshCw className="h-4 w-4" /> Retry camera
            </button>
          )}
          {photo && (
            <button type="button" onClick={retake} className="btn btn-ghost">
              <RefreshCw className="h-4 w-4" /> Retake
            </button>
          )}
        </div>
      </div>

      <div className="flex flex-col gap-5">
        <div className="card">
          <p className="section-title">2 · Verify your location</p>

          {locationState === "loading" && (
            <p className="mt-3 flex items-center gap-2 text-sm text-slate-600">
              <Loader2 className="h-4 w-4 animate-spin" /> Getting GPS position…
            </p>
          )}
          {locationState === "error" && (
            <p className="mt-3 flex items-start gap-2 rounded-xl bg-amber-50 p-3 text-xs font-medium text-amber-800 ring-1 ring-amber-200">
              <AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0" />
              {locationError} You can still submit — it will be marked for review.
            </p>
          )}
          {location && (
            <dl className="mt-3 space-y-1.5 text-sm">
              <div className="flex justify-between">
                <dt className="text-slate-500">Office</dt>
                <dd className="font-semibold text-slate-900">{office.name}</dd>
              </div>
              <div className="flex justify-between">
                <dt className="text-slate-500">Allowed radius</dt>
                <dd className="font-semibold text-slate-900">{office.radiusM} m</dd>
              </div>
              <div className="flex justify-between">
                <dt className="text-slate-500">Your distance</dt>
                <dd className="font-semibold text-slate-900">
                  {distance !== null ? `${distance} m` : "—"} · ±{Math.round(location.accuracy)} m
                </dd>
              </div>
              <div className="flex justify-between">
                <dt className="text-slate-500">Result</dt>
                <dd>
                  {inside ? (
                    <span className="badge bg-emerald-50 text-emerald-700 ring-emerald-200">
                      <CheckCircle2 className="h-3.5 w-3.5" /> Inside office
                    </span>
                  ) : (
                    <span className="badge bg-rose-50 text-rose-700 ring-rose-200">
                      <AlertTriangle className="h-3.5 w-3.5" /> Outside office
                    </span>
                  )}
                </dd>
              </div>
            </dl>
          )}

          <div className="mt-3 flex flex-wrap gap-2">
            <button type="button" onClick={requestLocation} className="btn btn-sm btn-ghost">
              <MapPin className="h-3.5 w-3.5" /> Refresh location
            </button>
          </div>
        </div>

        <div className="card">
          <p className="section-title">3 · Confirm {isCheckIn ? "check-in" : "check-out"}</p>
          <ul className="mt-3 space-y-1.5 text-xs text-slate-600">
            <li className="flex items-center gap-1.5">
              <ShieldCheck className="h-3.5 w-3.5 text-indigo-600" /> Server time (Asia/Karachi) is recorded, not your
              device clock.
            </li>
            <li className="flex items-center gap-1.5">
              <ShieldCheck className="h-3.5 w-3.5 text-indigo-600" /> {employeeName} • {employeeCode}
            </li>
            <li className="flex items-center gap-1.5">
              <WifiOff className="h-3.5 w-3.5 text-indigo-600" /> If you are offline, it is saved on this device and
              synced automatically.
            </li>
          </ul>

          {error && (
            <p className="mt-3 flex items-start gap-2 rounded-xl bg-rose-50 p-3 text-xs font-medium text-rose-700 ring-1 ring-rose-200">
              <AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0" />
              {error}
            </p>
          )}

          <button
            type="button"
            onClick={submit}
            disabled={submitting || !photo}
            className={`btn mt-3 w-full ${isCheckIn ? "btn-success" : "btn-primary"}`}
          >
            {submitting ? <Loader2 className="h-4 w-4 animate-spin" /> : <CheckCircle2 className="h-4 w-4" />}
            {submitting ? "Saving…" : isCheckIn ? "Confirm check-in" : "Confirm check-out"}
          </button>
        </div>
      </div>
    </div>
  );
}
