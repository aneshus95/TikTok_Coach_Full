import React from 'react';
import {useCurrentFrame, useVideoConfig, interpolate} from 'remotion';

export type GlowEffectProps = {
  type: 'neon' | 'lens_flare' | 'light_leak' | 'aura';
  color: string;
  radius: number;
  position: 'center' | 'top' | 'bottom' | 'left' | 'right' | 'sides';
  pulse: boolean;
  pulseSpeed: number;
};

const getGlowPosition = (position: string): {x: string; y: string}[] => {
  switch (position) {
    case 'top':
      return [{x: '50%', y: '10%'}];
    case 'bottom':
      return [{x: '50%', y: '90%'}];
    case 'left':
      return [{x: '10%', y: '50%'}];
    case 'right':
      return [{x: '90%', y: '50%'}];
    case 'sides':
      return [{x: '5%', y: '50%'}, {x: '95%', y: '50%'}];
    case 'center':
    default:
      return [{x: '50%', y: '50%'}];
  }
};

const hexToRgb = (hex: string) => {
  const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
  return result
    ? {r: parseInt(result[1], 16), g: parseInt(result[2], 16), b: parseInt(result[3], 16)}
    : {r: 0, g: 212, b: 255};
};

export const GlowEffect: React.FC<GlowEffectProps> = ({
  type, color, radius, position, pulse, pulseSpeed,
}) => {
  const frame = useCurrentFrame();
  const {fps} = useVideoConfig();
  const t = frame / fps;
  const rgb = hexToRgb(color);

  const pulseMultiplier = pulse
    ? interpolate(Math.sin(t * pulseSpeed * Math.PI * 2), [-1, 1], [0.6, 1])
    : 1;

  const positions = getGlowPosition(position);

  if (type === 'neon') {
    return (
      <div style={{width: '100%', height: '100%', position: 'relative', backgroundColor: 'transparent'}}>
        {positions.map((pos, i) => (
          <div
            key={i}
            style={{
              position: 'absolute',
              left: pos.x,
              top: pos.y,
              transform: 'translate(-50%, -50%)',
              width: radius * 2 * pulseMultiplier,
              height: radius * 2 * pulseMultiplier,
              borderRadius: '50%',
              background: `radial-gradient(circle, rgba(${rgb.r},${rgb.g},${rgb.b},${0.3 * pulseMultiplier}) 0%, rgba(${rgb.r},${rgb.g},${rgb.b},${0.1 * pulseMultiplier}) 40%, transparent 70%)`,
              filter: `blur(${radius * 0.3}px)`,
            }}
          />
        ))}
      </div>
    );
  }

  if (type === 'lens_flare') {
    const flareX = interpolate(Math.sin(t * 0.5), [-1, 1], [20, 80]);
    const flareY = interpolate(Math.cos(t * 0.3), [-1, 1], [15, 40]);
    return (
      <div style={{width: '100%', height: '100%', position: 'relative', backgroundColor: 'transparent'}}>
        {/* Main flare */}
        <div
          style={{
            position: 'absolute',
            left: `${flareX}%`,
            top: `${flareY}%`,
            transform: 'translate(-50%, -50%)',
            width: radius * 1.5 * pulseMultiplier,
            height: radius * 1.5 * pulseMultiplier,
            borderRadius: '50%',
            background: `radial-gradient(circle, rgba(255,255,255,${0.4 * pulseMultiplier}), rgba(${rgb.r},${rgb.g},${rgb.b},${0.2 * pulseMultiplier}), transparent)`,
            filter: `blur(${radius * 0.2}px)`,
          }}
        />
        {/* Flare streak */}
        <div
          style={{
            position: 'absolute',
            left: `${flareX}%`,
            top: `${flareY}%`,
            transform: 'translate(-50%, -50%)',
            width: radius * 4,
            height: radius * 0.15,
            background: `linear-gradient(to right, transparent, rgba(${rgb.r},${rgb.g},${rgb.b},${0.3 * pulseMultiplier}), transparent)`,
            filter: `blur(${3}px)`,
          }}
        />
        {/* Secondary orbs */}
        {[0.3, 0.6, 0.9].map((offset, i) => (
          <div
            key={i}
            style={{
              position: 'absolute',
              left: `${flareX + (50 - flareX) * offset}%`,
              top: `${flareY + (50 - flareY) * offset}%`,
              transform: 'translate(-50%, -50%)',
              width: radius * 0.3 * (1 - offset * 0.5),
              height: radius * 0.3 * (1 - offset * 0.5),
              borderRadius: '50%',
              background: `rgba(${rgb.r},${rgb.g},${rgb.b},${0.15 * pulseMultiplier})`,
              filter: 'blur(2px)',
            }}
          />
        ))}
      </div>
    );
  }

  if (type === 'light_leak') {
    const leakOpacity = interpolate(Math.sin(t * pulseSpeed * 2), [-1, 1], [0.05, 0.25]);
    const hueShift = interpolate(Math.sin(t * 0.3), [-1, 1], [-10, 10]);
    return (
      <div style={{width: '100%', height: '100%', position: 'relative', backgroundColor: 'transparent'}}>
        <div
          style={{
            position: 'absolute',
            top: 0,
            left: 0,
            width: '100%',
            height: '100%',
            background: `linear-gradient(${120 + hueShift}deg, transparent 20%, rgba(${rgb.r},${rgb.g},${rgb.b},${leakOpacity}) 50%, rgba(255,${Math.min(255, rgb.g + 80)},${Math.min(255, rgb.b + 50)},${leakOpacity * 0.6}) 70%, transparent 90%)`,
            filter: `blur(${40}px)`,
          }}
        />
      </div>
    );
  }

  // aura
  const auraScale = pulse ? 1 + Math.sin(t * pulseSpeed * Math.PI * 2) * 0.1 : 1;
  return (
    <div style={{width: '100%', height: '100%', position: 'relative', backgroundColor: 'transparent'}}>
      {positions.map((pos, i) => (
        <div
          key={i}
          style={{
            position: 'absolute',
            left: pos.x,
            top: pos.y,
            transform: `translate(-50%, -50%) scale(${auraScale})`,
            width: radius * 3,
            height: radius * 4,
            borderRadius: '50%',
            background: `radial-gradient(ellipse, rgba(${rgb.r},${rgb.g},${rgb.b},${0.15 * pulseMultiplier}), rgba(${rgb.r},${rgb.g},${rgb.b},${0.05 * pulseMultiplier}) 50%, transparent 70%)`,
            filter: `blur(${radius * 0.4}px)`,
          }}
        />
      ))}
    </div>
  );
};
