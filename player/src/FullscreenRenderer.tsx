import React, { useEffect, useRef, useState } from 'react';

interface Props {
  data:     Record<string, unknown>;
  Renderer: React.ComponentType<{ data: Record<string, unknown> }>;
}

/**
 * Scales any 1920×1080 renderer to fill the viewport while preserving aspect
 * ratio — exactly how a Raspberry Pi kiosk would behave.
 */
export function FullscreenRenderer({ data, Renderer }: Props) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [scale, setScale] = useState(1);

  useEffect(() => {
    function recalc() {
      if (!containerRef.current) return;
      const { width, height } = containerRef.current.getBoundingClientRect();
      setScale(Math.min(width / 1920, height / 1080));
    }

    recalc();
    const ro = new ResizeObserver(recalc);
    if (containerRef.current) ro.observe(containerRef.current);
    return () => ro.disconnect();
  }, []);

  return (
    <div
      ref={containerRef}
      style={{
        width: '100%', height: '100%',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        background: '#000',
      }}
    >
      <div style={{ transform: `scale(${scale})`, transformOrigin: 'center center' }}>
        <Renderer data={data} />
      </div>
    </div>
  );
}
