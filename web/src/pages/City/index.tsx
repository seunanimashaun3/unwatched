import { useCallback, useEffect, useRef, useState } from "react";
import type { Camera, CityIndexEntry, LngLat, Meta } from "@/lib/types";
import { computeExposure, type Exposure } from "@/lib/exposure";
import { fetchCityCameras, fetchCityMeta } from "@/lib/cities";
import { fmtPoint } from "@/lib/presets";
import { fmtCamera, nearestCamera } from "@/lib/proximity";
import { primeAudio, releaseWakeLock, requestWakeLock } from "@/lib/alerts";
import { useRouter } from "@/hooks/useRouter";
import { useGeolocation } from "@/hooks/useGeolocation";
import { useDriveAlerts } from "@/hooks/useDriveAlerts";
import { useIsMobile } from "@/hooks/useIsMobile";
import { useTheme } from "@/components/ThemeProvider";
import MapView, { type Focus } from "@/components/MapView";
import Panel, { type Mode } from "@/components/Panel";
import MobilePanel from "@/components/MobilePanel";
import RoutePanel, { type Arm } from "@/components/RoutePanel";
import ExposurePanel from "@/components/ExposurePanel";
import DriveControls from "@/components/DriveControls";
import DriveAlert from "@/components/DriveAlert";
import NavBar from "@/components/NavBar";
import Legend from "@/components/Legend";
import LoadingScreen from "@/components/LoadingScreen";
import CitySwitcher from "@/components/CitySwitcher";

