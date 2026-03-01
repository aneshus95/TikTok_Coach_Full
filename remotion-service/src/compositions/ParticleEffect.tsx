import React, {useMemo} from 'react';
import {useCurrentFrame, useVideoConfig, interpolate, random} from 'remotion';

export type ParticleEffectProps = {
  type: 'fire' | 'rain' | 'sparkles' | 'snow' | 'smoke' | 'confetti';
  position: 'sides' | 'top' | 'bottom' | 'center' | 'full';
  intensity: 'low' | 'medium' | 'high';
  color?: string;
};

type Particle = {
  id: number;
  x: number;
  y: number;
  size: number;
  speed: number;
  delay: number;
  hue: number;
  opacity: number;
};

const INTENSITY_COUNT = {low: 30, medium: 60, high: 100};

const getSpawnArea = (position: string) => {
  switch (position) {
    case 'sides':
      return {xRanges: [[0, 0.15], [0.85, 1]] as [number, number][], yRange: [0.2, 0.8] as [number, number]};
    case 'top':
      return {xRanges: [[0, 1]] as [number, number][], yRange: [0, 0.1] as [number, number]};
    case 'bottom':
      return {xRanges: [[0, 1]] as [number, number][], yRange: [0.8, 1] as [number, number]};
    case 'center':
      return {xRanges: [[0.3, 0.7]] as [number, number][], yRange: [0.3, 0.7] as [number, number]};
    case 'full':
    default:
      return {xRanges: [[0, 1]] as [number, number][], yRange: [0, 1] as [number, number]};
  }
};

const generateParticles = (count: number, position: string, seed: string): Particle[] => {
  const area = getSpawnArea(position);
  return Array.from({length: count}, (_, i) => {
    const rangeIndex = Math.floor(random(`${seed}-range-${i}`) * area.xRanges.length);
    const [xMin, xMax] = area.xRanges[rangeIndex];
    return {
      id: i,
      x: xMin + random(`${seed}-x-${i}`) * (xMax - xMin),
      y: area.yRange[0] + random(`${seed}-y-${i}`) * (area.yRange[1] - area.yRange[0]),
      size: 4 + random(`${seed}-size-${i}`) * 12,
      speed: 0.5 + random(`${seed}-speed-${i}`) * 1.5,
      delay: random(`${seed}-delay-${i}`) * 30,
      hue: random(`${seed}-hue-${i}`) * 60,
      opacity: 0.5 + random(`${seed}-op-${i}`) * 0.5,
    };
  });
};

const FireParticle: React.FC<{p: Particle; frame: number; fps: number; height: number; width: number}> = ({
  p, frame, fps, height, width,
}) => {
  const t = Math.max(0, frame - p.delay) / fps;
  const rise = t * p.speed * 120;
  const flicker = Math.sin(t * 8 + p.id) * 8;
  const fadeOut = interpolate(rise, [0, 200], [p.opacity, 0], {extrapolateRight: 'clamp'});
  const scale = interpolate(rise, [0, 100, 200], [0.3, 1, 0.1], {extrapolateRight: 'clamp'});

  return (
    <div
      style={{
        position: 'absolute',
        left: p.x * width + flicker,
        top: p.y * height - rise,
        width: p.size * scale,
        height: p.size * scale * 1.5,
        borderRadius: '50% 50% 50% 50% / 60% 60% 40% 40%',
        background: `radial-gradient(ellipse, rgba(255,${180 + p.hue},0,${fadeOut}), rgba(255,${80 + p.hue},0,${fadeOut * 0.5}), transparent)`,
        filter: `blur(${1 + p.size * 0.1}px)`,
        boxShadow: `0 0 ${p.size}px rgba(255,${100 + p.hue},0,${fadeOut * 0.6})`,
      }}
    />
  );
};

const RainDrop: React.FC<{p: Particle; frame: number; fps: number; height: number; width: number}> = ({
  p, frame, fps, height, width,
}) => {
  const t = Math.max(0, frame - p.delay) / fps;
  const fall = (t * p.speed * 400) % (height * 1.2);
  const sway = Math.sin(t * 2 + p.id) * 3;

  return (
    <div
      style={{
        position: 'absolute',
        left: p.x * width + sway,
        top: fall - 50,
        width: 2,
        height: 15 + p.size,
        background: `linear-gradient(to bottom, transparent, rgba(180,210,255,${p.opacity * 0.7}))`,
        borderRadius: 1,
      }}
    />
  );
};

