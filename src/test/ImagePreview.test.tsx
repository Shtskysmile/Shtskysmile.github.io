import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import ImagePreview from "@/components/ImagePreview";

const originalShowModal = Object.getOwnPropertyDescriptor(HTMLDialogElement.prototype, "showModal");
const originalClose = Object.getOwnPropertyDescriptor(HTMLDialogElement.prototype, "close");
const originalCreateObjectURL = Object.getOwnPropertyDescriptor(URL, "createObjectURL");
const originalRevokeObjectURL = Object.getOwnPropertyDescriptor(URL, "revokeObjectURL");

function restoreProperty(target: object, property: string, descriptor?: PropertyDescriptor) {
  if (descriptor) Object.defineProperty(target, property, descriptor);
  else Reflect.deleteProperty(target, property);
}

function renderPreview(downloadSrc = "/article-cover.png") {
  return render(
    <ImagePreview
      src="/article-cover.webp"
      downloadSrc={downloadSrc}
      alt="文章封面"
      filename="article-cover"
    >
      <img src="/article-cover.webp" alt="" />
    </ImagePreview>,
  );
}

function openLoadedPreview() {
  fireEvent.click(screen.getByRole("button", { name: "放大预览：文章封面" }));
  const dialog = screen.getByRole("dialog", { name: "图片预览：文章封面" });
  fireEvent.load(dialog.querySelector("img")!);
  return dialog;
}

