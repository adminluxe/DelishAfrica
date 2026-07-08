export const da = {
  space: { x0:0, x1:4, x2:8, x3:12, x4:16, x5:20, x6:24, x7:32, x8:40 },
  radius: { sm:12, md:16, lg:20, xl:24, pill:999 },
  type: {
    h1:32, h2:24, h3:20,
    body:16, bodySm:14, cap:13,
  },
  line: { tight:1.15, normal:1.35, airy:1.5 },
  motion: { fast:120, base:180, slow:240 },
} as const;

export type DAApp = "client" | "courier" | "merchant";

export const clamp = (n:number, min:number, max:number) => Math.max(min, Math.min(max, n));
