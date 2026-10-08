import { AbsoluteFill, Audio, Img, interpolate, Sequence, staticFile, useCurrentFrame, useVideoConfig } from "remotion";
import type { Scene } from "../lib/schema";
import { createCaptionCues } from "../lib/timing";

export type ReelFlowVideoProps = {
  title: string;
  scenes: Scene[];
  voiceUrl?: string;
  musicUrl?: string;
  accent?: string;
};

const asset = (url: string) => url.startsWith("/") ? staticFile(url.slice(1)) : url;

function SceneView({ scene, index }: { scene: Scene; index: number }) {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const duration = Math.round(scene.duration * fps);
  const zoom = interpolate(frame, [0, duration], [1.02, 1.13], { extrapolateRight: "clamp" });
  const opacity = interpolate(frame, [0, 9, duration - 9, duration], [0, 1, 1, 0], { extrapolateLeft: "clamp", extrapolateRight: "clamp" });
  const cues = createCaptionCues(scene, 0, fps);
  const active = cues.find((cue) => frame >= cue.startFrame && frame < cue.endFrame);
  return (
    <AbsoluteFill style={{ background: `linear-gradient(145deg, hsl(${245 + index * 17} 70% 18%), #07070a 68%)`, overflow: "hidden", opacity }}>
      {scene.imageUrl ? <Img src={asset(scene.imageUrl)} style={{ width: "100%", height: "100%", objectFit: "cover", transform: `scale(${zoom})`, filter: "saturate(.9) contrast(1.05)" }} /> : (
        <AbsoluteFill style={{ transform: `scale(${zoom})`, background: `radial-gradient(circle at ${30 + index * 9}% 32%, rgba(142,91,255,.8), transparent 26%), linear-gradient(145deg, #24115a, #08080e 68%)` }} />
      )}
      <AbsoluteFill style={{ background: "linear-gradient(180deg, rgba(0,0,0,.05), rgba(0,0,0,.15) 48%, rgba(0,0,0,.82))" }} />
      <div style={{ position: "absolute", left: 76, right: 76, bottom: 245, textAlign: "center", minHeight: 230, display: "flex", alignItems: "center", justifyContent: "center" }}>
        <span style={{ color: "white", fontFamily: "Arial, sans-serif", fontSize: 82, fontWeight: 900, lineHeight: 1.03, letterSpacing: -3, textShadow: "0 8px 32px rgba(0,0,0,.75)", textTransform: "uppercase" }}>
          {active?.text ?? scene.caption}
        </span>
      </div>
      <div style={{ position: "absolute", left: 72, top: 72, color: "rgba(255,255,255,.78)", fontFamily: "Arial", fontSize: 24, fontWeight: 700, letterSpacing: 5 }}>REELFLOW • {String(index + 1).padStart(2, "0")}</div>
    </AbsoluteFill>
  );
}

export function ReelFlowVideo({ scenes, voiceUrl, musicUrl }: ReelFlowVideoProps) {
  const { fps } = useVideoConfig();
  return (
    <AbsoluteFill style={{ backgroundColor: "#07070a" }}>
      {scenes.map((scene, index) => {
        const from = scenes.slice(0, index).reduce((sum, item) => sum + Math.max(1, Math.round(item.duration * fps)), 0);
        const frames = Math.max(1, Math.round(scene.duration * fps));
        return <Sequence key={scene.id} from={from} durationInFrames={frames}><SceneView scene={scene} index={index} /></Sequence>;
      })}
      {musicUrl ? <Audio src={asset(musicUrl)} volume={0.08} loop /> : null}
      {voiceUrl ? <Audio src={asset(voiceUrl)} volume={1} /> : null}
    </AbsoluteFill>
  );
}