describe("ImagePreview", () => {
  beforeEach(() => {
    Object.defineProperty(HTMLDialogElement.prototype, "showModal", {
      configurable: true,
      value(this: HTMLDialogElement) {
        this.setAttribute("open", "");
      },
    });
    Object.defineProperty(HTMLDialogElement.prototype, "close", {
      configurable: true,
      value(this: HTMLDialogElement) {
        this.removeAttribute("open");
      },
    });
    Object.defineProperty(URL, "createObjectURL", {
      configurable: true,
      value: vi.fn(() => "blob:download"),
    });
    Object.defineProperty(URL, "revokeObjectURL", {
      configurable: true,
      value: vi.fn(),
    });
    vi.stubGlobal("fetch", vi.fn());
  });

  afterEach(() => {
    restoreProperty(HTMLDialogElement.prototype, "showModal", originalShowModal);
    restoreProperty(HTMLDialogElement.prototype, "close", originalClose);
    restoreProperty(URL, "createObjectURL", originalCreateObjectURL);
    restoreProperty(URL, "revokeObjectURL", originalRevokeObjectURL);
    vi.unstubAllGlobals();
  });

  it("shows the prayer loader until the image finishes loading", () => {
    renderPreview();

    fireEvent.click(screen.getByRole("button", { name: "放大预览：文章封面" }));

    const dialog = screen.getByRole("dialog", { name: "图片预览：文章封面" });
    expect(dialog).toHaveClass("image-preview-dialog-loading");
    expect(screen.getByRole("status")).toHaveTextContent("少女祈祷中");

    fireEvent.load(dialog.querySelector("img")!);

    expect(dialog).toHaveClass("image-preview-dialog-fit");
    expect(screen.queryByRole("status")).not.toBeInTheDocument();
    expect(dialog.textContent?.trim()).toBe("");
    expect(dialog.querySelector("img")).toHaveAttribute("src", "/article-cover.webp");
    expect(dialog.querySelector("img")).toHaveAttribute("alt", "文章封面");
    expect(screen.getByRole("button", { name: "下载图片" }).textContent).toBe("");
  });

  it("keeps the prayer loader within the image area", () => {
    const { container } = renderPreview();
    const trigger = screen.getByRole("button", { name: "放大预览：文章封面" });
    vi.spyOn(trigger, "getBoundingClientRect").mockReturnValue({
      x: 0,
      y: 0,
      width: 320,
      height: 180,
      top: 0,
      right: 320,
      bottom: 180,
      left: 0,
      toJSON: () => ({}),
    } as DOMRect);

    fireEvent.click(trigger);

    const dialog = container.querySelector("dialog")!;
    expect(dialog).toHaveClass("image-preview-dialog-loading");
    expect(dialog.style.width).toBe("320px");
    expect(dialog.style.height).toBe("180px");
  });

  it("ends loading when the image fails", () => {
    renderPreview();

    fireEvent.click(screen.getByRole("button", { name: "放大预览：文章封面" }));
    const dialog = screen.getByRole("dialog", { name: "图片预览：文章封面" });
    fireEvent.error(dialog.querySelector("img")!);

    expect(screen.getByRole("alert")).toHaveTextContent("图片加载失败");
    expect(screen.queryByRole("status")).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "下载图片" })).not.toBeInTheDocument();
  });

  it("closes with the close button, Escape, or a backdrop click", () => {
    const { container } = renderPreview();
    const trigger = screen.getByRole("button", { name: "放大预览：文章封面" });

    fireEvent.click(trigger);
    fireEvent.click(screen.getByRole("button", { name: "关闭图片预览" }));
    expect(container.querySelector("dialog")).not.toHaveAttribute("open");

    fireEvent.click(trigger);
    fireEvent(container.querySelector("dialog")!, new Event("cancel", { cancelable: true }));
    expect(container.querySelector("dialog")).not.toHaveAttribute("open");

    fireEvent.click(trigger);
    fireEvent.click(container.querySelector("dialog")!);
    expect(container.querySelector("dialog")).not.toHaveAttribute("open");
  });

  it("downloads the original source using its image MIME type", async () => {
    const fetchMock = vi.mocked(fetch);
    fetchMock.mockResolvedValue({
      ok: true,
      blob: async () => new Blob(["image"], { type: "image/png" }),
    } as Response);
    const downloads: Array<{ href: string; filename: string }> = [];
    vi.spyOn(HTMLAnchorElement.prototype, "click").mockImplementation(function (
      this: HTMLAnchorElement,
    ) {
      downloads.push({ href: this.href, filename: this.download });
    });
    renderPreview();

    openLoadedPreview();
    fireEvent.click(screen.getByRole("button", { name: "下载图片" }));

    await waitFor(() =>
      expect(downloads).toEqual([{ href: "blob:download", filename: "article-cover.png" }]),
    );
    expect(fetchMock).toHaveBeenCalledWith("/article-cover.png");
  });

  it("falls back to the displayed image when the original source cannot be fetched", async () => {
    const fetchMock = vi.mocked(fetch);
    fetchMock.mockRejectedValueOnce(new TypeError("CORS blocked")).mockResolvedValueOnce({
      ok: true,
      blob: async () => new Blob(["image"], { type: "image/webp" }),
    } as Response);
    const downloads: string[] = [];
    vi.spyOn(HTMLAnchorElement.prototype, "click").mockImplementation(function (
      this: HTMLAnchorElement,
    ) {
      downloads.push(this.download);
    });
    renderPreview();

    openLoadedPreview();
    fireEvent.click(screen.getByRole("button", { name: "下载图片" }));

    await waitFor(() => expect(downloads).toEqual(["article-cover.webp"]));
    expect(fetchMock).toHaveBeenNthCalledWith(1, "/article-cover.png");
    expect(fetchMock).toHaveBeenNthCalledWith(2, "/article-cover.webp");
    expect(screen.queryByRole("alert")).not.toBeInTheDocument();
  });

  it("announces download failure without adding visible text", async () => {
    vi.mocked(fetch).mockRejectedValue(new TypeError("CORS blocked"));
    renderPreview();

    openLoadedPreview();
    fireEvent.click(screen.getByRole("button", { name: "下载图片" }));

    expect(await screen.findByRole("status")).toHaveTextContent("图片下载失败，请重试。");
    expect(screen.queryByRole("link")).not.toBeInTheDocument();
  });
});
