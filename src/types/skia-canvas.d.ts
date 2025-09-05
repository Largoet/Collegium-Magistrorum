// src/types/skia-canvas.d.ts
declare module 'skia-canvas' {
  export class Canvas {
    constructor(width: number, height: number);
    getContext(type: '2d'): any;
    get png(): Promise<Uint8Array>;
  }
  export function loadImage(src: string | Buffer): Promise<any>;
}
