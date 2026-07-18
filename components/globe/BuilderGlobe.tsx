"use client";

import { useCallback, useEffect, useMemo, useRef, useState, type MutableRefObject } from "react";
import Globe, { type GlobeMethods } from "react-globe.gl";
import {
  ATLAS_MEMORIES,
  COUNTRY_COORDS,
  MEMORY_ARCS,
  type AtlasMemory,
  getGeoCountryName,
  normalizeCountry,
} from "@/lib/atlas-globe-data";

const COUNTRY_DATA_URL = "/data/custom.geo.json";
const GLOBE_TEXTURE_URL = "/textures/earth-night.jpg";
const GLOBE_BUMP_URL = "/textures/earth-topology.png";
const GLOBE_BACKGROUND_URL = "/textures/night-sky.png";
const DRAG_THRESHOLD_PX = 6;
const MAX_DEVICE_PIXEL_RATIO = 1.25;

type Coordinates = {
  lat: number;
  lng: number;
};

type GeoGeometry = {
  type: string;
  coordinates: unknown;
};

type GeoFeature = {
  type: "Feature";
  properties: Record<string, unknown> & {
    __rawCountry?: string;
    __canonicalCountry?: string;
  };
  geometry: GeoGeometry;
};

type FeatureCollection = {
  type: "FeatureCollection";
  features: Array<{
    type: "Feature";
    properties?: Record<string, unknown>;
    geometry: GeoGeometry;
  }>;
};

export type BuilderGlobeProps = {
  memories?: AtlasMemory[];
  highlightedCountry: string | null;
  onCountryClick: (country: string) => void;
  onCountryHover: (country: string | null) => void;
  globeRef?: MutableRefObject<GlobeMethods | undefined>;
};

let cachedCountries: GeoFeature[] | null = null;
let countriesPromise: Promise<GeoFeature[]> | null = null;

function preprocessCountries(data: FeatureCollection): GeoFeature[] {
  return data.features
    .map((feature) => {
      const rawCountry = getGeoCountryName(feature);
      const canonicalCountry = rawCountry ? normalizeCountry(rawCountry) : null;

      return {
        ...feature,
        properties: {
          ...feature.properties,
          __rawCountry: rawCountry ?? undefined,
          __canonicalCountry: canonicalCountry ?? undefined,
        },
      };
    })
    .filter((feature) => feature.properties.__canonicalCountry && feature.properties.__canonicalCountry !== "Antarctica") as GeoFeature[];
}

async function loadCountries() {
  if (cachedCountries) return cachedCountries;
  if (!countriesPromise) {
    countriesPromise = fetch(COUNTRY_DATA_URL)
      .then((response) => response.json() as Promise<FeatureCollection>)
      .then(preprocessCountries);
  }

  cachedCountries = await countriesPromise;
  return cachedCountries;
}

function resolvePolygonCountry(polygon: object | null) {
  const feature = polygon as GeoFeature | null;
  const rawCountry = feature?.properties?.__rawCountry ?? null;
  const canonicalCountry = feature?.properties?.__canonicalCountry ?? null;

  return {
    rawCountry: typeof rawCountry === "string" ? rawCountry : null,
    canonicalCountry: typeof canonicalCountry === "string" ? canonicalCountry : null,
  };
}

function flattenCoordinatePairs(coordinates: unknown, pairs: Coordinates[] = []) {
  if (!Array.isArray(coordinates)) return pairs;

  if (typeof coordinates[0] === "number" && typeof coordinates[1] === "number") {
    pairs.push({ lng: coordinates[0], lat: coordinates[1] });
    return pairs;
  }

  for (const value of coordinates) {
    flattenCoordinatePairs(value, pairs);
  }

  return pairs;
}

function getFeatureCenter(feature: GeoFeature | undefined) {
  if (!feature) return null;
  const pairs = flattenCoordinatePairs(feature.geometry.coordinates);
  if (pairs.length === 0) return null;

  const totals = pairs.reduce(
    (current, pair) => ({
      lat: current.lat + pair.lat,
      lng: current.lng + pair.lng,
    }),
    { lat: 0, lng: 0 },
  );

  return {
    lat: totals.lat / pairs.length,
    lng: totals.lng / pairs.length,
  };
}

