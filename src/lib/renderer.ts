import "server-only";

import os from "node:os";
import path from "node:path";
import { mkdtemp, readFile, rm } from "node:fs/promises";
import type { Project, RenderJob } from "./schema";
import type { ReelFlowVideoProps } from "@/remotion/ReelFlowVideo";
import { AppError } from "./http";
import { getStorage } from "./storage";

export interface VideoRenderer {
  render(project: Project, onProgress: (progress: number) => Promise<void>): Promise<RenderJob>;
}

let bundled: Promise<string> | undefined;

export class LocalRemotionRenderer implements VideoRenderer {
  async render(project: Project, onProgress: (progress: number) => Promise<void>): Promise<RenderJob> {
    if (!project.storyboard) throw new AppError(400, "MISSING_STORYBOARD", "Generate a storyboard before rendering.");
    const [{ bundle }, { renderMedia, selectComposition }] = await Promise.all([import("@remotion/bundler"), import("@remotion/renderer")]);
    bundled ??= bundle({ entryPoint: path.join(process.cwd(), "src", "remotion", "index.ts"), publicDir: path.join(process.cwd(), "public") });
    const serveUrl = await bundled;
    const voiceUrl = project.assets.find((asset) => asset.kind === "voice" && asset.status === "ready")?.url;
    const musicUrl = project.assets.find((asset) => asset.kind === "music" && asset.status === "ready")?.url;
    const inputProps: ReelFlowVideoProps = { title: project.topic, scenes: project.storyboard.scenes, voiceUrl, musicUrl, accent: "#9d7cff" };
    const composition = await selectComposition({ serveUrl, id: "ReelFlow", inputProps });
    const directory = await mkdtemp(path.join(os.tmpdir(), "reelflow-"));
    const outputLocation = path.join(directory, `${project.id}.mp4`);
    let lastReported = 0;
    try {
      await renderMedia({
        composition,
        serveUrl,
        codec: "h264",
        outputLocation,
        inputProps,
        chromiumOptions: { enableMultiProcessOnLinux: true },
        onProgress: ({ progress }) => {
          const rounded = Math.floor(progress * 100);
          if (rounded >= lastReported + 10) { lastReported = rounded; void onProgress(rounded); }
        },
      });
      const outputUrl = await getStorage().save(`exports/${project.id}.mp4`, await readFile(outputLocation), "video/mp4");
      const now = new Date().toISOString();
      return { id: project.renderJob?.id ?? project.id, status: "complete", progress: 100, outputUrl, createdAt: project.renderJob?.createdAt ?? now, updatedAt: now };
    } finally {
      await rm(directory, { recursive: true, force: true });
    }
  }
}
