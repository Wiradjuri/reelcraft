import { Composition } from "remotion";
import { makeDemoProject } from "../lib/fixtures";
import { totalFrames } from "../lib/timing";
import { ReelFlowVideo, type ReelFlowVideoProps } from "./ReelFlowVideo";

const demo = makeDemoProject();
export const demoProps: ReelFlowVideoProps = { title: demo.topic, scenes: demo.storyboard!.scenes, accent: "#9d7cff" };

export function RemotionRoot() {
  return (
    <Composition
      id="ReelFlow"
      component={ReelFlowVideo}
      width={1080}
      height={1920}
      fps={30}
      durationInFrames={totalFrames(demoProps.scenes)}
      defaultProps={demoProps}
      calculateMetadata={({ props }) => ({ durationInFrames: totalFrames(props.scenes) })}
    />
  );
}
