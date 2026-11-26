import { beforeEach, describe, expect, it, vi } from "vitest";
import html2canvas from "html2canvas";

import { exportMarkdown, exportPdf } from "./exportService";

vi.mock("html2canvas", () => ({ default: vi.fn() }));

const { addImage, addPage, save } = vi.hoisted(() => ({
  addImage: vi.fn(),
  addPage: vi.fn(),
  save: vi.fn(),
}));

vi.mock("jspdf", () => {
  const MockJsPDF = vi.fn(function () {
    return {
      internal: { pageSize: { getWidth: () => 210, getHeight: () => 297 } },
      addImage,
      addPage,
      save,
    };
  });
  return {
    __esModule: true,
    default: MockJsPDF,
  };
});

describe("exportMarkdown", () => {
  it("creates a download link with correct attributes", () => {
    const createElementSpy = vi
      .spyOn(document, "createElement")
      .mockReturnValue(document.createElement("a"));
    const appendChildSpy = vi.spyOn(document.body, "appendChild");
    const removeChildSpy = vi.spyOn(document.body, "removeChild");
    const clickSpy = vi.spyOn(HTMLAnchorElement.prototype, "click").mockImplementation(() => {});
    const revokeObjectURLSpy = vi.spyOn(URL, "revokeObjectURL");

    exportMarkdown("# Hello", "test-doc");

    expect(createElementSpy).toHaveBeenCalledWith("a");
    expect(appendChildSpy).toHaveBeenCalled();
    expect(clickSpy).toHaveBeenCalled();
    expect(removeChildSpy).toHaveBeenCalled();
    expect(revokeObjectURLSpy).toHaveBeenCalled();

    createElementSpy.mockRestore();
    appendChildSpy.mockRestore();
    removeChildSpy.mockRestore();
    clickSpy.mockRestore();
    revokeObjectURLSpy.mockRestore();
  });
});

describe("exportPdf", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(html2canvas).mockImplementation(async (_element, options) => {
      const canvas = document.createElement("canvas");
      canvas.width = options?.width ?? 800;
      canvas.height = options?.height ?? 4000;
      canvas.toDataURL = () => "data:image/png;base64,mock";
      return canvas;
    });
  });

  it("resolves successfully when given an HTML string", async () => {
    const { default: jsPDF } = await import("jspdf");

    await exportPdf({ html: "<h1>Test</h1>", filename: "test-pdf" });

    expect(jsPDF).toHaveBeenCalled();
  });

  it("throws when neither element nor html is provided", async () => {
    await expect(exportPdf({ filename: "test-pdf" })).rejects.toThrow(
      "Either element or html must be provided"
    );
  });

  it("uses provided element directly", async () => {
    const { default: jsPDF } = await import("jspdf");
    const div = document.createElement("div");

    await exportPdf({ element: div, filename: "test-pdf" });

    expect(jsPDF).toHaveBeenCalled();
  });

  it("isolates supplied styles throughout rendering and removes the temporary document on failure", async () => {
    const originalPadding = getComputedStyle(document.body).padding;
    const renderFailure = new Error("render failed");
    vi.mocked(html2canvas).mockImplementationOnce(async (target) => {
      expect(target.textContent).toContain("sample draft");
      expect(getComputedStyle(document.body).padding).toBe(originalPadding);
      throw renderFailure;
    });

    try {
      await expect(
        exportPdf({
          html: "<style>body { padding: 2rem; }</style><p data-pdf-sample>sample draft</p>",
          filename: "draft",
        })
      ).rejects.toBe(renderFailure);
      expect(document.querySelector("[data-pdf-sample]")).toBeNull();
      expect(document.querySelector("iframe")).toBeNull();
      expect(getComputedStyle(document.body).padding).toBe(originalPadding);
    } finally {
      document.querySelector("[data-pdf-sample]")?.parentElement?.remove();
    }
  });

  it("leaves the caller's node in place even when both sources are supplied", async () => {
    const target = document.createElement("p");
    const parent = document.createElement("div");
    document.body.append(parent);
    parent.append(target);

    try {
      await exportPdf({ element: target, html: "<p>different content</p>", filename: "draft" });
      expect(html2canvas).toHaveBeenCalledWith(target, expect.anything());
      expect(parent.contains(target)).toBe(true);
    } finally {
      parent.remove();
    }
  });

  it("captures the complete long document in separate printable pages", async () => {
    const element = document.createElement("div");
    vi.spyOn(element, "getBoundingClientRect").mockReturnValue(new DOMRect(0, 0, 800, 4000));
    await exportPdf({ element, filename: "long-draft" });

    expect(addPage).toHaveBeenCalledTimes(3);
    let coveredHeight = 0;
    for (const [target, options] of vi.mocked(html2canvas).mock.calls) {
      expect(target).toBe(element);
      expect(options?.y).toBe(coveredHeight);
      coveredHeight += options?.height ?? 0;
    }
    expect(coveredHeight).toBe(4000);
    for (const [, , x, y, width, height] of addImage.mock.calls) {
      expect([x, y]).toEqual([10, 10]);
      expect(width).toBeCloseTo(190);
      expect(y + height).toBeLessThanOrEqual(287);
    }
    expect(save).toHaveBeenCalledWith("long-draft.pdf", { returnPromise: true });
  });
});
