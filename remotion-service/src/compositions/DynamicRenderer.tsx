import React from 'react';
import {
  AbsoluteFill,
  OffthreadVideo,
  useCurrentFrame,
  useVideoConfig,
  interpolate,
  interpolateColors,
  spring,
  Sequence,
  random,
  Easing,
  Audio,
  Img,
  staticFile,
  Series,
  Loop,
  Freeze,
} from 'remotion';

const RemotionAPI = {
  AbsoluteFill,
  OffthreadVideo,
  useCurrentFrame,
  useVideoConfig,
  interpolate,
  interpolateColors,
  spring,
  Sequence,
  random,
  Easing,
  Audio,
  Img,
  staticFile,
  Series,
  Loop,
  Freeze,
};

export type DynamicRendererProps = {
  transpiledCode: string;
  sourceVideo: string;
};

export const DynamicRenderer: React.FC<DynamicRendererProps> = ({
  transpiledCode,
  sourceVideo,
}) => {
  const Component = React.useMemo(() => {
    try {
      const factory = new Function(
        'React',
        'Remotion',
        `const { AbsoluteFill, OffthreadVideo, useCurrentFrame, useVideoConfig,
                interpolate, interpolateColors, spring, Sequence, random, Easing, Audio, Img, staticFile, Series, Loop, Freeze } = Remotion;
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
      <AbsoluteFill
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
      </AbsoluteFill>
    );
  }

  return <Component sourceVideo={sourceVideo} />;
};
