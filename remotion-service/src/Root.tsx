import React from 'react';
import {Composition} from 'remotion';
import {DynamicRenderer, type DynamicRendererProps} from './compositions/DynamicRenderer';

export const Root: React.FC = () => {
  return (
    <>
      {/* Dynamic composition: evaluates Gemini-generated code at runtime */}
      <Composition
        id="DynamicRenderer"
        component={DynamicRenderer}
        durationInFrames={150}
        fps={30}
        width={1080}
        height={1920}
        defaultProps={{
          transpiledCode: '',
          sourceVideo: '',
          sourceFiles: [],
        } satisfies DynamicRendererProps}
      />
    </>
  );
};
