import React from 'react';
import { interpolate, useCurrentFrame } from 'remotion';
import { Caption } from '../../components/Caption';
import { fontFamily } from '../../fonts';
import { tokens } from '../../theme';
import { ClickPulse } from '../components/ClickPulse';
import { MockDashboardChrome } from '../components/MockDashboardChrome';
import { MockPeerRow } from '../components/MockPeerRow';
import { MockPresetForm } from '../components/MockPresetForm';
import { MockTabPanel } from '../components/MockTabPanel';
import { MockToast } from '../components/MockToast';
import { MOCK_PRESET_PEERS, MOCK_SUB } from '../mockData';

// Scene-local timing
const SELECT_MIDSIZE = 62;
const SUBMIT = 132;
const SHEET_OUT = 132;
const PEERS_START = 160;
const TOAST_IN = 390;
const TOAST_OUT = 480;
const STATUS_T1 = 210; // setup_needed → ready
const STATUS_T2 = 450; // ready → polling

export const ApplyPreset: React.FC = () => {
  const frame = useCurrentFrame();

  const entry = interpolate(frame, [0, 15], [0, 1], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
  });

  return (
    <div style={{ position: 'absolute', inset: 0, opacity: entry }}>
      <MockDashboardChrome
        subName={MOCK_SUB}
        activeTab="trust"
        statusTimeline={[
          { at: 0, state: 'setup_needed' },
          { at: STATUS_T1, state: 'ready' },
          { at: STATUS_T2, state: 'polling' },
        ]}
      >
        <MockTabPanel
          title="Trust Graph"
          detail="Add peer subs whose moderation signals should reach this install."
        >
          <div
            style={{
              display: 'flex',
              flexDirection: 'column',
              gap: 18,
            }}
          >
            {/* Input row */}
            <div style={{ display: 'flex', gap: 12 }}>
              <div
                style={{
                  flex: 1,
                  borderRadius: 22,
                  border: `2px solid oklch(0.82 0.035 68)`,
                  background: 'oklch(0.99 0.006 72)',
                  padding: '14px 18px',
                  fontFamily: fontFamily.inter,
                  fontWeight: 700,
                  fontSize: 16,
                  color: 'oklch(0.6 0.02 62)',
                  display: 'flex',
                  alignItems: 'center',
                }}
              >
                modsupport
              </div>
              <div
                style={{
                  borderRadius: 22,
                  background: tokens.accent.amber,
                  color: tokens.text.onDark,
                  padding: '14px 24px',
                  fontFamily: fontFamily.inter,
                  fontWeight: 900,
                  fontSize: 16,
                  display: 'flex',
                  alignItems: 'center',
                  boxShadow: '0 12px 28px rgba(65,45,25,0.18)',
                }}
              >
                Add peer
              </div>
              <div
                style={{
                  borderRadius: 22,
                  background: tokens.bg.walnut,
                  color: tokens.text.onDark,
                  padding: '14px 24px',
                  fontFamily: fontFamily.inter,
                  fontWeight: 900,
                  fontSize: 16,
                  display: 'flex',
                  alignItems: 'center',
                  boxShadow: '0 12px 28px rgba(20,12,6,0.22)',
                }}
              >
                Apply preset
              </div>
            </div>

            {/* Peer rows stagger in 4 frames apart, starting PEERS_START. */}
            <div
              style={{
                display: 'grid',
                gridTemplateColumns: '1fr 1fr',
                gap: 12,
              }}
            >
              {MOCK_PRESET_PEERS.map((peer, i) => (
                <MockPeerRow
                  key={peer}
                  name={peer}
                  enterFrame={PEERS_START + i * 4}
                />
              ))}
            </div>
          </div>
        </MockTabPanel>
      </MockDashboardChrome>

      {/* Preset form sheet. Slides in at frame -18 (already in by 0), out at SHEET_OUT.
          Press feedback fires on the Midsize row at SELECT_MIDSIZE and on the
          bottom "Apply preset" CTA at SUBMIT. */}
      <MockPresetForm
        selected="midsize"
        selectedAt={SELECT_MIDSIZE}
        slideInFrame={-18}
        slideOutFrame={SHEET_OUT}
        selectClickFrame={SELECT_MIDSIZE}
        applyClickFrame={SUBMIT}
      />

      {/* Toast */}
      <MockToast
        message="applied midsize: 10 added, 0 already present"
        tone="success"
        enterFrame={TOAST_IN}
        exitFrame={TOAST_OUT}
      />

      <Caption
        text="choose a starter preset."
        fontSize={78}
        fontWeight={700}
        color={tokens.text.onDark}
        position={{ kind: 'bottom', bottom: 110 }}
        fadeIn={[10, 25]}
        hold={75}
        fadeOut={[130, 145]}
      />
      <Caption
        text="ten peers. editable anytime."
        fontSize={84}
        fontWeight={700}
        color={tokens.text.onDark}
        position={{ kind: 'bottom', bottom: 110 }}
        fadeIn={[150, 165]}
        hold={75}
        fadeOut={[270, 285]}
      />
      <Caption
        text="polling turns on."
        fontSize={84}
        fontWeight={700}
        color={tokens.text.onDark}
        position={{ kind: 'bottom', bottom: 110 }}
        fadeIn={[280, 295]}
        hold={75}
        fadeOut={[390, 405]}
      />
      <Caption
        text="federation active."
        fontSize={84}
        fontWeight={700}
        color={tokens.text.onDark}
        position={{ kind: 'bottom', bottom: 110 }}
        fadeIn={[410, 425]}
        hold={75}
        fadeOut={[495, 510]}
      />

      {/* Click pulses: first on the Midsize row inside the preset sheet,
          then on the bottom "Apply preset" CTA. */}
      <ClickPulse
        at={{ x: 1560, y: 410 }}
        clickAt={SELECT_MIDSIZE}
        targetRadius={70}
      />
      <ClickPulse
        at={{ x: 1560, y: 930 }}
        clickAt={SUBMIT}
        targetRadius={60}
      />
    </div>
  );
};
