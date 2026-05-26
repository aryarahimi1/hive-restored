import React from 'react';
import { tokens } from '../../theme';

/**
 * MockTabPanel — cream panel that holds the active tab's content. Sized
 * to fill the panel-slot area of MockDashboardChrome (1600px wide,
 * remainder of the 960px height after the header).
 */
export const MockTabPanel: React.FC<{
  title: string;
  detail: string;
  children?: React.ReactNode;
  /** override panel opacity for crossfade transitions */
  opacity?: number;
}> = ({ title, detail, children, opacity = 1 }) => {
  return (
    <div
      style={{
        position: 'absolute',
        inset: 0,
        borderRadius: 32,
        border: `2px solid ${tokens.border.warm}`,
        background: tokens.bg.creamBright,
        padding: '28px 32px',
        boxShadow: '0 18px 60px rgba(65,45,25,0.08)',
        opacity,
        display: 'flex',
        flexDirection: 'column',
        gap: 22,
      }}
    >
      <div>
        <h2
          style={{
            margin: 0,
            fontWeight: 900,
            fontSize: 30,
            letterSpacing: '-0.04em',
            color: tokens.text.ink,
          }}
        >
          {title}
        </h2>
        <p
          style={{
            margin: '6px 0 0',
            fontSize: 16,
            lineHeight: 1.4,
            color: tokens.text.muted,
          }}
        >
          {detail}
        </p>
      </div>
      <div style={{ flex: 1, position: 'relative' }}>{children}</div>
    </div>
  );
};
