import React from 'react';
import { fontFamily } from '../../fonts';
import { tokens } from '../../theme';

/**
 * MockMetricTile — Trusted peers / Active threats / Indexed total /
 * Last poll. Always rendered; value may be a string ("Never") or number.
 */
export const MockMetricTile: React.FC<{
  label: string;
  value: string | number;
  compact?: boolean;
  width?: number;
}> = ({ label, value, compact = false, width }) => {
  return (
    <div
      style={{
        flex: width ? undefined : 1,
        width,
        borderRadius: 24,
        background: tokens.bg.creamBright,
        border: `2px solid ${tokens.border.warm}`,
        padding: '18px 20px',
      }}
    >
      <div
        style={{
          fontFamily: fontFamily.inter,
          fontWeight: 700,
          fontSize: 12,
          letterSpacing: '0.14em',
          textTransform: 'uppercase',
          color: 'oklch(0.5 0.05 58)',
        }}
      >
        {label}
      </div>
      <div
        style={{
          marginTop: 12,
          fontFamily: fontFamily.inter,
          fontWeight: 900,
          fontSize: compact ? 24 : 44,
          lineHeight: 1,
          letterSpacing: '-0.05em',
          color: tokens.text.ink,
          fontVariantNumeric: 'tabular-nums',
        }}
      >
        {value}
      </div>
    </div>
  );
};
