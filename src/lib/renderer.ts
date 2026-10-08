import "server-only";

import path from "node:path";
import { mkdir } from "node:fs/promises";
import type { Project, RenderJob } from "./schema";
import type { ReelFlowVideoProps } from "@/remotion/ReelFlowVideo";
import { AppError } from "./http";

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
    const directory = path.join(process.cwd(), "public", "exports");
    await mkdir(directory, { recursive: true });
    const outputLocation = path.join(directory, `${project.id}.mp4`);
    let lastReported = 0;
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
    const now = new Date().toISOString();
    return { id: project.renderJob?.id ?? project.id, status: "complete", progress: 100, outputUrl: `/exports/${project.id}.mp4`, createdAt: project.renderJob?.createdAt ?? now, updatedAt: now };
  }
}

