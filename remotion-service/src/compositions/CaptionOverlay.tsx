import React from 'react';
import {
  useCurrentFrame,
  useVideoConfig,
  interpolate,
  spring,
  OffthreadVideo,
  AbsoluteFill,
  Easing,
} from 'remotion';

type Word = {
  word: string;
  start: number;
  end: number;
};

type CaptionLine = {
  words: Word[];
  start: number;
  end: number;
};

export type CaptionOverlayProps = {
  sourceVideo: string;
  words: Word[];
  style: 'bold_centered' | 'karaoke_highlight' | 'word_pop';
  fontSize?: number;
  color?: string;
  position?: 'bottom' | 'center' | 'top';
};

// Group words into caption lines (~4 words, respecting pauses)
function groupWords(words: Word[]): CaptionLine[] {
  const lines: CaptionLine[] = [];
  let current: Word[] = [];

  for (let i = 0; i < words.length; i++) {
    current.push(words[i]);

    const isLast = i === words.length - 1;
    const nextGap = !isLast ? words[i + 1].start - words[i].end : 999;
    const wordCount = current.length;

    // Break line if: 4+ words, big pause (>0.3s), or last word
    if (wordCount >= 4 || nextGap > 0.3 || isLast) {
      lines.push({
        words: [...current],
        start: current[0].start,
        end: current[current.length - 1].end,
      });
      current = [];
    }
  }

  return lines;
}

// Style 1: Bold centered — lines fade in/out
const BoldCentered: React.FC<{
  lines: CaptionLine[];
  frame: number;
  fps: number;
  width: number;
  fontSize: number;
  color: string;
  yPosition: string;
}> = ({lines, frame, fps, width, fontSize, color, yPosition}) => {
  const currentTime = frame / fps;

  return (
    <>
      {lines.map((line, idx) => {
        const lineStart = line.start;
        const lineEnd = line.end;
        const fadeDuration = 0.15;

        // Only render if line is active (with small buffer)
        if (currentTime < lineStart - fadeDuration || currentTime > lineEnd + fadeDuration) {
          return null;
        }

        const opacity = interpolate(
          currentTime,
          [lineStart - fadeDuration, lineStart, lineEnd, lineEnd + fadeDuration],
          [0, 1, 1, 0],
          {extrapolateLeft: 'clamp', extrapolateRight: 'clamp'}
        );

        const text = line.words.map(w => w.word).join(' ');

        return (
          <div
            key={idx}
            style={{
              position: 'absolute',
              top: yPosition,
              left: '50%',
              transform: 'translate(-50%, -50%)',
              opacity,
              fontSize,
              fontFamily: 'Arial Black, Impact, sans-serif',
              fontWeight: 900,
              color,
              textAlign: 'center',
              textTransform: 'uppercase',
              letterSpacing: '0.02em',
              lineHeight: 1.2,
              maxWidth: width * 0.85,
              WebkitTextStroke: `${Math.max(1, fontSize * 0.04)}px #000`,
              paintOrder: 'stroke fill',
              textShadow: '0 2px 8px rgba(0,0,0,0.8), 0 4px 16px rgba(0,0,0,0.4)',
              zIndex: 10,
            }}
          >
            {text}
          </div>
        );
      })}
    </>
  );
};

// Style 2: Karaoke highlight — words turn from gray to color as spoken
const KaraokeHighlight: React.FC<{
  lines: CaptionLine[];
  frame: number;
  fps: number;
  width: number;
  fontSize: number;
  color: string;
  yPosition: string;
}> = ({lines, frame, fps, width, fontSize, color, yPosition}) => {
  const currentTime = frame / fps;

  return (
    <>
      {lines.map((line, idx) => {
        const lineStart = line.start;
        const lineEnd = line.end;
        const buffer = 0.15;

        if (currentTime < lineStart - buffer || currentTime > lineEnd + buffer) {
          return null;
        }

        const lineOpacity = interpolate(
          currentTime,
          [lineStart - buffer, lineStart, lineEnd, lineEnd + buffer],
          [0, 1, 1, 0],
          {extrapolateLeft: 'clamp', extrapolateRight: 'clamp'}
        );

        return (
          <div
            key={idx}
            style={{
              position: 'absolute',
              top: yPosition,
              left: '50%',
              transform: 'translate(-50%, -50%)',
              opacity: lineOpacity,
              display: 'flex',
              flexWrap: 'wrap',
              justifyContent: 'center',
              gap: `${fontSize * 0.2}px`,
              maxWidth: width * 0.85,
              zIndex: 10,
            }}
          >
            {line.words.map((word, wIdx) => {
              // Word highlight progress: 0 (not spoken) to 1 (spoken)
              const wordMid = (word.start + word.end) / 2;
              const highlight = interpolate(
                currentTime,
                [word.start, wordMid],
                [0, 1],
                {extrapolateLeft: 'clamp', extrapolateRight: 'clamp'}
              );

              const wordColor = highlight > 0.5 ? color : 'rgba(255,255,255,0.4)';
              const scale = highlight > 0.5 ? 1.05 : 1.0;

              return (
                <span
                  key={wIdx}
                  style={{
                    fontSize,
                    fontFamily: 'Arial Black, Impact, sans-serif',
                    fontWeight: 900,
                    color: wordColor,
                    textTransform: 'uppercase',
                    transform: `scale(${scale})`,
                    transition: 'color 0.1s, transform 0.1s',
                    WebkitTextStroke: `${Math.max(1, fontSize * 0.035)}px #000`,
                    paintOrder: 'stroke fill',
                    textShadow: highlight > 0.5
                      ? `0 0 12px ${color}80, 0 2px 8px rgba(0,0,0,0.8)`
                      : '0 2px 8px rgba(0,0,0,0.8)',
                  }}
                >
                  {word.word}
                </span>
              );
            })}
          </div>
        );
      })}
    </>
  );
};

