import { Composition } from 'remotion';
import { HiveDemo } from './HiveDemo';
import { HiveProductDemo } from './HiveProductDemo';

export const Root: React.FC = () => {
  return (
    <>
      {/* Existing teaser — 86.5s at 30fps. */}
      <Composition
        id="HiveDemo"
        component={HiveDemo}
        durationInFrames={2595}
        fps={30}
        width={1920}
        height={1080}
      />

      {/* Product walkthrough — 110.0s at 30fps. */}
      <Composition
        id="HiveProductDemo"
        component={HiveProductDemo}
        durationInFrames={3300}
        fps={30}
        width={1920}
        height={1080}
      />
    </>
  );
};
