#!/usr/bin/env node
/**
 * Thinkfy Lottie pilot pack generator.
 *
 * Authors four brand micro-animations as Bodymovin JSON (Skottie-compatible,
 * per .agents/skills/text-to-lottie/SKILL.md):
 *   streak-flame       — seamless idle flicker loop
 *   chest-open         — quest reward chest opening (one-shot)
 *   success-check      — circle pop + check draw (one-shot)
 *   score-celebration  — star + ring + confetti burst (one-shot)
 *
 * Outputs:
 *   tmp/lottie-player/previews/<name>.json   (player variant: bg layer + slots)
 *   apps/web/public/lottie/<name>.json       (app variant: transparent, no slots)
 */
import { writeFileSync, mkdirSync } from "node:fs";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const PREVIEW_DIR = resolve(ROOT, "tmp/lottie-player/previews");
const APP_DIR = resolve(ROOT, "apps/web/public/lottie");
mkdirSync(PREVIEW_DIR, { recursive: true });
mkdirSync(APP_DIR, { recursive: true });

// Brand palette, normalized RGBA.
const C = {
  aqua: [0, 0.722, 0.851, 1],
  aquaDeep: [0.027, 0.533, 0.627, 1],
  orange: [1, 0.624, 0.271, 1],
  orangeDeep: [0.91, 0.45, 0.12, 1],
  gold: [1, 0.82, 0.4, 1],
  green: [0.204, 0.78, 0.349, 1],
  white: [1, 1, 1, 1],
  ink: [0.063, 0.161, 0.212, 1],
  coral: [1, 0.353, 0.373, 1],
};

const W = 512;
const H = 512;
const CX = W / 2;
const CY = H / 2;

// --- keyframe helpers -------------------------------------------------------

const EASE_SMOOTH = { i: { x: [0.4], y: [1] }, o: { x: [0.4], y: [0] } };
const EASE_OUT = { i: { x: [0.2], y: [1] }, o: { x: [0.6], y: [0] } };
const EASE_IN = { i: { x: [0.8], y: [1] }, o: { x: [0.4], y: [0] } };

function kf(t, value, ease = EASE_SMOOTH) {
  return { t, s: Array.isArray(value) ? value : [value], ...ease };
}
function lastKf(t, value) {
  return { t, s: Array.isArray(value) ? value : [value] };
}
function animated(keys) {
  return { a: 1, k: keys };
}
function val(value) {
  return { a: 0, k: value };
}

function transform({ p = [0, 0], a = [0, 0], s = [100, 100], r = 0, o = 100 } = {}) {
  return {
    ty: "tr",
    p: typeof p.a === "number" ? p : val(p),
    a: typeof a.a === "number" ? a : val(a),
    s: typeof s.a === "number" ? s : val(s),
    r: typeof r === "object" ? r : val(r),
    o: typeof o === "object" ? o : val(o),
  };
}

function group(name, items, tr = transform()) {
  return { ty: "gr", nm: name, it: [...items, tr] };
}

function fill(color, opacity = 100) {
  return {
    ty: "fl",
    c: typeof color.sid === "string" ? color : val(color),
    o: typeof opacity === "object" ? opacity : val(opacity),
  };
}

function stroke(color, width, opacity = 100) {
  return {
    ty: "st",
    c: val(color),
    w: typeof width === "object" ? width : val(width),
    o: typeof opacity === "object" ? opacity : val(opacity),
    lc: 2, // round cap
    lj: 2, // round join
  };
}

function ellipse(p, s) {
  return { ty: "el", p: val(p), s: val(s) };
}

function rect(p, s, r = 0) {
  return { ty: "rc", p: val(p), s: val(s), r: val(r) };
}

function path(verts, inTan, outTan, closed = true) {
  return {
    ty: "sh",
    ks: val({ c: closed, v: verts, i: inTan, o: outTan }),
  };
}

function layer(name, shapes, { ip = 0, op, ks = {} } = {}) {
  return {
    ty: 4,
    nm: name,
    ip,
    op,
    st: 0,
    ks: {
      o: ks.o ?? val(100),
      r: ks.r ?? val(0),
      p: ks.p ?? val([CX, CY, 0]),
      a: ks.a ?? val([0, 0, 0]),
      s: ks.s ?? val([100, 100, 100]),
    },
    shapes,
  };
}

function doc(op, layers, { slots = {}, name } = {}) {
  return {
    v: "5.7.0",
    nm: name,
    fr: 60,
    ip: 0,
    op,
    w: W,
    h: H,
    assets: [],
    ...(Object.keys(slots).length ? { slots } : {}),
    layers,
  };
}