export default function City({
  slug,
  cities,
  onCityChange,
}: {
  slug: string;
  cities: CityIndexEntry[];
  onCityChange: (slug: string) => void;
}) {
  const [meta, setMeta] = useState<Meta | null>(null);
  const [cameras, setCameras] = useState<Camera[]>([]);
  const [notFound, setNotFound] = useState(false);

  const [mode, setMode] = useState<Mode>("route");
  const [arm, setArm] = useState<Arm>("a");
  const [start, setStart] = useState<LngLat | null>(null);
  const [end, setEnd] = useState<LngLat | null>(null);
  const [startLabel, setStartLabel] = useState<string | null>(null);
  const [endLabel, setEndLabel] = useState<string | null>(null);
  const [penaltyS, setPenaltyS] = useState(90);
  const [alprOnly, setAlprOnly] = useState(true);
  const [exposurePoint, setExposurePoint] = useState<LngLat | null>(null);
  const [exposure, setExposure] = useState<Exposure | null>(null);
  const [focus, setFocus] = useState<Focus | null>(null);
  const nonce = useRef(0);

  const [driveMode, setDriveMode] = useState(false);
  const [driving, setDriving] = useState(false);
  const [locating, setLocating] = useState(false);

  const { theme } = useTheme();
  const isMobile = useIsMobile();
  const { ready, routing, result, load, request, clear } = useRouter();
  const geo = useGeolocation();
  const drive = useDriveAlerts(driveMode ? (geo.fix?.point ?? null) : null, cameras, {
    enabled: driveMode,
    alprOnly,
  });
  const snap = useRef({ mode, arm, start, end });
  snap.current = { mode, arm, start, end };

  // ---- load the city's data + tell the worker to load its graph ----
  useEffect(() => {
    let alive = true;
    setNotFound(false);
    Promise.all([fetchCityMeta(slug), fetchCityCameras(slug)])
      .then(([m, c]) => {
        if (!alive) return;
        setMeta(m);
        setCameras(c.cameras);
        load(slug);
      })
      .catch(() => alive && setNotFound(true));
    return () => {
      alive = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [slug]);

  const flyTo = (p: LngLat) => setFocus({ point: p, nonce: ++nonce.current });

  // ---- Tier 1: use my current location as the start point ----
  const onLocate = () => {
    setLocating(true);
    geo
      .locateOnce()
      .then((f) => {
        setStart(f.point);
        setStartLabel("My location");
        setArm(end ? null : "b");
        flyTo(f.point);
      })
      .catch(() => {})
      .finally(() => setLocating(false));
  };

  // ---- Tier 2: drive mode — follow position + camera proximity alerts ----
  const onToggleDrive = (on: boolean) => {
    setDriveMode(on);
    if (on) {
      primeAudio(); // must run in the click gesture so beeps are allowed
      requestWakeLock();
      geo.start();
    } else {
      geo.stop();
      releaseWakeLock();
      setDriving(false);
    }
  };

  useEffect(() => () => releaseWakeLock(), []);

  // offset the map's top controls below the NavBar while driving
  useEffect(() => {
    document.body.classList.toggle("driving", driving);
    return () => document.body.classList.remove("driving");
  }, [driving]);

  // mobile: one tap turns on GPS + enters the driving nav view
  const onStartDriving = () => {
    if (!driveMode) onToggleDrive(true);
    setDriving(true);
  };

  // ---- map click: endpoints or exposure ----
  const onPick = useCallback((p: LngLat) => {
    const cur = snap.current;
    if (cur.mode === "exposure") {
      setExposurePoint(p);
      return;
    }
    if (cur.arm === "a" || (!cur.start && cur.arm !== "b")) {
      setStart(p);
      setStartLabel(fmtPoint(p));
      setArm(cur.end ? null : "b");
    } else {
      setEnd(p);
      setEndLabel(fmtPoint(p));
      setArm(null);
    }
  }, []);

  const onSelect = (kind: "a" | "b", p: LngLat, label: string) => {
    if (kind === "a") {
      setStart(p);
      setStartLabel(label);
      setArm(end ? null : "b");
    } else {
      setEnd(p);
      setEndLabel(label);
      setArm(null);
    }
    flyTo(p);
  };

  const onClear = (kind: "a" | "b") => {
    if (kind === "a") {
      setStart(null);
      setStartLabel(null);
      setArm("a");
    } else {
      setEnd(null);
      setEndLabel(null);
      setArm("b");
    }
    clear();
  };

  useEffect(() => {
    if (exposurePoint) setExposure(computeExposure(exposurePoint, cameras));
  }, [exposurePoint, cameras]);

  useEffect(() => {
    if (!ready || !start || !end || mode !== "route") return;
    const t = setTimeout(
      () => request({ start, end, cameraPenaltyS: penaltyS, alprOnly }),
      60,
    );
    return () => clearTimeout(t);
  }, [ready, start, end, penaltyS, alprOnly, mode, request]);

  const applyPreset = (a: LngLat, b: LngLat) => {
    setStart(a);
    setEnd(b);
    setStartLabel(fmtPoint(a));
    setEndLabel(fmtPoint(b));
    setArm(null);
  };

  const reset = () => {
    setStart(null);
    setEnd(null);
    setStartLabel(null);
    setEndLabel(null);
    setArm("a");
    clear();
  };

  const switchMode = (m: Mode) => {
    setMode(m);
    if (m === "exposure") clear();
    else {
      setExposurePoint(null);
      setExposure(null);
    }
  };

  if (notFound) {
    return (
      <div className="absolute inset-0 grid place-items-center bg-background">
        <div className="text-center">
          <h1 className="mb-1.5 text-3xl font-bold tracking-tight">Couldn't load {slug}</h1>
          <p className="mb-5 text-sm text-muted-foreground">Pick another city:</p>
          <div className="flex justify-center">
            <CitySwitcher cities={cities} slug={slug} onChange={onCityChange} />
          </div>
        </div>
      </div>
    );
  }

  if (!meta) return <LoadingScreen label="Loading city…" />;

  const citySwitcher = <CitySwitcher cities={cities} slug={slug} onChange={onCityChange} />;

  // live driving readouts
  const liveFix = driveMode ? (geo.fix?.point ?? null) : null;
  const nextCam = liveFix ? nearestCamera(liveFix, cameras, alprOnly) : null;
  const speedMph = geo.fix?.speedMps != null ? geo.fix.speedMps * 2.23694 : null;

  return (
    <>
      <MapView
        cameras={cameras}
        theme={theme}
        center={meta.center}
        zoom={meta.zoom}
        focus={focus}
        mode={mode}
        start={start}
        end={end}
        exposurePoint={exposurePoint}
        livePosition={driveMode ? (geo.fix?.point ?? null) : null}
        follow={driveMode}
        result={result}
        alprOnly={alprOnly}
        onPick={onPick}
        onMoveStart={(p) => {
          setStart(p);
          setStartLabel(fmtPoint(p));
        }}
        onMoveEnd={(p) => {
          setEnd(p);
          setEndLabel(fmtPoint(p));
        }}
      />
      {!ready && <LoadingScreen label={`Loading ${meta.city} road network…`} />}

      {drive.alert && (
        <DriveAlert
          title={fmtCamera(cameras[drive.alert.cameraIndex])}
          distanceM={drive.alert.distanceM}
          onDismiss={drive.dismiss}
        />
      )}

      {driving && (
        <NavBar
          nextName={nextCam ? fmtCamera(cameras[nextCam.index]) : null}
          nextDistanceM={nextCam ? nextCam.distanceM : null}
          loggedCount={drive.loggedCount}
          speedMph={speedMph}
          onEnd={() => setDriving(false)}
        />
      )}

      {!driving &&
        (isMobile ? (
          <MobilePanel
            mode={mode}
            onMode={switchMode}
            citySwitcher={citySwitcher}
            start={start}
            end={end}
            startLabel={startLabel}
            endLabel={endLabel}
            arm={arm}
            setArm={setArm}
            bbox={meta.bbox}
            presets={meta.presets}
            onSelect={onSelect}
            onClear={onClear}
            penaltyS={penaltyS}
            setPenaltyS={setPenaltyS}
            alprOnly={alprOnly}
            setAlprOnly={setAlprOnly}
            routing={routing}
            result={result}
            applyPreset={applyPreset}
            reset={reset}
            onLocate={onLocate}
            locating={locating}
            onStartDrive={onStartDriving}
            exposure={exposure}
          />
        ) : (
          <Panel mode={mode} onMode={switchMode} meta={meta} citySwitcher={citySwitcher}>
            <DriveControls
              locating={locating}
              driveMode={driveMode}
              watching={geo.watching}
              loggedCount={drive.loggedCount}
              accuracyM={geo.fix?.accuracyM ?? null}
              error={geo.error}
              onLocate={onLocate}
              onToggleDrive={onToggleDrive}
              onStart={() => setDriving(true)}
            />
            {mode === "route" ? (
              <RoutePanel
                start={start}
                end={end}
                startLabel={startLabel}
                endLabel={endLabel}
                arm={arm}
                setArm={setArm}
                bbox={meta.bbox}
                presets={meta.presets}
                onSelect={onSelect}
                onClear={onClear}
                penaltyS={penaltyS}
                setPenaltyS={setPenaltyS}
                alprOnly={alprOnly}
                setAlprOnly={setAlprOnly}
                routing={routing}
                result={result}
                applyPreset={applyPreset}
                reset={reset}
              />
            ) : (
              <ExposurePanel exposure={exposure} />
            )}
          </Panel>
        ))}

      {!driving && <Legend alprOnly={alprOnly} />}
    </>
  );
}
