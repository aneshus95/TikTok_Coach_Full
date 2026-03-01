import React from 'react';
import {
  useCurrentFrame,
  useVideoConfig,
  interpolate,
  spring,
  OffthreadVideo,
  staticFile,
  Easing,
} from 'remotion';

export type TransformEffectProps = {
  type: 'zoom_in' | 'zoom_out' | 'pan_left' | 'pan_right' | 'shake' | 'tilt' | 'rotate';
  speed: 'slow' | 'medium' | 'fast';
  easing: 'linear' | 'ease_in' | 'ease_out' | 'spring';
  focalPoint?: {x: number; y: number};
  sourceVideo: string;
};

const SPEED_MAP = {slow: 0.5, medium: 1, fast: 2};

const getEasing = (type: string) => {
  switch (type) {
    case 'ease_in':
      return Easing.in(Easing.cubic);
    case 'ease_out':
      return Easing.out(Easing.cubic);
    case 'linear':
    default:
      return Easing.linear;
  }
};

export const TransformEffect: React.FC<TransformEffectProps> = ({
  type, speed, easing, focalPoint, sourceVideo,
}) => {
  const frame = useCurrentFrame();
  const {fps, durationInFrames, width, height} = useVideoConfig();
  const speedMul = SPEED_MAP[speed];
  const progress = frame / durationInFrames;
  const easingFn = getEasing(easing);

  const getTransform = (): React.CSSProperties => {
    const fx = focalPoint?.x ?? 50;
    const fy = focalPoint?.y ?? 50;

    switch (type) {
      case 'zoom_in': {
        let scale: number;
        if (easing === 'spring') {
          const s = spring({frame, fps, config: {damping: 20, stiffness: 40}});
          scale = 1 + s * 0.3 * speedMul;
        } else {
          scale = 1 + easingFn(progress) * 0.3 * speedMul;
        }
        return {
          transform: `scale(${scale})`,
          transformOrigin: `${fx}% ${fy}%`,
        };
      }
      case 'zoom_out': {
        const scale = 1.3 * speedMul - easingFn(progress) * 0.3 * speedMul;
        return {
          transform: `scale(${Math.max(1, scale)})`,
          transformOrigin: `${fx}% ${fy}%`,
        };
      }
      case 'pan_left': {
        const tx = easingFn(progress) * 15 * speedMul;
        return {
          transform: `translateX(${tx}%) scale(1.15)`,
          transformOrigin: 'center center',
        };
      }
      case 'pan_right': {
        const tx = -easingFn(progress) * 15 * speedMul;
        return {
          transform: `translateX(${tx}%) scale(1.15)`,
          transformOrigin: 'center center',
        };
      }
      case 'shake': {
        const intensity = 5 * speedMul;
        const x = Math.sin(frame * 1.5) * intensity;
        const y = Math.cos(frame * 2) * intensity * 0.6;
        const rot = Math.sin(frame * 1.8) * intensity * 0.3;
        return {
          transform: `translate(${x}px, ${y}px) rotate(${rot}deg)`,
          transformOrigin: 'center center',
        };
      }
      case 'tilt': {
        const tiltDeg = interpolate(
          easingFn(progress),
          [0, 1],
          [0, 5 * speedMul]
        );
        return {
          transform: `perspective(1000px) rotateX(${tiltDeg}deg) scale(1.05)`,
          transformOrigin: `${fx}% ${fy}%`,
        };
      }
      case 'rotate': {
        const deg = easingFn(progress) * 360 * speedMul;
        return {
          transform: `rotate(${deg}deg) scale(1.3)`,
          transformOrigin: `${fx}% ${fy}%`,
        };
      }
      default:
        return {};
    }
  };

  const transformStyle = getTransform();

  // If no source video provided, render as transparent (for compositing)
  if (!sourceVideo) {
    return (
      <div
        style={{
          width: '100%',
          height: '100%',
          backgroundColor: '#000',
          display: 'flex',
          justifyContent: 'center',
          alignItems: 'center',
          color: '#666',
          fontSize: 24,
        }}
      >
        Transform preview (no source video)
      </div>
    );
  }

  return (
    <div style={{width: '100%', height: '100%', overflow: 'hidden', backgroundColor: '#000'}}>
      <div style={{width: '100%', height: '100%', ...transformStyle}}>
        <OffthreadVideo
          src={sourceVideo}
          style={{width: '100%', height: '100%', objectFit: 'cover'}}
        />
      </div>
    </div>
  );
};
