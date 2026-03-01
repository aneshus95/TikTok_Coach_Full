import React from 'react';
import {useCurrentFrame, useVideoConfig, interpolate, spring, OffthreadVideo, Easing, AbsoluteFill} from 'remotion';

type Props = {sourceVideo: string};

export const GeneratedEffect: React.FC<Props> = ({sourceVideo}) => {
  const frame = useCurrentFrame();
  const {width, height, fps, durationInFrames} = useVideoConfig();
  const canvasRef = React.useRef<HTMLCanvasElement>(null);

  function seededRandom(seed: number): number {
    const x = Math.sin(seed * 127.1 + seed * 311.7) * 43758.5453;
    return x - Math.floor(x);
  }

  React.useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    
    ctx.clearRect(0, 0, width, height);
    ctx.globalCompositeOperation = 'lighter';
    
    const PARTICLE_COUNT = 250;
    const t = frame / fps;
    
    // Main fire particles
    for (let i = 0; i < PARTICLE_COUNT; i++) {
      const seed1 = seededRandom(i * 1000 + 1);
      const seed2 = seededRandom(i * 1000 + 2);
      const seed3 = seededRandom(i * 1000 + 3);
      const seed4 = seededRandom(i * 1000 + 4);
      
      const period = 0.8 + seed1 * 1.5;
      const phase = seed2 * period;
      const life = ((t + phase) % period) / period;
      
      const spawnX = width * (0.2 + seed3 * 0.6);
      const drift = Math.sin(t * 2 + seed4 * 6.28) * 40 * seed2;
      const x = spawnX + drift + (seed4 - 0.5) * 80;
      const y = height * 0.95 - life * height * (0.3 + seed1 * 0.25);
      
      const baseSize = 12 + seed3 * 30;
      const sizeLife = life < 0.3 ? life / 0.3 : life < 0.7 ? 1 : 1 - (life - 0.7) / 0.3;
      const size = baseSize * sizeLife;
      
      const r = 255;
      const g = Math.floor(255 - life * 200);
      const b = Math.floor(80 - life * 80);
      const alpha = (1 - life) * (0.6 + seed2 * 0.4);
      
      ctx.shadowBlur = 20;
      ctx.shadowColor = `rgba(${r},${g},0,${alpha * 0.5})`;
      
      const grad = ctx.createRadialGradient(x, y, 0, x, y, size);
      grad.addColorStop(0, `rgba(${r},${Math.min(255, g+50)},${Math.min(255, b+30)},${alpha})`);
      grad.addColorStop(0.4, `rgba(${r},${g},${b},${alpha * 0.6})`);
      grad.addColorStop(1, `rgba(${r},${Math.max(0, g-50)},0,0)`);
      
      ctx.fillStyle = grad;
      ctx.beginPath();
      ctx.arc(x, y, size, 0, Math.PI * 2);
      ctx.fill();
    }
    
    // Ember sparks
    const EMBER_COUNT = 50;
    for (let i = 0; i < EMBER_COUNT; i++) {
      const seed1 = seededRandom(i * 2000 + 1);
      const seed2 = seededRandom(i * 2000 + 2);
      const seed3 = seededRandom(i * 2000 + 3);
      
      const period = 1.5 + seed1 * 2;
      const phase = seed2 * period;
      const life = ((t + phase) % period) / period;
      
      const spawnX = width * (0.25 + seed3 * 0.5);
      const drift = Math.sin(t * 3 + seed2 * 6.28) * 60 * seed1;
      const x = spawnX + drift;
      const y = height * 0.9 - life * height * (0.5 + seed1 * 0.3);
      
      const size = 2 + seed3 * 3;
      const alpha = (1 - life) * 0.9;
      
      ctx.shadowBlur = 15;
      ctx.shadowColor = `rgba(255,220,50,${alpha})`;
      ctx.fillStyle = `rgba(255,240,100,${alpha})`;
      ctx.beginPath();
      ctx.arc(x, y, size, 0, Math.PI * 2);
      ctx.fill();
    }
    
    // Smoke particles
    ctx.globalCompositeOperation = 'screen';
    const SMOKE_COUNT = 30;
    for (let i = 0; i < SMOKE_COUNT; i++) {
      const seed1 = seededRandom(i * 3000 + 1);
      const seed2 = seededRandom(i * 3000 + 2);
      const seed3 = seededRandom(i * 3000 + 3);
      
      const period = 3 + seed1 * 2;
      const phase = seed2 * period;
      const life = ((t + phase) % period) / period;
      
      const x = width * (0.3 + seed3 * 0.4) + Math.sin(t * 0.5 + i) * 50;
      const y = height * 0.7 - life * height * 0.5;
      const size = 40 + life * 80;
      const alpha = (1 - life) * 0.08;
      
      const grad = ctx.createRadialGradient(x, y, 0, x, y, size);
      grad.addColorStop(0, `rgba(180,180,200,${alpha})`);
      grad.addColorStop(1, 'rgba(100,100,120,0)');
      
      ctx.fillStyle = grad;
      ctx.beginPath();
      ctx.arc(x, y, size, 0, Math.PI * 2);
      ctx.fill();
    }
    
    // Base glow
    ctx.globalCompositeOperation = 'lighter';
    const baseGlow = ctx.createRadialGradient(width*0.5, height*0.95, 0, width*0.5, height*0.95, width*0.5);
    baseGlow.addColorStop(0, 'rgba(255,150,50,0.2)');
    baseGlow.addColorStop(0.5, 'rgba(255,80,20,0.1)');
    baseGlow.addColorStop(1, 'rgba(255,30,0,0)');
    ctx.fillStyle = baseGlow;
    ctx.fillRect(0, 0, width, height);
    
  }, [frame, width, height, fps]);

  return (
    <AbsoluteFill>
      <OffthreadVideo src={sourceVideo} style={{width: '100%', height: '100%', objectFit: 'cover'}} />
      <canvas
        ref={canvasRef}
        width={width}
        height={height}
        style={{
          position: 'absolute',
          top: 0,
          left: 0,
          width: '100%',
          height: '100%'
        }}
      />
    </AbsoluteFill>
  );
};