function bgLayer(op) {
  return {
    ty: 4,
    nm: "background",
    ip: 0,
    op,
    st: 0,
    ks: {
      o: val(100),
      r: val(0),
      p: val([CX, CY, 0]),
      a: val([0, 0, 0]),
      s: val([100, 100, 100]),
    },
    shapes: [
      group("bg", [rect([0, 0], [W, H], 0), fill({ sid: "bgColor" })]),
    ],
  };
}

/** Player variant gets a slotted background; the app variant stays transparent. */
function emit(name, op, layers) {
  const appDoc = doc(op, layers, { name: `thinkfy-${name}` });
  writeFileSync(resolve(APP_DIR, `${name}.json`), JSON.stringify(appDoc));

  const playerDoc = doc(op, [...layers, bgLayer(op)], {
    name: `thinkfy-${name}`,
    slots: { bgColor: { p: val([0.953, 0.988, 0.996, 1]) } }, // ice #F3FCFE
  });
  writeFileSync(resolve(PREVIEW_DIR, `${name}.json`), JSON.stringify(playerDoc));
  console.log(`✓ ${name} (op=${op}, layers=${layers.length})`);
}

// ============================================================================
// 1. STREAK FLAME — seamless 90f idle flicker loop
// ============================================================================
{
  const OP = 90;

  // Teardrop flame path centered on (0,0): sharp tip up, round belly.
  // Tip tangents are zero so the point stays crisp (no notch).
  const flamePath = (k) =>
    path(
      [
        [0, -148 * k], // tip
        [66 * k, 4 * k], // right bulge
        [0, 92 * k], // bottom
        [-66 * k, 4 * k], // left bulge
      ],
      [
        [0, 0], // in tangents
        [16 * k, -58 * k],
        [40 * k, 0],
        [-8 * k, 42 * k],
      ],
      [
        [0, 0], // out tangents
        [-8 * k, 42 * k],
        [-40 * k, 0],
        [16 * k, 58 * k],
      ]
    );

  const outerFlicker = transform({
    s: animated([
      kf(0, [100, 100]),
      kf(22, [104, 96]),
      kf(45, [97, 104]),
      kf(68, [103, 98]),
      lastKf(90, [100, 100]),
    ]),
    r: animated([
      kf(0, -2),
      kf(30, 2.5),
      kf(60, -1),
      lastKf(90, -2),
    ]),
    a: { a: 0, k: [0, 60] },
    p: { a: 0, k: [0, 60] },
  });

  const innerFlicker = transform({
    s: animated([
      kf(0, [100, 100]),
      kf(18, [95, 106]),
      kf(40, [105, 95]),
      kf(66, [97, 103]),
      lastKf(90, [100, 100]),
    ]),
    p: animated([
      kf(0, [0, 26]),
      kf(34, [4, 20]),
      kf(64, [-4, 24]),
      lastKf(90, [0, 26]),
    ]),
    a: { a: 0, k: [0, 0] },
  });

  function ember(name, from, to, t0, t1) {
    const mid = (t0 + t1) / 2;
    return layer(
      name,
      [group(name, [ellipse([0, 0], [16, 16]), fill(C.gold)])],
      {
        op: OP,
        ks: {
          p: animated([
            kf(t0, [CX + from[0], CY + from[1], 0], EASE_OUT),
            lastKf(t1, [CX + to[0], CY + to[1], 0]),
          ]),
          o: animated([
            kf(t0, 0),
            kf(t0 + 8, 90),
            kf(mid, 70),
            lastKf(t1, 0),
          ]),
          s: animated([kf(t0, [100, 100, 100]), lastKf(t1, [40, 40, 100])]),
        },
      }
    );
  }

  emit("streak-flame", OP, [
    ember("ember-a", [44, 30], [62, -150], 0, 44),
    ember("ember-b", [-38, 50], [-58, -130], 38, 88),
    layer(
      "flame-inner",
      [group("inner", [flamePath(0.5), fill(C.gold)], innerFlicker)],
      { op: OP, ks: { p: val([CX, CY + 6, 0]) } }
    ),
    layer(
      "flame-outer",
      [group("outer", [flamePath(1), fill(C.orange)], outerFlicker)],
      { op: OP, ks: { p: val([CX, CY - 10, 0]) } }
    ),
  ]);
}