function memoryLabel(memory: AtlasMemory) {
  return `<div style="max-width: 230px; padding: 6px 2px"><strong>${memory.title}</strong><br/><span style="opacity: .72">${memory.country} · ${memory.kind}</span></div>`;
}

export default function BuilderGlobe({
  memories = ATLAS_MEMORIES,
  highlightedCountry,
  onCountryClick,
  onCountryHover,
  globeRef,
}: BuilderGlobeProps) {
  const localGlobeRef = useRef<GlobeMethods | undefined>(undefined);
  const activeGlobeRef = globeRef ?? localGlobeRef;
  const mouseDownPos = useRef<{ x: number; y: number } | null>(null);
  const isDragging = useRef(false);
  const pulseTimeoutRef = useRef<number | null>(null);
  const [countries, setCountries] = useState<GeoFeature[]>(cachedCountries ?? []);
  const [dimensions, setDimensions] = useState({ width: 0, height: 0 });
  const [hoverCountry, setHoverCountry] = useState<string | null>(null);
  const [pulseCountry, setPulseCountry] = useState<string | null>(null);

  const normalizedSelectedCountry = highlightedCountry ? normalizeCountry(highlightedCountry) : null;
  const memoryCountries = useMemo(() => new Set(memories.map((memory) => normalizeCountry(memory.country))), [memories]);
  const featureByCountry = useMemo(() => {
    const nextFeatureByCountry = new Map<string, GeoFeature>();
    for (const feature of countries) {
      const { canonicalCountry } = resolvePolygonCountry(feature);
      if (canonicalCountry) nextFeatureByCountry.set(canonicalCountry, feature);
    }
    return nextFeatureByCountry;
  }, [countries]);

  const pointData = useMemo(
    () => memories.filter((memory) => Number.isFinite(memory.coordinates.lat) && Number.isFinite(memory.coordinates.lng)),
    [memories],
  );

  const ringsData = useMemo(() => {
    const activeCountry = pulseCountry ?? normalizedSelectedCountry;
    if (!activeCountry) return [];
    return pointData.filter((memory) => normalizeCountry(memory.country) === activeCountry).slice(0, 3);
  }, [normalizedSelectedCountry, pointData, pulseCountry]);

  useEffect(() => {
    let cancelled = false;
    loadCountries()
      .then((nextCountries) => {
        if (!cancelled) setCountries(nextCountries);
      })
      .catch(() => {
        if (!cancelled) setCountries([]);
      });

    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    let frame = 0;

    const updateDimensions = () => {
      frame = 0;
      setDimensions((current) => {
        const next = { width: window.innerWidth, height: window.innerHeight };
        return current.width === next.width && current.height === next.height ? current : next;
      });
    };

    const onResize = () => {
      if (frame) window.cancelAnimationFrame(frame);
      frame = window.requestAnimationFrame(updateDimensions);
    };

    updateDimensions();
    window.addEventListener("resize", onResize, { passive: true });

    return () => {
      if (frame) window.cancelAnimationFrame(frame);
      window.removeEventListener("resize", onResize);
    };
  }, []);

  useEffect(() => {
    const globe = activeGlobeRef.current;
    if (!globe) return;

    const controls = globe.controls();
    if (controls) {
      controls.autoRotate = !hoverCountry && !normalizedSelectedCountry;
    }
  }, [activeGlobeRef, hoverCountry, normalizedSelectedCountry]);

  useEffect(() => {
    if (!normalizedSelectedCountry) return;

    const memory = pointData.find((item) => normalizeCountry(item.country) === normalizedSelectedCountry);
    const coords =
      memory?.coordinates ?? COUNTRY_COORDS[normalizedSelectedCountry] ?? getFeatureCenter(featureByCountry.get(normalizedSelectedCountry));
    if (!coords) return;

    activeGlobeRef.current?.pointOfView({ lat: coords.lat, lng: coords.lng, altitude: 1.72 }, 900);
  }, [activeGlobeRef, featureByCountry, normalizedSelectedCountry, pointData]);

  useEffect(() => {
    const onVisibilityChange = () => {
      if (document.hidden) {
        activeGlobeRef.current?.pauseAnimation();
      } else {
        activeGlobeRef.current?.resumeAnimation();
      }
    };

    document.addEventListener("visibilitychange", onVisibilityChange);
    return () => document.removeEventListener("visibilitychange", onVisibilityChange);
  }, [activeGlobeRef]);

  useEffect(() => {
    const canvas = activeGlobeRef.current?.renderer()?.domElement;
    if (!canvas) return;

    const onMouseDown = (event: MouseEvent) => {
      mouseDownPos.current = { x: event.clientX, y: event.clientY };
      isDragging.current = false;

      const controls = activeGlobeRef.current?.controls();
      if (controls) controls.autoRotate = false;
    };

    const onMouseMove = (event: MouseEvent) => {
      if (!mouseDownPos.current) return;

      const dx = event.clientX - mouseDownPos.current.x;
      const dy = event.clientY - mouseDownPos.current.y;
      if (Math.abs(dx) > DRAG_THRESHOLD_PX || Math.abs(dy) > DRAG_THRESHOLD_PX) {
        isDragging.current = true;
      }
    };

    const onMouseUp = () => {
      mouseDownPos.current = null;

      const controls = activeGlobeRef.current?.controls();
      if (controls) controls.autoRotate = !hoverCountry && !normalizedSelectedCountry;
    };

    canvas.addEventListener("mousedown", onMouseDown);
    window.addEventListener("mousemove", onMouseMove);
    window.addEventListener("mouseup", onMouseUp);

    return () => {
      canvas.removeEventListener("mousedown", onMouseDown);
      window.removeEventListener("mousemove", onMouseMove);
      window.removeEventListener("mouseup", onMouseUp);
    };
  }, [activeGlobeRef, hoverCountry, normalizedSelectedCountry]);

  useEffect(() => {
    return () => {
      if (pulseTimeoutRef.current) window.clearTimeout(pulseTimeoutRef.current);
    };
  }, []);

  const handlePolygonClick = useCallback(
    (polygon: object) => {
      if (isDragging.current) return;

      const { canonicalCountry } = resolvePolygonCountry(polygon);
      if (!canonicalCountry) return;

      setPulseCountry(canonicalCountry);
      if (pulseTimeoutRef.current) window.clearTimeout(pulseTimeoutRef.current);
      pulseTimeoutRef.current = window.setTimeout(() => {
        setPulseCountry((current) => (current === canonicalCountry ? null : current));
      }, 1300);

      onCountryClick(canonicalCountry);
    },
    [onCountryClick],
  );

  const handlePolygonHover = useCallback(
    (polygon: object | null) => {
      const { canonicalCountry } = resolvePolygonCountry(polygon);
      setHoverCountry(canonicalCountry);
      onCountryHover(canonicalCountry);
    },
    [onCountryHover],
  );

  if (dimensions.width === 0 || dimensions.height === 0) return null;

  return (
    <Globe
      ref={activeGlobeRef}
      width={dimensions.width}
      height={dimensions.height}
      animateIn={false}
      waitForGlobeReady={false}
      rendererConfig={{
        antialias: false,
        alpha: true,
        powerPreference: "high-performance",
      }}
      globeCurvatureResolution={4}
      polygonCapCurvatureResolution={4}
      backgroundColor="rgba(0,0,0,0)"
      backgroundImageUrl={GLOBE_BACKGROUND_URL}
      globeImageUrl={GLOBE_TEXTURE_URL}
      bumpImageUrl={GLOBE_BUMP_URL}
      showAtmosphere
      atmosphereColor="#9B45FE"
      atmosphereAltitude={0.13}
      enablePointerInteraction
      lineHoverPrecision={0.2}
      polygonsData={countries}
      polygonGeoJsonGeometry={(polygon) => (polygon as GeoFeature).geometry as never}
      polygonAltitude={(polygon) => {
        const { canonicalCountry } = resolvePolygonCountry(polygon);
        return normalizedSelectedCountry === canonicalCountry ? 0.0048 : 0.0028;
      }}
      polygonCapColor={(polygon) => {
        const { canonicalCountry } = resolvePolygonCountry(polygon);
        const hasMemories = canonicalCountry ? memoryCountries.has(canonicalCountry) : false;
        const isHovered = hoverCountry === canonicalCountry;
        const isSelected = normalizedSelectedCountry === canonicalCountry;

        if (isSelected) return "rgba(168, 85, 247, 0.34)";
        if (isHovered && hasMemories) return "rgba(147, 51, 234, 0.28)";
        if (isHovered) return "rgba(88, 28, 135, 0.13)";
        if (hasMemories) return "rgba(88, 28, 135, 0.2)";
        return "rgba(34, 20, 54, 0.1)";
      }}
      polygonSideColor={() => "rgba(23, 12, 38, 0.28)"}
      polygonStrokeColor={(polygon) => {
        const { canonicalCountry } = resolvePolygonCountry(polygon);
        const hasMemories = canonicalCountry ? memoryCountries.has(canonicalCountry) : false;
        const isHovered = hoverCountry === canonicalCountry;
        const isSelected = normalizedSelectedCountry === canonicalCountry;

        if (isSelected) return "rgba(245, 230, 255, 0.92)";
        if (isHovered && hasMemories) return "rgba(216,180,254,0.78)";
        if (isHovered) return "rgba(168,85,247,0.28)";
        if (hasMemories) return "rgba(192,132,252,0.42)";
        return "rgba(147,51,234,0.18)";
      }}
      polygonLabel={(polygon) => resolvePolygonCountry(polygon).rawCountry ?? ""}
      polygonsTransitionDuration={0}
      onPolygonClick={handlePolygonClick}
      onPolygonHover={handlePolygonHover}
      pointsData={pointData}
      pointLat={(point) => (point as AtlasMemory).coordinates.lat}
      pointLng={(point) => (point as AtlasMemory).coordinates.lng}
      pointAltitude={0.016}
      pointRadius={0.12}
      pointColor={() => "#9B45FE"}
      pointResolution={8}
      pointsMerge
      pointsTransitionDuration={0}
      pointLabel={(point) => memoryLabel(point as AtlasMemory)}
      onPointClick={(point) => onCountryClick(normalizeCountry((point as AtlasMemory).country))}
      arcsData={MEMORY_ARCS}
      arcStartLat="startLat"
      arcStartLng="startLng"
      arcEndLat="endLat"
      arcEndLng="endLng"
      arcColor={() => ["rgba(155,69,254,0.34)", "rgba(216,180,254,0.24)"]}
      arcDashLength={1}
      arcDashGap={0}
      arcDashAnimateTime={0}
      arcsTransitionDuration={0}
      arcCurveResolution={8}
      arcAltitudeAutoScale={0.18}
      arcLabel="label"
      ringsData={ringsData}
      ringLat={(point) => (point as AtlasMemory).coordinates.lat}
      ringLng={(point) => (point as AtlasMemory).coordinates.lng}
      ringColor={() => "rgba(216,180,254,0.78)"}
      ringMaxRadius={() => 0.92}
      ringPropagationSpeed={() => 1.2}
      ringRepeatPeriod={() => 760}
      ringResolution={12}
      onGlobeReady={() => {
        const globe = activeGlobeRef.current;
        if (!globe) return;

        const controls = globe.controls();
        if (controls) {
          controls.autoRotate = true;
          controls.autoRotateSpeed = 0.08;
          controls.enableZoom = true;
          controls.minDistance = 185;
          controls.maxDistance = 360;
          controls.enablePan = false;
          controls.enableDamping = true;
          controls.dampingFactor = 0.1;
          controls.rotateSpeed = 0.62;
          controls.zoomSpeed = 0.75;
        }

        const renderer = globe.renderer();
        renderer?.setPixelRatio(Math.min(window.devicePixelRatio || 1, MAX_DEVICE_PIXEL_RATIO));
        globe.pointOfView({ lat: 20, lng: 30, altitude: 2.02 }, 0);
      }}
    />
  );
}