const Sparkle: React.FC<{p: Particle; frame: number; fps: number; height: number; width: number; color?: string}> = ({
  p, frame, fps, height, width, color,
}) => {
  const t = Math.max(0, frame - p.delay) / fps;
  const twinkle = Math.sin(t * 6 + p.id * 2) * 0.5 + 0.5;
  const drift = Math.sin(t * 1.5 + p.id) * 15;
  const rise = Math.sin(t * 0.8 + p.id * 0.5) * 20;
  const c = color || '#FFFFFF';

  return (
    <div
      style={{
        position: 'absolute',
        left: p.x * width + drift,
        top: p.y * height + rise,
        width: p.size * twinkle,
        height: p.size * twinkle,
        background: c,
        borderRadius: '50%',
        boxShadow: `0 0 ${p.size * 2 * twinkle}px ${c}, 0 0 ${p.size * 4 * twinkle}px ${c}`,
        opacity: twinkle * p.opacity,
      }}
    />
  );
};

const SnowFlake: React.FC<{p: Particle; frame: number; fps: number; height: number; width: number}> = ({
  p, frame, fps, height, width,
}) => {
  const t = Math.max(0, frame - p.delay) / fps;
  const fall = (t * p.speed * 80) % (height * 1.2);
  const sway = Math.sin(t * 1.5 + p.id) * 30;

  return (
    <div
      style={{
        position: 'absolute',
        left: p.x * width + sway,
        top: fall - 20,
        width: p.size,
        height: p.size,
        background: `rgba(255,255,255,${p.opacity * 0.8})`,
        borderRadius: '50%',
        filter: `blur(${p.size * 0.15}px)`,
      }}
    />
  );
};

const SmokeParticle: React.FC<{p: Particle; frame: number; fps: number; height: number; width: number}> = ({
  p, frame, fps, height, width,
}) => {
  const t = Math.max(0, frame - p.delay) / fps;
  const rise = t * p.speed * 60;
  const spread = t * 20;
  const fadeOut = interpolate(rise, [0, 300], [p.opacity * 0.4, 0], {extrapolateRight: 'clamp'});
  const size = p.size * (1 + t * 0.8);

  return (
    <div
      style={{
        position: 'absolute',
        left: p.x * width + Math.sin(t + p.id) * spread,
        top: p.y * height - rise,
        width: size * 4,
        height: size * 4,
        borderRadius: '50%',
        background: `radial-gradient(circle, rgba(180,180,180,${fadeOut}), transparent)`,
        filter: `blur(${size}px)`,
      }}
    />
  );
};

const ConfettiPiece: React.FC<{p: Particle; frame: number; fps: number; height: number; width: number}> = ({
  p, frame, fps, height, width,
}) => {
  const t = Math.max(0, frame - p.delay) / fps;
  const fall = (t * p.speed * 150) % (height * 1.3);
  const sway = Math.sin(t * 3 + p.id) * 40;
  const rotation = t * 200 * p.speed;
  const colors = ['#FF6B6B', '#4ECDC4', '#45B7D1', '#F9CA24', '#FF69B4', '#00D4FF', '#00FFB3'];
  const c = colors[p.id % colors.length];

  return (
    <div
      style={{
        position: 'absolute',
        left: p.x * width + sway,
        top: fall - 50,
        width: p.size * 0.6,
        height: p.size * 1.2,
        background: c,
        borderRadius: 2,
        transform: `rotate(${rotation}deg) scaleX(${Math.sin(t * 5 + p.id) * 0.3 + 0.7})`,
        opacity: p.opacity,
      }}
    />
  );
};

export const ParticleEffect: React.FC<ParticleEffectProps> = ({type, position, intensity, color}) => {
  const frame = useCurrentFrame();
  const {fps, width, height} = useVideoConfig();
  const count = INTENSITY_COUNT[intensity];

  const particles = useMemo(
    () => generateParticles(count, position, `${type}-${position}`),
    [count, position, type]
  );

  const renderParticle = (p: Particle) => {
    const shared = {p, frame, fps, height, width};
    switch (type) {
      case 'fire':
        return <FireParticle key={p.id} {...shared} />;
      case 'rain':
        return <RainDrop key={p.id} {...shared} />;
      case 'sparkles':
        return <Sparkle key={p.id} {...shared} color={color} />;
      case 'snow':
        return <SnowFlake key={p.id} {...shared} />;
      case 'smoke':
        return <SmokeParticle key={p.id} {...shared} />;
      case 'confetti':
        return <ConfettiPiece key={p.id} {...shared} />;
      default:
        return null;
    }
  };

  return (
    <div style={{width: '100%', height: '100%', position: 'relative', backgroundColor: 'transparent', overflow: 'hidden'}}>
      {particles.map(renderParticle)}
    </div>
  );
};
