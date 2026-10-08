import { describe, expect, it } from "vitest";
import { createProject, deleteProject, getProject, updateProject } from "./repository";
import { demoInput } from "./fixtures";

const TEST_USER = "test-user";

describe.sequential("project repository", () => {
  it("creates, updates, reloads, and deletes a project", async () => {
    const created = await createProject({ ...demoInput, topic: "Repository behaviour test" }, TEST_USER);
    expect(created.status).toBe("draft");
    const updated = await updateProject(created.id, { tone: "Direct and concise" }, TEST_USER);
    expect(updated?.tone).toBe("Direct and concise");
    expect((await getProject(created.id, TEST_USER))?.topic).toBe("Repository behaviour test");
    expect(await deleteProject(created.id, TEST_USER)).toBe(true);
    expect(await getProject(created.id, TEST_USER)).toBeUndefined();
  });
});

