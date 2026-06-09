import React from 'react';
import type { PromoSlideData } from './types';

interface Props {
  data: PromoSlideData;
  /** true = compact preview in studio; false = full-screen kiosk render */
  preview?: boolean;
}

export function PromoSlideRenderer({ data, preview = false }: Props) {
  const scale = preview ? 0.35 : 1;

  const root: React.CSSProperties = {
    width: '1920px',
    height: '1080px',
    transform: `scale(${scale})`,
    transformOrigin: 'top left',
    background: 'linear-gradient(135deg, #0f0c29, #302b63, #24243e)',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    fontFamily: "'Segoe UI', system-ui, -apple-system, sans-serif",
    color: '#fff',
    position: 'relative',
    overflow: 'hidden',
  };

  const bg: React.CSSProperties = data.image
    ? {
        position: 'absolute',
        inset: 0,
        backgroundImage: `url(${data.image})`,
        backgroundSize: 'cover',
        backgroundPosition: 'center',
        opacity: 0.25,
      }
    : {};

  const content: React.CSSProperties = {
    position: 'relative',
    zIndex: 1,
    textAlign: 'center',
    maxWidth: '1400px',
    padding: '0 60px',
  };

  const h1: React.CSSProperties = {
    fontSize: '120px',
    fontWeight: 800,
    lineHeight: 1.05,
    margin: 0,
    letterSpacing: '-0.03em',
    textShadow: '0 4px 40px rgba(0,0,0,0.6)',
  };

  const sub: React.CSSProperties = {
    fontSize: '52px',
    fontWeight: 300,
    margin: '32px 0 0',
    opacity: 0.85,
    lineHeight: 1.3,
  };

  return (
    <div style={root}>
      {data.image && <div style={bg} />}
      <div style={content}>
        <h1 style={h1}>{data.headline || 'Your Headline Here'}</h1>
        {data.subheadline && <p style={sub}>{data.subheadline}</p>}
      </div>
    </div>
  );
}
