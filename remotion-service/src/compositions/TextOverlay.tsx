import React from 'react';
import {
  useCurrentFrame,
  useVideoConfig,
  interpolate,
  spring,
  Easing,
} from 'remotion';

export type TextOverlayProps = {
  text: string;
  position: 'center' | 'top' | 'bottom' | 'left' | 'right' | 'bottom_center' | 'upper_center';
  animation: 'bounce' | 'typewriter' | 'glitch' | 'vibrate' | 'fade' | 'slide' | 'neon' | 'scale_up';
  color: string;
  fontSize: number;
  fontWeight: string;
  strokeColor?: string;
  strokeWidth?: number;
};

const getPositionStyle = (position: string): React.CSSProperties => {
  const base: React.CSSProperties = {
    position: 'absolute',
    display: 'flex',
    justifyContent: 'center',
    alignItems: 'center',
    width: '100%',
  };
  switch (position) {
    case 'top':
      return {...base, top: '10%'};
    case 'bottom':
    case 'bottom_center':
      return {...base, bottom: '15%'};
    case 'left':
      return {...base, left: 0, top: '50%', transform: 'translateY(-50%)'};
    case 'right':
      return {...base, right: 0, top: '50%', transform: 'translateY(-50%)'};
    case 'upper_center':
      return {...base, top: '25%'};
    case 'center':
    default:
      return {...base, top: '50%', transform: 'translateY(-50%)'};
  }
};

export const TextOverlay: React.FC<TextOverlayProps> = ({
  text,
  position,
  animation,
  color,
  fontSize,
  fontWeight,
  strokeColor = '#000000',
  strokeWidth = 3,
}) => {
  const frame = useCurrentFrame();
  const {fps, durationInFrames} = useVideoConfig();

  const getAnimationStyle = (): React.CSSProperties => {
    switch (animation) {
      case 'bounce': {
        const s = spring({frame, fps, config: {damping: 8, stiffness: 100, mass: 0.5}});
        return {
          transform: `scale(${s})`,
          opacity: s,
        };
      }
      case 'typewriter': {
        const charsToShow = Math.floor(
          interpolate(frame, [0, Math.min(text.length * 3, durationInFrames * 0.6)], [0, text.length], {
            extrapolateRight: 'clamp',
          })
        );
        return {
          clipPath: `inset(0 ${((text.length - charsToShow) / text.length) * 100}% 0 0)`,
          opacity: 1,
        };
      }
      case 'glitch': {
        const offset = Math.sin(frame * 0.8) * 5;
        const skew = Math.sin(frame * 1.2) * 2;
        return {
          transform: `translateX(${offset}px) skewX(${skew}deg)`,
          textShadow: `${-offset}px 0 #ff0000, ${offset}px 0 #00ffff`,
          opacity: 1,
        };
      }
      case 'vibrate': {
        const x = Math.sin(frame * 2.5) * 4;
        const y = Math.cos(frame * 3) * 3;
        return {
          transform: `translate(${x}px, ${y}px)`,
          opacity: 1,
        };
      }
      case 'fade': {
        const fadeIn = interpolate(frame, [0, fps * 0.5], [0, 1], {extrapolateRight: 'clamp'});
        const fadeOut = interpolate(
          frame,
          [durationInFrames - fps * 0.5, durationInFrames],
          [1, 0],
          {extrapolateLeft: 'clamp'}
        );
        return {opacity: Math.min(fadeIn, fadeOut)};
      }
      case 'slide': {
        const slideProgress = spring({frame, fps, config: {damping: 15, stiffness: 80}});
        return {
          transform: `translateY(${interpolate(slideProgress, [0, 1], [100, 0])}px)`,
          opacity: slideProgress,
        };
      }
      case 'neon': {
        const glow = interpolate(Math.sin(frame * 0.15), [-1, 1], [10, 30]);
        const opacity = interpolate(Math.sin(frame * 0.15), [-1, 1], [0.8, 1]);
        return {
          textShadow: `0 0 ${glow}px ${color}, 0 0 ${glow * 2}px ${color}, 0 0 ${glow * 3}px ${color}`,
          opacity,
        };
      }
      case 'scale_up': {
        const s = spring({frame, fps, config: {damping: 12, stiffness: 60}});
        return {
          transform: `scale(${interpolate(s, [0, 1], [0.3, 1])})`,
          opacity: s,
        };
      }
      default:
        return {opacity: 1};
    }
  };

  const positionStyle = getPositionStyle(position);
  const animStyle = getAnimationStyle();

  return (
    <div style={{width: '100%', height: '100%', position: 'relative', backgroundColor: 'transparent'}}>
      <div style={positionStyle}>
        <div
          style={{
            fontSize,
            fontWeight,
            color,
            fontFamily: 'Arial Black, Arial, sans-serif',
            textAlign: 'center',
            WebkitTextStroke: `${strokeWidth}px ${strokeColor}`,
            paintOrder: 'stroke fill',
            letterSpacing: '2px',
            padding: '0 40px',
            lineHeight: 1.2,
            ...animStyle,
          }}
        >
          {text}
        </div>
      </div>
    </div>
  );
};
