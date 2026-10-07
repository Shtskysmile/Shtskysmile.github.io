import { useRef, useState, type ReactNode } from "react";
import { Download, Sparkles, X } from "lucide-react";

interface ImagePreviewProps {
  src: string;
  downloadSrc?: string;
  alt: string;
  filename: string;
  className?: string;
  children: ReactNode;
}

const MIME_EXTENSIONS: Record<string, string> = {
  "image/avif": "avif",
  "image/gif": "gif",
  "image/jpeg": "jpg",
  "image/png": "png",
  "image/svg+xml": "svg",
  "image/webp": "webp",
};

function getFilename(filename: string, blob: Blob, source: string) {
  const mimeType = blob.type.split(";")[0]?.toLowerCase();
  const extension =
    (mimeType && MIME_EXTENSIONS[mimeType]) ??
    new URL(source, window.location.href).pathname.match(/\.([a-z0-9]+)$/i)?.[1]?.toLowerCase() ??
    "jpg";
  const name = filename.replace(/\.[a-z0-9]+$/i, "") || "image";
  return `${name}.${extension}`;
}

export default function ImagePreview({
  src,
  downloadSrc = src,
  alt,
  filename,
  className = "",
  children,
}: ImagePreviewProps) {
  const triggerRef = useRef<HTMLButtonElement>(null);
  const dialogRef = useRef<HTMLDialogElement>(null);
  const imageRef = useRef<HTMLImageElement>(null);
  const [loadingSize, setLoadingSize] = useState<{ width: number; height: number } | null>(null);
  const [loadedSrc, setLoadedSrc] = useState<string | null>(null);
  const [failedSrc, setFailedSrc] = useState<string | null>(null);
  const [downloading, setDownloading] = useState(false);
  const [downloadFailed, setDownloadFailed] = useState(false);
  const imageLoaded = loadedSrc === src;
  const imageFailed = !imageLoaded && failedSrc === src;
  const imageLoading = !imageLoaded && !imageFailed;
  const dialogClassName = imageLoaded
    ? "image-preview-dialog image-preview-dialog-fit fixed inset-0 m-auto max-h-[calc(100dvh-1.5rem)] w-fit max-w-[calc(100vw-1.5rem)] overflow-visible rounded-xl border-0 bg-transparent p-0 shadow-none backdrop:bg-black/80 dark:bg-transparent"
    : "image-preview-dialog image-preview-dialog-loading fixed inset-0 m-auto max-h-[calc(100dvh-2rem)] max-w-[calc(100vw-2rem)] overflow-hidden rounded-xl border-0 bg-stone-950/95 p-0 shadow-none backdrop:bg-black/80";
  const dialogStyle =
    !imageLoaded && loadingSize
      ? { width: `${loadingSize.width}px`, height: `${loadingSize.height}px` }
      : undefined;
  const contentClassName = imageLoaded
    ? "image-preview-content relative max-h-[calc(100dvh-1.5rem)] max-w-[calc(100vw-1.5rem)]"
    : "image-preview-content relative flex h-full w-full items-center justify-center";

  const downloadImage = async () => {
    setDownloading(true);
    setDownloadFailed(false);

    let blob: Blob | undefined;
    let downloadedFrom: string | undefined;
    for (const candidate of new Set([downloadSrc, src])) {
      try {
        const response = await fetch(candidate);
        if (!response.ok) continue;
        blob = await response.blob();
        downloadedFrom = candidate;
        break;
      } catch {
        continue;
      }
    }

    if (!blob || !downloadedFrom) {
      setDownloadFailed(true);
      setDownloading(false);
      return;
    }

    const objectUrl = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = objectUrl;
    link.download = getFilename(filename, blob, downloadedFrom);
    document.body.append(link);
    link.click();
    link.remove();
    window.setTimeout(() => URL.revokeObjectURL(objectUrl), 1000);
    setDownloading(false);
  };

  return (
    <>
      <button
        ref={triggerRef}
        type="button"
        aria-label={`放大预览：${alt}`}
        onClick={() => {
          setDownloadFailed(false);
          if (imageRef.current?.naturalWidth) {
            setLoadedSrc(src);
          } else {
            const bounds = triggerRef.current!.getBoundingClientRect();
            const scale = Math.min(
              1,
              (window.innerWidth - 32) / bounds.width,
              (window.innerHeight - 32) / bounds.height,
            );
            setLoadingSize({ width: bounds.width * scale, height: bounds.height * scale });
          }
          dialogRef.current?.showModal();
        }}
        className={`block w-full cursor-zoom-in border-0 bg-transparent p-0 text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-2 dark:focus-visible:ring-offset-stone-900 ${className}`}
      >
        {children}
      </button>

      <dialog
        ref={dialogRef}
        aria-label={`图片预览：${alt}`}
        onClick={(event) => {
          if (event.target === event.currentTarget) event.currentTarget.close();
        }}
        onCancel={(event) => {
          event.preventDefault();
          event.currentTarget.close();
        }}
        className={dialogClassName}
        style={dialogStyle}
      >
        <div className={contentClassName}>
          <img
            ref={imageRef}
            src={src}
            alt={alt}
            onLoad={() => setLoadedSrc(src)}
            onError={() => setFailedSrc(src)}
            className={
              imageLoaded
                ? "block max-h-[calc(100dvh-1.5rem)] max-w-[calc(100vw-1.5rem)] rounded-xl object-contain shadow-2xl"
                : "absolute h-px w-px opacity-0"
            }
          />
          {imageLoading && (
            <div role="status" aria-live="polite" className="image-preview-prayer">
              <span className="image-preview-prayer-seal" aria-hidden="true">
                <span className="image-preview-prayer-glow" />
                <Sparkles className="image-preview-prayer-icon" size={22} />
              </span>
              <span className="image-preview-prayer-label">少女祈祷中</span>
            </div>
          )}
          {imageFailed && (
            <p role="alert" className="text-sm text-white">
              图片加载失败。
            </p>
          )}
          <button
            type="button"
            aria-label="关闭图片预览"
            onClick={() => dialogRef.current?.close()}
            className="absolute right-3 top-3 rounded-full bg-black/50 p-2 text-white backdrop-blur-sm transition-transform hover:rotate-90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent"
          >
            <X size={18} />
          </button>
          {imageLoaded && (
            <button
              type="button"
              aria-label={downloading ? "正在下载图片" : "下载图片"}
              aria-busy={downloading}
              onClick={downloadImage}
              disabled={downloading}
              className="absolute bottom-3 right-3 inline-flex h-11 w-11 items-center justify-center rounded-full bg-accent text-white shadow-lg transition-transform hover:scale-105 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent active:scale-95 disabled:cursor-wait disabled:opacity-60"
            >
              <Download size={18} />
            </button>
          )}
          {downloadFailed && (
            <span role="status" className="sr-only">
              图片下载失败，请重试。
            </span>
          )}
        </div>
      </dialog>
    </>
  );
}