// ============================================================================
// 2. CHEST OPEN — one-shot reward moment, 75f
// ============================================================================
{
  const OP = 75;

  // Lid: anchored at its back-bottom hinge so rotation swings it open.
  const lid = layer(
    "lid",
    [
      group("lid", [
        rect([0, -24], [164, 58], 18),
        fill(C.aqua),
      ]),
      group("lid-band", [
        rect([0, -10], [164, 14], 4),
        fill(C.aquaDeep),
      ]),
    ],
    {
      op: OP,
      ks: {
        a: val([-82, 4, 0]), // hinge at back-left of the lid
        p: val([CX - 82, CY + 6, 0]),
        r: animated([
          kf(0, 0),
          kf(10, 0),
          kf(16, 7, EASE_IN), // anticipation press
          kf(32, -118, EASE_OUT), // fling open w/ overshoot
          kf(42, -104),
          lastKf(50, -110),
        ]),
      },
    }
  );

  const base = layer(
    "base",
    [
      group("body", [rect([0, 38], [150, 80], 16), fill(C.aqua)]),
      group("body-band", [rect([0, 38], [150, 16], 5), fill(C.aquaDeep)]),
      group("lock", [rect([0, 30], [26, 30], 8), fill(C.gold)]),
    ],
    {
      op: OP,
      ks: {
        a: val([0, 78, 0]),
        p: val([CX, CY + 78, 0]),
        s: animated([
          kf(0, [100, 100, 100]),
          kf(10, [100, 100, 100]),
          kf(16, [108, 90, 100], EASE_IN), // squash
          kf(26, [96, 108, 100], EASE_OUT), // stretch
          kf(36, [102, 97, 100]),
          lastKf(46, [100, 100, 100]),
        ]),
      },
    }
  );

  const burst = layer(
    "light-burst",
    [group("burst", [ellipse([0, 0], [120, 120]), fill(C.gold)])],
    {
      op: OP,
      ks: {
        p: val([CX, CY - 10, 0]),
        s: animated([
          kf(16, [0, 0, 100]),
          kf(34, [240, 240, 100], EASE_OUT),
          lastKf(52, [300, 300, 100]),
        ]),
        o: animated([kf(16, 0), kf(22, 70), kf(34, 35), lastKf(52, 0)]),
      },
    }
  );

  // Pop items: two orbs + a gold star arcing out of the chest.
  function star(size, color) {
    return group("star", [
      {
        ty: "sr",
        sy: 1, // star
        pt: val(5),
        p: val([0, 0]),
        r: val(0),
        ir: val(size * 0.45),
        or: val(size),
        is: val(0),
        os: val(0),
      },
      fill(color),
    ]);
  }

  function popItem(name, shapeGroup, dest, t0, spin) {
    const t1 = t0 + 22;
    return layer(name, [shapeGroup], {
      op: OP,
      ks: {
        p: animated([
          kf(t0, [CX, CY - 4, 0], EASE_OUT),
          kf(t1, [CX + dest[0], CY + dest[1], 0]),
          lastKf(t1 + 14, [CX + dest[0], CY + dest[1] + 26, 0]),
        ]),
        s: animated([
          kf(t0, [0, 0, 100], EASE_OUT),
          kf(t0 + 10, [118, 118, 100]),
          lastKf(t0 + 18, [100, 100, 100]),
        ]),
        r: animated([kf(t0, 0), lastKf(t1 + 14, spin)]),
        o: animated([kf(t0, 100), kf(t1 + 4, 100), lastKf(OP - 4, 0)]),
      },
    });
  }

  emit("chest-open", OP, [
    popItem("pop-star", star(26, C.gold), [-96, -120], 20, -160),
    popItem("pop-orb-a", group("orb", [ellipse([0, 0], [30, 30]), fill(C.aqua)]), [6, -160], 23, 120),
    popItem("pop-orb-b", group("orb", [ellipse([0, 0], [22, 22]), fill(C.gold)]), [98, -104], 26, 200),
    lid,
    burst,
    base,
  ]);
}

