import React from 'react';
import {
  AbsoluteFill,
  AnimatedImage,
  Audio,
  Easing,
  Freeze,
  IFrame,
  Img,
  Loop,
  OffthreadVideo,
  Sequence,
  Series,
  Video,
  cancelRender,
  continueRender,
  delayRender,
  getInputProps,
  interpolate,
  interpolateColors,
  measureSpring,
  prefetch,
  random,
  spring,
  staticFile,
  useBufferState,
  useCurrentFrame,
  useCurrentScale,
  useDelayRender,
  useVideoConfig,
} from 'remotion';

const RemotionAPI = {
  AbsoluteFill,
  AnimatedImage,
  Audio,
  Easing,
  Freeze,
  IFrame,
  Img,
  Loop,
  OffthreadVideo,
  Sequence,
  Series,
  Video,
  cancelRender,
  continueRender,
  delayRender,
  getInputProps,
  interpolate,
  interpolateColors,
  measureSpring,
  prefetch,
  random,
  spring,
  staticFile,
  useBufferState,
  useCurrentFrame,
  useCurrentScale,
  useDelayRender,
  useVideoConfig,
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
};

export const DynamicRenderer: React.FC<DynamicRendererProps> = ({
  transpiledCode,
  sourceVideo,
  sourceFiles,
}) => {
  const Component = React.useMemo(() => {
    try {
      const factory = new Function(
        'React',
        'Remotion',
        `const { AbsoluteFill, AnimatedImage, Audio, Easing, Freeze, IFrame, Img, Loop,
                OffthreadVideo, Sequence, Series, Video, cancelRender, continueRender,
                delayRender, getInputProps, interpolate, interpolateColors, measureSpring,
                prefetch, random, spring, staticFile, useBufferState, useCurrentFrame,
                useCurrentScale, useDelayRender, useVideoConfig } = Remotion;
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

  // Multi-file: pass sourceFiles array; single-file: backward compat with sourceVideo
  const effectProps = sourceFiles && sourceFiles.length > 0
    ? {sourceFiles, sourceVideo: sourceFiles[0].url}
    : {sourceVideo};

  return <Component {...effectProps} />;
};
