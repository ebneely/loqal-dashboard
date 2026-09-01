/**
 * One shop, four states — the shutter's position is the status. error: stuck
 * halfway, straining. denied: down with a padlock. notFound: down with a 404
 * sign swaying. empty: rolled up on bare rails. Decoration beside the words,
 * never instead of them, so it is aria-hidden and safe under reduced motion.
 */

const FRAME = (
  <>
    <path d="M14 32 H106 M18 32 V94 H102 V32" />
    <path d="M12 32 L20 20 H100 L108 32 M32 20 V32 M52 20 V32 M72 20 V32 M92 20 V32" />
  </>
);

const SLATS = "M18 44 H102 M18 52 H102 M18 60 H102 M18 68 H102 M18 76 H102 M18 84 H102";

export function ShutterScene({
  kind,
  playing = false,
}: {
  kind: "error" | "denied" | "notFound" | "empty";
  playing?: boolean;
}) {
  return (
    <svg
      className="lq-sh"
      data-kind={kind}
      data-play={playing || undefined}
      width="168"
      height="138"
      viewBox="0 0 120 100"
      aria-hidden="true"
      focusable="false"
    >
      {kind === "error" ? (
        <g className="lq-sh-l">
          {FRAME}
          <g className="lq-sh-awn">
            <path d="M12 32 L20 20 H100 L108 32" />
          </g>
          <g className="lq-sh-inside">
            <path className="lq-sh-shelf" d="M28 56 H72" pathLength="70" />
            <path className="lq-sh-shelf lq-sh-shelf2" d="M28 70 H64" pathLength="70" />
            <path d="M80 94 V66 H96 V94" className="lq-sh-faint" />
            <circle className="lq-sh-dot" cx="88" cy="76" r="2.2" />
          </g>
          <clipPath id="lq-sh-win">
            <rect x="17" y="33" width="86" height="61" />
          </clipPath>
          <g clipPath="url(#lq-sh-win)">
            <g className="lq-sh-roll">
              <rect className="lq-sh-face" x="18" y="36" width="84" height="58" />
              <path className="lq-sh-faint" d={SLATS} />
              <path className="lq-sh-handle" d="M53 90 H67" />
            </g>
          </g>
        </g>
      ) : null}

      {kind === "denied" ? (
        <g className="lq-sh-l">
          {FRAME}
          <g className="lq-sh-body">
            <rect className="lq-sh-face" x="18" y="36" width="84" height="58" />
            <path className="lq-sh-faint" d="M18 46 H102 M18 56 H102 M18 66 H102 M18 86 H102" />
          </g>
          <g className="lq-sh-lock">
            <rect x="52" y="72" width="16" height="13" rx="2" className="lq-sh-face" />
            <path d="M55 72 v-5 a5 5 0 0 1 10 0 v5" />
            <circle cx="60" cy="78" r="1.6" className="lq-sh-fill" />
          </g>
        </g>
      ) : null}

      {kind === "notFound" ? (
        <g className="lq-sh-l">
          {FRAME}
          <rect className="lq-sh-face" x="18" y="36" width="84" height="58" />
          <path className="lq-sh-faint" d="M18 46 H102 M18 56 H102 M18 66 H102 M18 76 H102 M18 86 H102" />
          <g className="lq-sh-sign">
            <path d="M52 32 V44 M68 32 V44" />
            <rect x="44" y="44" width="32" height="18" className="lq-sh-card" />
            <text x="60" y="57" textAnchor="middle" className="lq-sh-code">
              404
            </text>
          </g>
        </g>
      ) : null}

      {kind === "empty" ? (
        <g className="lq-sh-l">
          {FRAME}
          <rect className="lq-sh-card" x="18" y="33" width="84" height="6" />
          <path className="lq-sh-faint" d="M24 52 H96 M24 72 H96" />
          <g className="lq-sh-lone">
            <path d="M60 52 v3 a3 3 0 1 0 -4 2.4 M60 58 L48 66 H72 Z" />
          </g>
        </g>
      ) : null}
    </svg>
  );
}
