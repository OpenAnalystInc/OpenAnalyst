import React from "react";

type Props = {
  width?: number;
  height?: number;
  className?: string;
} & React.SVGProps<SVGSVGElement>;

export default function Logo({
  width = 300,
  height = 120,
  className,
  ...rest
}: Props) {
  // —— precise geometry (outer = bigger, inner = smaller) ——
  const MID_Y = 73;
  const CENTER = 300;

  const TH_OUTER = 3;     // outer bracket thickness
  const TH_INNER = 2;     // inner bracket thickness

  const H_OUTER = 80;     // outer bracket height (bigger)
  const H_INNER = 60;     // inner bracket height (smaller)

  const OUTER_HALF = 42;  // distance from center to outer verticals
  const INNER_HALF = 34;  // distance from center to inner verticals

  const TOP_OUTER = MID_Y - H_OUTER / 2;
  const TOP_INNER = MID_Y - H_INNER / 2;
  const BOT_OUTER = TOP_OUTER + H_OUTER - TH_OUTER;
  const BOT_INNER = TOP_INNER + H_INNER - TH_INNER;

  const BAR_OUTER = 26;   // horizontal bar length (outer)
  const BAR_INNER = 18;   // horizontal bar length (inner)

  const WORD_GAP = 3;     // space between words and outer bracket
  const TRACK = "0.08em"; // letter spacing for OPEN / NALYST

  // x-positions
  const L_OUTER = CENTER - OUTER_HALF;
  const L_INNER = CENTER - INNER_HALF;
  const R_INNER = CENTER + INNER_HALF;
  const R_OUTER = CENTER + OUTER_HALF;

  return (
    <svg
      width={width}
      height={height}
      viewBox="0 0 600 120"
      xmlns="http://www.w3.org/2000/svg"
      className={className}
      {...rest}
    >
      <defs>
        <style>{`
          @import url('https://fonts.googleapis.com/css2?family=League+Spartan:wght@700&display=swap');
          .ls { font-family: 'League Spartan', system-ui, -apple-system, Segoe UI, Roboto, Helvetica, Arial, sans-serif; font-weight: 700; }
        `}</style>
      </defs>

      {/* OPEN (tight to outer left bracket) */}
      <text
        x={L_OUTER - WORD_GAP}
        y={MID_Y}
        className="ls"
        fontSize="40"
        textAnchor="end"
        dominantBaseline="middle"
        fill="white"
        style={{ letterSpacing: TRACK }}
      >
        OPEN
      </text>

      {/* LEFT: big outer [ */}
      <g fill="white" stroke="none" shapeRendering="crispEdges">
        <rect x={L_OUTER} y={TOP_OUTER} width={TH_OUTER} height={H_OUTER} />
        <rect x={L_OUTER} y={TOP_OUTER} width={BAR_OUTER} height={TH_OUTER} />
        <rect x={L_OUTER} y={BOT_OUTER} width={BAR_OUTER} height={TH_OUTER} />
      </g>
      {/* LEFT: small inner [ */}
      <g fill="white" stroke="none" shapeRendering="crispEdges">
        <rect x={L_INNER} y={TOP_INNER} width={TH_INNER} height={H_INNER} />
        <rect x={L_INNER} y={TOP_INNER} width={BAR_INNER} height={TH_INNER} />
        <rect x={L_INNER} y={BOT_INNER} width={BAR_INNER} height={TH_INNER} />
      </g>

      {/* RIGHT: small inner ] */}
      <g fill="white" stroke="none" shapeRendering="crispEdges">
        <rect x={R_INNER} y={TOP_INNER} width={TH_INNER} height={H_INNER} />
        <rect x={R_INNER - BAR_INNER} y={TOP_INNER} width={BAR_INNER} height={TH_INNER} />
        <rect x={R_INNER - BAR_INNER} y={BOT_INNER} width={BAR_INNER} height={TH_INNER} />
      </g>
      {/* RIGHT: big outer ] */}
      <g fill="white" stroke="none" shapeRendering="crispEdges">
        <rect x={R_OUTER} y={TOP_OUTER} width={TH_OUTER} height={H_OUTER} />
        <rect x={R_OUTER - BAR_OUTER} y={TOP_OUTER} width={BAR_OUTER} height={TH_OUTER} />
        <rect x={R_OUTER - BAR_OUTER} y={BOT_OUTER} width={BAR_OUTER} height={TH_OUTER} />
      </g>

      {/* Center A */}
      <text
        x={CENTER}
        y={MID_Y}
        className="ls"
        fontSize="50"
        textAnchor="middle"
        dominantBaseline="middle"
        fill="white"
      >
        A
      </text>

      {/* NALYST (tight to outer right bracket) */}
      <text
        x={R_OUTER + TH_OUTER + WORD_GAP}
        y={MID_Y}
        className="ls"
        fontSize="40"
        textAnchor="start"
        dominantBaseline="middle"
        fill="white"
        style={{ letterSpacing: TRACK }}
      >
        NALYST
      </text>
    </svg>
  );
}
