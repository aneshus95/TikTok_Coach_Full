import React from 'react';
import * as RemotionCore from 'remotion';

// @remotion packages — wildcard imports so new exports are auto-available
import * as RemotionTransitions from '@remotion/transitions';
import { fade } from '@remotion/transitions/fade';
import { slide } from '@remotion/transitions/slide';
import { wipe } from '@remotion/transitions/wipe';
import { flip } from '@remotion/transitions/flip';
import { clockWipe } from '@remotion/transitions/clock-wipe';
import { none } from '@remotion/transitions/none';
import * as RemotionShapes from '@remotion/shapes';
import * as RemotionNoise from '@remotion/noise';
import * as RemotionMotionBlur from '@remotion/motion-blur';
import * as RemotionLayoutUtils from '@remotion/layout-utils';
import * as RemotionAnimationUtils from '@remotion/animation-utils';
import * as RemotionPaths from '@remotion/paths';
import * as RemotionGif from '@remotion/gif';
import * as RemotionLottie from '@remotion/lottie';
import * as RemotionMediaUtils from '@remotion/media-utils';
import * as RemotionPreload from '@remotion/preload';
import * as RemotionGoogleFonts from '@remotion/google-fonts';

// Merge all exports into one flat object — new APIs are auto-available
const RemotionAPI: Record<string, unknown> = {
  ...RemotionCore,
  ...RemotionTransitions,
  // Transition presentations (sub-path exports, not in wildcard)
  fade,
  slide,
  wipe,
  flip,
  clockWipe,
  none,
  ...RemotionShapes,
  ...RemotionNoise,
  ...RemotionMotionBlur,
  ...RemotionLayoutUtils,
  ...RemotionAnimationUtils,
  ...RemotionPaths,
  ...RemotionGif,
  ...RemotionLottie,
  ...RemotionMediaUtils,
  ...RemotionPreload,
  ...RemotionGoogleFonts,
};

export type SourceFile = {
  url: string;
  type: 'video' | 'image';
  durationInFrames: number;
  label?: string;
};

export type DynamicRendererProps = {
  transpiledCode: string;
  sourceVideo: string;
  sourceFiles?: SourceFile[];
  audioUrl?: string;
};

export const DynamicRenderer: React.FC<DynamicRendererProps> = ({
  transpiledCode,
  sourceVideo,
  sourceFiles,
  audioUrl,
}) => {
  const Component = React.useMemo(() => {
    try {
      // Dynamically destructure ALL available APIs — no manual list needed
      const apiKeys = Object.keys(RemotionAPI).filter(k => /^[a-zA-Z_$]/.test(k));
      const destructure = `const { ${apiKeys.join(', ')} } = Remotion;`;

      const factory = new Function(
        'React',
        'Remotion',
        `${destructure}
         const { useState, useEffect, useMemo, useCallback, useRef } = React;
         ${transpiledCode}
         return typeof Effect !== 'undefined' ? Effect : null;`
      );
      return factory(React, RemotionAPI);
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : String(e);
      console.error('[DynamicRenderer] Failed to evaluate composition code:', msg);
      console.error('[DynamicRenderer] Code preview:', transpiledCode.substring(0, 300));
      return null;
    }
  }, [transpiledCode]);

  if (!Component) {
    return (
      <RemotionCore.AbsoluteFill
        style={{
          backgroundColor: 'black',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
        }}
      >
        <div style={{color: 'red', fontSize: 32, fontFamily: 'sans-serif'}}>
          Render Error
        </div>
      </RemotionCore.AbsoluteFill>
    );
  }

  // Multi-file: pass sourceFiles array; single-file: backward compat with sourceVideo
  const effectProps = sourceFiles && sourceFiles.length > 0
    ? {sourceFiles, sourceVideo: sourceFiles[0].url}
    : {sourceVideo};

  // Pass audioUrl if provided (custom audio replaces original video audio)
  if (audioUrl) {
    (effectProps as any).audioUrl = audioUrl;
  }

  return <Component {...effectProps} />;
};
