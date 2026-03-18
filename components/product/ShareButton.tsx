"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import type { CSSProperties } from "react";

interface ShareButtonProps {
  readonly productId: string;
  readonly variationId: string | null;
}

type ShareState = "idle" | "loading" | "ready" | "error";

// Panel dimensions used for viewport-aware positioning
const PANEL_WIDTH_PX = 288;
const PANEL_HEIGHT_PX = 140;
const VIEWPORT_MARGIN_PX = 8;

// ─── Icon helpers (pure, no state) ────────────────────────

const ShareIcon = () => (
  <svg
    className="w-5 h-5"
    fill="none"
    stroke="currentColor"
    viewBox="0 0 24 24"
    aria-hidden="true"
  >
    <path
      strokeLinecap="round"
      strokeLinejoin="round"
      strokeWidth={2}
      d="M8.684 13.342C8.886 12.938 9 12.482 9 12c0-.482-.114-.938-.316-1.342m0 2.684a3 3 0 110-2.684m0 2.684l6.632 3.316m-6.632-6l6.632-3.316m0 0a3 3 0 105.367-2.684 3 3 0 00-5.367 2.684zm0 9.316a3 3 0 105.368 2.684 3 3 0 00-5.368-2.684z"
    />
  </svg>
);

const CopyIcon = () => (
  <svg
    className="w-4 h-4"
    fill="none"
    stroke="currentColor"
    viewBox="0 0 24 24"
    aria-hidden="true"
  >
    <path
      strokeLinecap="round"
      strokeLinejoin="round"
      strokeWidth={2}
      d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z"
    />
  </svg>
);

const CheckIcon = () => (
  <svg
    className="w-4 h-4"
    fill="none"
    stroke="currentColor"
    viewBox="0 0 24 24"
    aria-hidden="true"
  >
    <path
      strokeLinecap="round"
      strokeLinejoin="round"
      strokeWidth={2}
      d="M5 13l4 4L19 7"
    />
  </svg>
);

// ─── Share URL panel ──────────────────────────────────────

interface ShareUrlPanelProps {
  readonly shareUrl: string;
  readonly initialCopied: boolean;
  readonly onClose: () => void;
  readonly style: CSSProperties;
}

const ShareUrlPanel = ({
  shareUrl,
  initialCopied,
  onClose,
  style,
}: ShareUrlPanelProps) => {
  const [copied, setCopied] = useState(initialCopied);
  const copyTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Auto-reset "Copied!" badge after 2 s when pre-copied on open
  useEffect(() => {
    if (!initialCopied) return;
    const timer = setTimeout(() => setCopied(false), 2000);
    return () => clearTimeout(timer);
  }, [initialCopied]);

  useEffect(() => {
    return () => {
      if (copyTimeoutRef.current !== null) {
        clearTimeout(copyTimeoutRef.current);
      }
    };
  }, []);

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(shareUrl);
    } catch {
      // Fallback for browsers that block clipboard API
      const input = document.createElement("input");
      input.value = shareUrl;
      document.body.appendChild(input);
      input.select();
      document.execCommand("copy");
      document.body.removeChild(input);
    }
    if (copyTimeoutRef.current !== null) {
      clearTimeout(copyTimeoutRef.current);
    }
    setCopied(true);
    copyTimeoutRef.current = setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div
      style={style}
      className="p-4 bg-[var(--surface)] border border-[var(--border-warm)] rounded-xl shadow-warm"
      role="region"
      aria-label="Share link"
    >
      <div className="flex items-center justify-between mb-2">
        <span className="text-sm font-semibold text-[var(--foreground)]">
          Share this product
        </span>
        <button
          onClick={onClose}
          className="text-[var(--text-muted)] hover:text-[var(--foreground)] transition-colors focus-warm rounded"
          aria-label="Close share panel"
        >
          <svg
            className="w-4 h-4"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
            aria-hidden="true"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M6 18L18 6M6 6l12 12"
            />
          </svg>
        </button>
      </div>
      <div className="flex items-center gap-2">
        <input
          type="text"
          readOnly
          value={shareUrl}
          aria-label="Share URL"
          className="flex-1 min-w-0 px-3 py-2 text-sm bg-[var(--accent-cream)] border border-[var(--border-warm)] rounded-lg text-[var(--foreground)] truncate focus:outline-none focus:ring-2 focus:ring-[var(--accent-warm)]"
        />
        <button
          onClick={handleCopy}
          className="flex-shrink-0 flex items-center gap-1.5 px-3 py-2 bg-[var(--btn-primary)] text-white text-sm font-semibold rounded-lg hover:opacity-90 transition-opacity focus-warm"
          aria-label={copied ? "Copied!" : "Copy link"}
        >
          {copied ? (
            <>
              <CheckIcon />
              Copied!
            </>
          ) : (
            <>
              <CopyIcon />
              Copy
            </>
          )}
        </button>
      </div>
    </div>
  );
};