// Style 3: Word pop — each word springs in individually
const WordPop: React.FC<{
  words: Word[];
  frame: number;
  fps: number;
  width: number;
  fontSize: number;
  color: string;
  yPosition: string;
}> = ({words, frame, fps, width, fontSize, color, yPosition}) => {
  const currentTime = frame / fps;

  // Show 1-2 words at a time with spring animation
  return (
    <>
      {words.map((word, idx) => {
        const wordStart = word.start;
        const wordEnd = word.end;
        const buffer = 0.1;

        if (currentTime < wordStart - buffer || currentTime > wordEnd + buffer) {
          return null;
        }

        const wordStartFrame = Math.floor(wordStart * fps);
        const wordEndFrame = Math.floor(wordEnd * fps);

        // Spring entrance
        const entrance = spring({
          frame: frame - wordStartFrame,
          fps,
          config: {damping: 12, stiffness: 200, mass: 0.8},
        });

        // Fade out at end
        const fadeOut = interpolate(
          frame,
          [wordEndFrame - Math.floor(fps * 0.08), wordEndFrame],
          [1, 0],
          {extrapolateLeft: 'clamp', extrapolateRight: 'clamp'}
        );

        const scale = entrance * fadeOut;
        const opacity = fadeOut;
        const yOffset = (1 - entrance) * 30;

        return (
          <div
            key={idx}
            style={{
              position: 'absolute',
              top: yPosition,
              left: '50%',
              transform: `translate(-50%, calc(-50% + ${yOffset}px)) scale(${scale})`,
              opacity,
              fontSize: fontSize * 1.2,
              fontFamily: 'Arial Black, Impact, sans-serif',
              fontWeight: 900,
              color,
              textAlign: 'center',
              textTransform: 'uppercase',
              WebkitTextStroke: `${Math.max(1, fontSize * 0.04)}px #000`,
              paintOrder: 'stroke fill',
              textShadow: `0 0 20px ${color}60, 0 2px 10px rgba(0,0,0,0.9), 0 4px 20px rgba(0,0,0,0.5)`,
              zIndex: 10,
            }}
          >
            {word.word}
          </div>
        );
      })}
    </>
  );
};

export const CaptionOverlay: React.FC<CaptionOverlayProps> = ({
  sourceVideo,
  words = [],
  style = 'bold_centered',
  fontSize: userFontSize,
  color = '#FFFFFF',
  position = 'bottom',
}) => {
  const frame = useCurrentFrame();
  const {fps, width, height} = useVideoConfig();

  const fontSize = userFontSize || Math.round(width * 0.08);

  const yPosition =
    position === 'top' ? '18%' : position === 'center' ? '50%' : '82%';

  const lines = groupWords(words);

  return (
    <AbsoluteFill>
      {/* Source video background */}
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

      {/* Caption layer */}
      {style === 'bold_centered' && (
        <BoldCentered
          lines={lines}
          frame={frame}
          fps={fps}
          width={width}
          fontSize={fontSize}
          color={color}
          yPosition={yPosition}
        />
      )}
      {style === 'karaoke_highlight' && (
        <KaraokeHighlight
          lines={lines}
          frame={frame}
          fps={fps}
          width={width}
          fontSize={fontSize}
          color={color}
          yPosition={yPosition}
        />
      )}
      {style === 'word_pop' && (
        <WordPop
          words={words}
          frame={frame}
          fps={fps}
          width={width}
          fontSize={fontSize}
          color={color}
          yPosition={yPosition}
        />
      )}
    </AbsoluteFill>
  );
};
