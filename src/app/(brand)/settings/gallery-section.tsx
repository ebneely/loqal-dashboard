"use client";

import { useRef, useState } from "react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { useSession } from "@/lib/auth-client";
import { useMessages } from "@/lib/locale-context";
import { isUploadableType, uploadOne } from "../products/catalog-data";
import { GALLERY_SLOTS, saveGallery, useGallery } from "./gallery-data";

/**
 * The shop's five photo slots. The first is required and is the one the
 * storefront card leads with; the other four are optional and play when a
 * shopper hovers the card.
 *
 * NO HOLES. A slot can only be filled once every slot before it is — the API
 * stores an ordered array, so index 0 IS the main photo, and a gallery with a
 * gap in it has no meaning to store. The empty slots after the next one are
 * shown, numbered and disabled, because they tell the shop how many more it may
 * add.
 *
 * EVERY CHANGE SAVES THE WHOLE SET. Upload, remove and "make main" each end in
 * one PUT of the full ordered list, which is the only write the API offers —
 * so the screen and the storefront can never disagree about the order.
 *
 * OWNER ONLY TO CHANGE, like the logo and cover. An employee sees the photos
 * and is told why the controls are not there, rather than pressing a button
 * that answers 403.
 */
export function GallerySection() {
  const g = useMessages().brand.gallery;
  const { data: session } = useSession();
  const isOwner = session?.user?.role === "BRAND_OWNER";

  const gallery = useGallery();
  const images = gallery.data?.images ?? [];

  const [busySlot, setBusySlot] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);
  const input = useRef<HTMLInputElement>(null);

  const ids = images.map((image) => image.mediaId);

  /** One PUT of the whole ordered list, then the list the server kept. */
  const commit = async (next: readonly string[], slot: number) => {
    setBusySlot(slot);
    setError(null);
    try {
      await saveGallery(next);
      gallery.reload();
    } catch {
      setError(g.failed);
    } finally {
      setBusySlot(null);
    }
  };

  const onFile = async (file: File | undefined) => {
    if (!file) return;
    if (!isUploadableType(file.type)) {
      setError(g.badType);
      return;
    }

    const slot = ids.length;
    setBusySlot(slot);
    setError(null);
    try {
      const { mediaId } = await uploadOne(file);
      await commit([...ids, mediaId], slot);
    } catch {
      setError(g.failed);
      setBusySlot(null);
    }
  };

  return (
    <section aria-label={g.block} data-testid="settings-gallery">
      <Card className="border-border">
        <CardHeader className="gap-1">
          <CardTitle className="text-base">{g.title}</CardTitle>
          <CardDescription>{g.description}</CardDescription>
        </CardHeader>

        <CardContent className="grid gap-4">
          {!isOwner ? (
            <p className="text-sm text-muted-foreground">{g.readOnly}</p>
          ) : null}

          {gallery.isLoading ? (
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-5" aria-hidden="true">
              {Array.from({ length: GALLERY_SLOTS }, (_, i) => (
                <div key={i} className="aspect-[4/5] animate-pulse rounded-md bg-muted" />
              ))}
            </div>
          ) : (
            <ol className="grid grid-cols-2 gap-3 sm:grid-cols-5">
              {Array.from({ length: GALLERY_SLOTS }, (_, slot) => {
                const image = images[slot];
                const isNext = slot === images.length;
                const busy = busySlot === slot;

                return (
                  <li key={slot} className="grid gap-2">
                    <div className="flex items-center justify-between gap-1 text-xs">
                      <span className="font-medium">
                        {slot === 0 ? g.main : `${slot + 1}`}
                      </span>
                      <Badge variant={slot === 0 ? "default" : "outline"}>
                        {slot === 0 ? g.required : g.optional}
                      </Badge>
                    </div>

                    {image ? (
                      <div className="relative aspect-[4/5] overflow-hidden rounded-md border border-border bg-muted">
                        {image.url ? (
                          // eslint-disable-next-line @next/next/no-img-element
                          <img
                            src={image.url}
                            alt=""
                            className="size-full object-cover"
                            loading="lazy"
                          />
                        ) : null}
                      </div>
                    ) : isOwner && isNext ? (
                      /* The ONE control on an empty row of slots. Every other
                         empty slot is a placeholder, not a disabled button: a
                         control that exists only to refuse is noise, and for an
                         employee this repo's rule is that owner controls are
                         absent, never merely disabled. */
                      <button
                        type="button"
                        className="flex aspect-[4/5] items-center justify-center rounded-md border border-dashed border-primary/60 bg-muted/40 p-2 text-center text-xs font-medium text-foreground transition-colors hover:border-primary hover:bg-muted"
                        onClick={() => {
                          if (busySlot === null) input.current?.click();
                        }}
                        aria-busy={busy || undefined}
                      >
                        {busy ? g.uploading : g.add}
                      </button>
                    ) : (
                      <div
                        className="flex aspect-[4/5] items-center justify-center rounded-md border border-dashed border-border bg-muted/20 font-mono text-xs text-muted-foreground"
                        title={isOwner ? g.fillFirst : undefined}
                      >
                        {slot + 1}
                      </div>
                    )}

                    {image && isOwner ? (
                      <div className="flex flex-wrap gap-1">
                        {slot > 0 ? (
                          <Button
                            type="button"
                            size="sm"
                            variant="outline"
                            disabled={busySlot !== null}
                            onClick={() =>
                              void commit(
                                [image.mediaId, ...ids.filter((id) => id !== image.mediaId)],
                                slot
                              )
                            }
                          >
                            {g.makeMain}
                          </Button>
                        ) : null}
                        <Button
                          type="button"
                          size="sm"
                          variant="ghost"
                          disabled={busySlot !== null}
                          onClick={() =>
                            void commit(
                              ids.filter((id) => id !== image.mediaId),
                              slot
                            )
                          }
                        >
                          {busy ? g.uploading : g.remove}
                        </Button>
                      </div>
                    ) : null}
                  </li>
                );
              })}
            </ol>
          )}

          {!gallery.isLoading && images.length === 0 ? (
            <p className="text-sm text-muted-foreground">{g.empty}</p>
          ) : null}

          {error ? (
            <p role="alert" className="text-sm text-destructive">
              {error}
            </p>
          ) : null}

          {/* One hidden picker for every slot: only the next empty slot can
              open it, so the file always lands where the shop pressed. */}
          <input
            ref={input}
            type="file"
            accept="image/jpeg,image/png,image/webp"
            className="sr-only"
            tabIndex={-1}
            aria-hidden="true"
            onChange={(event) => {
              void onFile(event.target.files?.[0]);
              event.target.value = "";
            }}
          />
        </CardContent>
      </Card>
    </section>
  );
}
