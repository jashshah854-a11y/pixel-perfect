import { useEffect, useRef, useState } from "react";
import { Application } from "pixi.js";

export function useOfficePixiRuntime(containerRef: React.RefObject<HTMLDivElement | null>) {
  const appRef = useRef<Application | null>(null);
  const [app, setApp] = useState<Application | null>(null);

  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;

    const pixiApp = new Application();
    let destroyed = false;
    let canvas: HTMLCanvasElement | null = null;

    pixiApp
      .init({
        background: 0x0a0a0a,
        antialias: true,
        resizeTo: el,
        autoDensity: true,
        resolution: window.devicePixelRatio || 1,
      })
      .then(() => {
        if (destroyed) return;
        canvas = pixiApp.canvas as HTMLCanvasElement;
        el.appendChild(canvas);
        appRef.current = pixiApp;
        setApp(pixiApp);
      });

    return () => {
      destroyed = true;
      // Remove canvas from DOM manually before destroy
      if (canvas && canvas.parentNode) {
        canvas.parentNode.removeChild(canvas);
      }
      if (appRef.current) {
        try {
          // Pass false for removeView since we already removed the canvas
          appRef.current.destroy(true, { children: true });
        } catch {
          // silent — canvas already removed
        }
        appRef.current = null;
      }
      setApp(null);
    };
  }, [containerRef]);

  return app;
}
