import React from 'react';
import {OffthreadVideo, useVideoConfig} from 'remotion';
import {TextOverlay, type TextOverlayProps} from './TextOverlay';
import {ParticleEffect, type ParticleEffectProps} from './ParticleEffect';
import {GlowEffect, type GlowEffectProps} from './GlowEffect';
import {TransformEffect, type TransformEffectProps} from './TransformEffect';

export type EffectLayer = {
  type: 'text' | 'particles' | 'glow' | 'transform';
  props: Record<string, any>;
};

export type OverlayWithVideoProps = {
  sourceVideo: string;
  // New multi-layer format
  layers?: EffectLayer[];
  // Legacy single-template format (backward compat)
  template?: 'text' | 'particles' | 'glow' | 'transform';
  effectProps?: Record<string, any>;
};

export const OverlayWithVideo: React.FC<OverlayWithVideoProps> = ({
  sourceVideo,
  layers,
  template,
  effectProps,
}) => {
  const {width, height} = useVideoConfig();

  // Normalize: convert legacy single template to layers array
  const effectLayers: EffectLayer[] = layers ||
    (template ? [{type: template, props: effectProps || {}}] : []);

  // Separate transform layers from overlay layers
  const transformLayer = effectLayers.find(l => l.type === 'transform');
  const overlayLayers = effectLayers.filter(l => l.type !== 'transform');

  // Render all overlay layers stacked on top
  const renderOverlays = () =>
    overlayLayers.map((layer, idx) => (
      <div
        key={idx}
        style={{
          position: 'absolute',
          top: 0,
          left: 0,
          width: '100%',
          height: '100%',
          zIndex: idx + 1,
        }}
      >
        {layer.type === 'text' && <TextOverlay {...(layer.props as TextOverlayProps)} />}
        {layer.type === 'particles' && <ParticleEffect {...(layer.props as ParticleEffectProps)} />}
        {layer.type === 'glow' && <GlowEffect {...(layer.props as GlowEffectProps)} />}
      </div>
    ));

  // If transform exists, wrap video in TransformEffect + stack overlays on top
  if (transformLayer) {
    return (
      <div style={{width: '100%', height: '100%', position: 'relative', overflow: 'hidden'}}>
        {/* Background: source video with transform applied */}
        <div style={{position: 'absolute', top: 0, left: 0, width: '100%', height: '100%'}}>
          <TransformEffect
            {...(transformLayer.props as TransformEffectProps)}
            sourceVideo={sourceVideo}
          />
        </div>
        {/* Overlay effects on top of transformed video */}
        {renderOverlays()}
      </div>
    );
  }

  // No transform: source video as plain background + overlay layers
  return (
    <div style={{width: '100%', height: '100%', position: 'relative', overflow: 'hidden'}}>
      {sourceVideo ? (
        <OffthreadVideo
          src={sourceVideo}
          style={{
            position: 'absolute',
            top: 0,
            left: 0,
            width: '100%',
            height: '100%',
            objectFit: 'cover',
          }}
        />
      ) : (
        <div
          style={{
            position: 'absolute',
            top: 0,
            left: 0,
            width: '100%',
            height: '100%',
            backgroundColor: '#000',
          }}
        />
      )}
      {renderOverlays()}
    </div>
  );
};
