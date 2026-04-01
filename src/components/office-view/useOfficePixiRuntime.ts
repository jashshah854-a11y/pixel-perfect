import { useEffect, useRef, useState } from "react";
import { Application } from "pixi.js";

export function useOfficePixiRuntime(containerRef: React.RefObject<HTMLDivElement | null>) {
  const appRef = useRef<Application | null>(null);
  const [app, setApp] = useState<Application | null>(null);

  useEffect(() => {
    if (!containerRef.current) return;
    const el = containerRef.current;

    const pixiApp = new Application();
    let destroyed = false;

    pixiApp
      .init({
        background: 0x0a0a0a,
        antialias: true,
        resizeTo: el,
        autoDensity: true,
        resolution: window.devicePixelRatio || 1,
      })
      .then(() => {
        if (destroyed) {
          pixiApp.destroy(true);
          return;
        }
        el.appendChild(pixiApp.canvas as HTMLCanvasElement);
        appRef.current = pixiApp;
        setApp(pixiApp);
      });

    return () => {
      destroyed = true;
      if (appRef.current) {
        appRef.current.destroy(true, { children: true });
        appRef.current = null;
        setApp(null);
      }
    };
  }, [containerRef]);

  return app;
}
