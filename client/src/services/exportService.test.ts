import { describe, expect, it, vi } from "vitest";

import { exportMarkdown, exportPdf } from "./exportService";

vi.mock("html2canvas", () => ({
  default: vi.fn().mockResolvedValue({
    width: 800,
    height: 600,
    toDataURL: () => "data:image/png;base64,mock",
  }),
}));

vi.mock("jspdf", () => {
  const MockJsPDF = vi.fn(function () {
    return {
      internal: { pageSize: { getWidth: () => 210, getHeight: () => 297 } },
      addImage: vi.fn(),
      save: vi.fn(),
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
    const clickSpy = vi.spyOn(HTMLAnchorElement.prototype, "click");
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
});
