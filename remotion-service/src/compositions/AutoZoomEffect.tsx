import React from 'react';
import {
  useCurrentFrame,
  useVideoConfig,
  interpolate,
  spring,
  OffthreadVideo,
  AbsoluteFill,
} from 'remotion';

type Moment = {
  time: number;
  intensity: number;
};

type FacePosition = {
  x: number;
  y: number;
};

export type AutoZoomEffectProps = {
  sourceVideo: string;
  moments: Moment[];
  facePosition: FacePosition;
  zoomScale: number;
};

export const AutoZoomEffect: React.FC<AutoZoomEffectProps> = ({
  sourceVideo,
  moments = [],
  facePosition = {x: 50, y: 35},
  zoomScale = 1.15,
}) => {
  const frame = useCurrentFrame();
  const {fps, width, height} = useVideoConfig();
  const currentTime = frame / fps;

  // Calculate zoom at current time based on emphasis moments
  let currentZoom = 1.0;

  for (let i = 0; i < moments.length; i++) {
    const moment = moments[i];
    const momentTime = moment.time;
    const momentIntensity = moment.intensity;

    // Alternate zoom levels for variety
    const zoomMultiplier = i % 2 === 0 ? 1.0 : 0.7;
    const targetZoom = 1.0 + (zoomScale - 1.0) * momentIntensity * zoomMultiplier;

    // Timing: ramp up 0.15s, hold 0.3s, ramp down 0.15s
    const rampUp = 0.15;
    const hold = 0.3;
    const rampDown = 0.15;
    const totalDuration = rampUp + hold + rampDown;

    const startTime = momentTime - rampUp * 0.5;
    const endTime = startTime + totalDuration;

    if (currentTime >= startTime && currentTime <= endTime) {
      const localT = currentTime - startTime;

      let zoomT: number;
      if (localT < rampUp) {
        // Ramp up phase
        zoomT = localT / rampUp;
        // Ease out cubic for snappy entrance
        zoomT = 1 - Math.pow(1 - zoomT, 3);
      } else if (localT < rampUp + hold) {
        // Hold phase
        zoomT = 1.0;
      } else {
        // Ramp down phase
        zoomT = 1 - (localT - rampUp - hold) / rampDown;
        // Ease in cubic for smooth exit
        zoomT = Math.pow(zoomT, 3);
      }

      const momentZoom = 1.0 + (targetZoom - 1.0) * zoomT;
      // Take the maximum zoom if moments overlap
      currentZoom = Math.max(currentZoom, momentZoom);
    }
  }

  // Vignette intensity follows zoom
  const vignetteOpacity = interpolate(currentZoom, [1.0, zoomScale], [0, 0.35], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
  });

  // Transform origin based on face position
  const originX = facePosition.x;
  const originY = facePosition.y;

  return (
    <AbsoluteFill>
      {/* Zoomed video */}
      <div
        style={{
          position: 'absolute',
          width: '100%',
          height: '100%',
          transform: `scale(${currentZoom})`,
          transformOrigin: `${originX}% ${originY}%`,
          willChange: 'transform',
        }}
      >
        {sourceVideo ? (
          <OffthreadVideo
            src={sourceVideo}
            style={{
              width: '100%',
              height: '100%',
              objectFit: 'cover',
            }}
          />
        ) : (
          <div style={{width: '100%', height: '100%', backgroundColor: '#000'}} />
        )}
      </div>

      {/* Subtle vignette during zoomed frames */}
      {vignetteOpacity > 0.01 && (
        <div
          style={{
            position: 'absolute',
            top: 0,
            left: 0,
            width: '100%',
            height: '100%',
            background: `radial-gradient(ellipse at ${originX}% ${originY}%, transparent 50%, rgba(0,0,0,${vignetteOpacity}) 100%)`,
            pointerEvents: 'none',
          }}
        />
      )}
    </AbsoluteFill>
  );
};