// ============================================================================
// 3. SUCCESS CHECK — circle pop + trim-path draw, 60f
// ============================================================================
{
  const OP = 60;

  const circle = layer(
    "circle",
    [group("circle", [ellipse([0, 0], [240, 240]), fill(C.green)])],
    {
      op: OP,
      ks: {
        s: animated([
          kf(0, [0, 0, 100], EASE_OUT),
          kf(12, [114, 114, 100]),
          kf(20, [97, 97, 100]),
          lastKf(28, [100, 100, 100]),
        ]),
        o: animated([kf(0, 0), lastKf(8, 100)]),
      },
    }
  );

  const check = layer(
    "check",
    [
      group("check", [
        path(
          [
            [-58, 4],
            [-14, 46],
            [62, -42],
          ],
          [
            [0, 0],
            [0, 0],
            [0, 0],
          ],
          [
            [0, 0],
            [0, 0],
            [0, 0],
          ],
          false
        ),
        {
          ty: "tm", // trim path: draws the check stroke
          s: val(0),
          e: animated([kf(14, 0, EASE_SMOOTH), lastKf(34, 100)]),
          o: val(0),
          m: 1,
        },
        stroke(C.white, 26),
      ]),
    ],
    { op: OP }
  );

  // Six celebration dots radiating outward.
  const dots = Array.from({ length: 6 }, (_, i) => {
    const angle = (i * 60 + 15) * (Math.PI / 180);
    const from = [Math.cos(angle) * 120, Math.sin(angle) * 120];
    const to = [Math.cos(angle) * 185, Math.sin(angle) * 185];
    const color = i % 2 === 0 ? C.gold : C.aqua;
    return layer(
      `dot-${i}`,
      [group("dot", [ellipse([0, 0], [18, 18]), fill(color)])],
      {
        op: OP,
        ks: {
          p: animated([
            kf(26, [CX + from[0], CY + from[1], 0], EASE_OUT),
            lastKf(46, [CX + to[0], CY + to[1], 0]),
          ]),
          o: animated([kf(26, 0), kf(30, 100), lastKf(48, 0)]),
          s: animated([kf(26, [100, 100, 100]), lastKf(48, [30, 30, 100])]),
        },
      }
    );
  });

  emit("success-check", OP, [...dots, check, circle]);
}

// ============================================================================
// 4. SCORE CELEBRATION — star + ring pulse + confetti, 90f
// ============================================================================
{
  const OP = 90;

  const star = layer(
    "star",
    [
      group("star", [
        {
          ty: "sr",
          sy: 1,
          pt: val(5),
          p: val([0, 0]),
          r: val(0),
          ir: val(52),
          or: val(112),
          is: val(0),
          os: val(0),
        },
        fill(C.gold),
      ]),
    ],
    {
      op: OP,
      ks: {
        s: animated([
          kf(0, [0, 0, 100], EASE_OUT),
          kf(14, [122, 122, 100]),
          kf(24, [96, 96, 100]),
          lastKf(32, [100, 100, 100]),
        ]),
        r: animated([kf(0, -40, EASE_OUT), lastKf(24, 0)]),
        o: animated([kf(0, 0), lastKf(6, 100)]),
      },
    }
  );

  const ring = layer(
    "ring-pulse",
    [group("ring", [ellipse([0, 0], [220, 220]), stroke(C.aqua, 14)])],
    {
      op: OP,
      ks: {
        s: animated([kf(4, [36, 36, 100], EASE_OUT), lastKf(42, [185, 185, 100])]),
        o: animated([kf(4, 0), kf(10, 75), lastKf(42, 0)]),
      },
    }
  );

  // Deterministic confetti: 12 pieces, ballistic arcs, brand colors.
  const palette = [C.aqua, C.gold, C.orange, C.coral, C.aquaDeep];
  const confetti = Array.from({ length: 12 }, (_, i) => {
    const angle = (i * 30 - 90) * (Math.PI / 180);
    const reach = 150 + (i % 4) * 28;
    const apex = [Math.cos(angle) * reach, Math.sin(angle) * reach - 36];
    const settle = [apex[0] * 1.18, apex[1] + 96];
    const t0 = 6 + (i % 3) * 3;
    const isRect = i % 2 === 0;
    const color = palette[i % palette.length];
    const shape = isRect
      ? group("piece", [rect([0, 0], [13, 22], 4), fill(color)])
      : group("piece", [ellipse([0, 0], [15, 15]), fill(color)]);

    return layer(`confetti-${i}`, [shape], {
      op: OP,
      ks: {
        p: animated([
          kf(t0, [CX, CY, 0], EASE_OUT),
          kf(t0 + 22, [CX + apex[0], CY + apex[1], 0]),
          lastKf(t0 + 56, [CX + settle[0], CY + settle[1], 0]),
        ]),
        r: animated([kf(t0, 0), lastKf(t0 + 56, i % 2 === 0 ? 420 : -380)]),
        s: animated([
          kf(t0, [0, 0, 100], EASE_OUT),
          kf(t0 + 8, [110, 110, 100]),
          lastKf(t0 + 16, [100, 100, 100]),
        ]),
        o: animated([kf(t0, 100), kf(t0 + 44, 100), lastKf(t0 + 60, 0)]),
      },
    });
  });

  emit("score-celebration", OP, [...confetti, star, ring]);
}

console.log("Done.");
