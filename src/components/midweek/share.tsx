"use client";

import { useEffect, useState, useSyncExternalStore } from "react";
import type { ShareImage } from "@/lib/midweek/share";
import {
  loadShareAssets,
  releaseShareAssets,
  renderShareImage,
  reportShareFailure,
} from "@/lib/midweek/share-draw";
import { Block } from "@/components/ui/block";
import { FOCUS } from "@/components/ui/page";

/** A coarse pointer: share on a phone, download elsewhere (by capability, not width). */
const COARSE = "(pointer: coarse)";
function subscribeCoarse(onChange: () => void) {
  const query = window.matchMedia(COARSE);
  query.addEventListener("change", onChange);
  return () => query.removeEventListener("change", onChange);
}

type Drawn = { blob: Blob; url: string } | "failed" | null;
type Done = "shared" | "downloaded" | "failed" | null;

function download(url: string, fileName: string) {
  const link = document.createElement("a");
  link.href = url;
  link.download = fileName;
  document.body.append(link);
  link.click();
  link.remove();
}

function ShareItem({ image, phone, title }: { image: ShareImage; phone: boolean; title: string }) {
  const [attempt, setAttempt] = useState(0);
  const [result, setResult] = useState<{ image: ShareImage; attempt: number; drawn: Drawn } | null>(
    null,
  );
  const [done, setDone] = useState<Done>(null);
  const [sharing, setSharing] = useState(false);
  const drawn = result?.image === image && result.attempt === attempt ? result.drawn : null;
  const ready = drawn !== null && drawn !== "failed";

  useEffect(() => {
    const controller = new AbortController();
    let url: string | undefined;
    (async () => {
      let assets;
      try {
        assets = await loadShareAssets([image], controller.signal);
        const blob = await renderShareImage(image, assets, controller.signal);
        if (controller.signal.aborted) return;
        url = URL.createObjectURL(blob);
        setResult({ image, attempt, drawn: { blob, url } });
      } catch (error) {
        if (!controller.signal.aborted) {
          if (!assets) reportShareFailure("fonts", image.kind, error);
          setResult({ image, attempt, drawn: "failed" });
        }
      } finally {
        if (assets) releaseShareAssets(assets);
      }
    })();
    return () => {
      controller.abort();
      if (url) URL.revokeObjectURL(url);
    };
  }, [image, attempt]);

  function retry() {
    setDone(null);
    setAttempt((value) => value + 1);
  }

  async function share() {
    if (!ready || sharing) return;
    setDone(null);
    setSharing(true);
    try {
      const file = new File([drawn.blob], image.fileName, { type: "image/png" });
      if (typeof navigator.share === "function" && navigator.canShare?.({ files: [file] })) {
        await navigator.share({ files: [file], title: image.top.replace(" · ", ", ") });
        setDone("shared");
      } else {
        download(drawn.url, image.fileName);
        setDone("downloaded");
      }
    } catch (error) {
      // Closing the share sheet isn't a failure.
      if ((error as DOMException)?.name !== "AbortError") {
        reportShareFailure("share", image.kind, error);
        setDone("failed");
      }
    } finally {
      setSharing(false);
    }
  }

  function save() {
    if (!ready) return;
    try {
      download(drawn.url, image.fileName);
      setDone("downloaded");
    } catch (error) {
      reportShareFailure("download", image.kind, error);
      setDone("failed");
    }
  }

  const preview = (
    <div className="grid aspect-[4/5] w-full overflow-hidden rounded-lg border border-line/60 bg-board-deep">
      {ready ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img alt={`Preview: ${title}`} className="h-full w-full object-contain" src={drawn.url} />
      ) : (
        <span className="self-center justify-self-center px-2 text-center text-label text-ink-faint">
          {drawn === "failed" ? "No preview" : "Drawing…"}
        </span>
      )}
    </div>
  );
  const button = `inline-flex min-h-11 w-full items-center justify-center gap-2 rounded-xl border border-line bg-panel px-3 text-small font-semibold whitespace-nowrap text-ink hover:border-brass-line disabled:opacity-50 ${FOCUS}`;

  return (
    <li className="row-span-4 grid min-w-0 grid-rows-subgrid gap-y-2 rounded-xl bg-panel-2/80 p-2.5">
      {preview}
      <p className="text-small font-semibold [overflow-wrap:anywhere]">{title}</p>
      {/* One height for both sets of buttons, so the page doesn't move when
            hydration finds a coarse pointer and swaps Download for Share. */}
      <div className="grid min-h-[100px] content-start gap-2">
        {phone ? (
          <>
            <button className={button} disabled={!ready || sharing} onClick={share} type="button">
              <span aria-hidden="true">⇪</span> {sharing ? "Sharing…" : "Share"}
            </button>
            <button className={button} disabled={!ready} onClick={save} type="button">
              Save image
            </button>
          </>
        ) : (
          <button className={button} disabled={!ready} onClick={save} type="button">
            <span aria-hidden="true">↓</span> {done === "downloaded" ? "Downloaded" : "Download"}
          </button>
        )}
        {drawn === "failed" && (
          <button className={button} onClick={retry} type="button">
            Retry
          </button>
        )}
      </div>
      <p aria-live="polite" className="text-small text-pretty [overflow-wrap:anywhere]">
        {done === "shared" && <span className="text-moss">Shared.</span>}
        {done === "downloaded" && (
          <span className="text-moss">
            ✓ {image.fileName} is in your downloads. Drop it into the group chat.
          </span>
        )}
        {done === "failed" || drawn === "failed" ? (
          <span className="text-brick" role="alert">
            {drawn === "failed"
              ? "Couldn’t make the image. Try again."
              : "Couldn’t send the image. Try again or save it."}
          </span>
        ) : null}
      </p>
    </li>
  );
}

/**
 * `MidweekShare` (DR3 HANDOFF §3, ADR-120, DR5-14): `Share the night`, with
 * the champion poster and, for a member who entered, "my night", side by side
 * with no note under them (pre-decided cut). Both are drawn
 * on a canvas in the browser from data the page already has, as previews on
 * mount; a tap shares or saves the same PNG. Phones (a coarse pointer that can
 * share files) get the system share sheet, everything else a download.
 */
export function MidweekShare({
  poster,
  night,
}: {
  poster: ShareImage | null;
  night: ShareImage | null;
}) {
  const images = [poster, night].filter((image): image is ShareImage => image !== null);
  const phone = useSyncExternalStore(
    subscribeCoarse,
    () => window.matchMedia(COARSE).matches,
    () => false,
  );

  if (images.length === 0) return null;
  return (
    <div className="scroll-mt-6" id="share">
      <Block id="share-h" title="Share the night">
        {/* A subgrid, so both images' rows line up whatever their words. */}
        <ul className="grid grid-cols-2 grid-rows-[repeat(4,auto)] gap-x-3 gap-y-2 sm:grid-cols-[repeat(2,minmax(0,200px))]">
          {images.map((image) => (
            <ShareItem
              image={image}
              key={image.fileName}
              phone={phone}
              title={image.kind === "poster" ? "The champion poster" : "Your night"}
            />
          ))}
        </ul>
      </Block>
    </div>
  );
}