// ─── Helpers ──────────────────────────────────────────────

const copyTextToClipboard = async (text: string): Promise<void> => {
  try {
    await navigator.clipboard.writeText(text);
  } catch {
    // Fallback for browsers that block the Clipboard API
    const input = document.createElement("input");
    input.value = text;
    document.body.appendChild(input);
    input.select();
    document.execCommand("copy");
    document.body.removeChild(input);
  }
};

const computePanelStyle = (rect: DOMRect): CSSProperties => {
  const vw = window.innerWidth;
  const vh = window.innerHeight;
  const panelWidth = Math.min(PANEL_WIDTH_PX, vw - 2 * VIEWPORT_MARGIN_PX);

  const spaceBelow = vh - rect.bottom;
  const fitsBelow = spaceBelow >= PANEL_HEIGHT_PX + VIEWPORT_MARGIN_PX;

  const style: CSSProperties = {
    position: "fixed",
    zIndex: 50,
    width: panelWidth,
  };

  // Vertical: prefer below, fall back to above
  if (fitsBelow) {
    style.top = rect.bottom + VIEWPORT_MARGIN_PX;
  } else {
    style.bottom = vh - rect.top + VIEWPORT_MARGIN_PX;
  }

  // Horizontal: left-align to button unless it would overflow right edge
  if (rect.left + panelWidth + VIEWPORT_MARGIN_PX <= vw) {
    style.left = rect.left;
  } else {
    style.right = Math.max(VIEWPORT_MARGIN_PX, vw - rect.right);
  }

  return style;
};

// ─── Main component ───────────────────────────────────────

export const ShareButton = ({ productId, variationId }: ShareButtonProps) => {
  const [shareState, setShareState] = useState<ShareState>("idle");
  const [shareUrl, setShareUrl] = useState<string | null>(null);
  const [autoCopied, setAutoCopied] = useState(false);
  const [panelStyle, setPanelStyle] = useState<CSSProperties>({});
  const buttonRef = useRef<HTMLButtonElement>(null);
  const errorTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    return () => {
      if (errorTimeoutRef.current !== null) {
        clearTimeout(errorTimeoutRef.current);
      }
    };
  }, []);

  const scheduleErrorReset = useCallback(() => {
    if (errorTimeoutRef.current !== null) {
      clearTimeout(errorTimeoutRef.current);
    }
    setShareState("error");
    errorTimeoutRef.current = setTimeout(() => setShareState("idle"), 3000);
  }, []);

  const applyShareResponse = useCallback(
    async (data: { success: boolean; data?: { shareUrl: string } }) => {
      if (data.success && data.data) {
        const url = data.data.shareUrl;

        // Compute panel position from current button bounds before state update
        if (buttonRef.current) {
          setPanelStyle(computePanelStyle(buttonRef.current.getBoundingClientRect()));
        }

        // Auto-copy to clipboard immediately
        await copyTextToClipboard(url);
        setAutoCopied(true);
        setShareUrl(url);
        setShareState("ready");
      } else {
        scheduleErrorReset();
      }
    },
    [scheduleErrorReset],
  );

  const handleShare = async () => {
    if (shareState === "ready" && shareUrl) {
      setShareState("idle");
      setShareUrl(null);
      return;
    }

    setShareState("loading");
    if (errorTimeoutRef.current !== null) {
      clearTimeout(errorTimeoutRef.current);
    }

    try {
      const response = await fetch("/api/share", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ productId, variationId }),
      });

      const data = await response.json();
      await applyShareResponse(data);
    } catch {
      scheduleErrorReset();
    }
  };

  const handleClose = () => {
    setShareState("idle");
    setShareUrl(null);
  };

  const isLoading = shareState === "loading";
  const isError = shareState === "error";

  const buttonAriaLabel = isLoading
    ? "Generating share link…"
    : isError
      ? "Failed to share – click to retry"
      : "Share this product";

  const buttonClassName = [
    "flex items-center justify-center p-2.5 border-2 rounded-xl transition-all duration-300 focus-warm disabled:opacity-50 disabled:cursor-not-allowed",
    isError
      ? "border-red-400 bg-red-50 text-red-500 hover:bg-red-100"
      : "border-[var(--border-warm)] hover:border-[var(--accent-rose)] bg-[var(--surface)] hover:bg-[var(--accent-blush)] text-[var(--text-secondary)] hover:text-[var(--accent-rose)]",
  ].join(" ");

  return (
    <>
      <button
        ref={buttonRef}
        onClick={handleShare}
        disabled={isLoading}
        aria-label={buttonAriaLabel}
        aria-expanded={shareState === "ready"}
        className={buttonClassName}
      >
        <ShareIcon />
      </button>

      {shareState === "ready" && shareUrl && (
        <ShareUrlPanel
          shareUrl={shareUrl}
          initialCopied={autoCopied}
          onClose={handleClose}
          style={panelStyle}
        />
      )}
    </>
  );
};
