import React from 'react';
import { interpolate, useCurrentFrame } from 'remotion';
import { Caption } from '../../components/Caption';
import { tokens } from '../../theme';
import { ClickPulse } from '../components/ClickPulse';
import { MockActionLogEntry } from '../components/MockActionLogEntry';
import { MockDashboardChrome } from '../components/MockDashboardChrome';
import { MockTabPanel } from '../components/MockTabPanel';
import { MockToast } from '../components/MockToast';
import { MOCK_ACTIONS_AFTER_BAN, MOCK_SUB } from '../mockData';

// scene-local
const TAB_CLICK = 72; // → action log
const UNDO_CLICK = 162;
const CONFIRM_CLICK = 242;
const TOAST_IN = 250;
const TOAST_OUT = 340;
const ROW_COLLAPSE = 270;

export const ActionLogUndo: React.FC = () => {
  const frame = useCurrentFrame();

  const entry = interpolate(frame, [0, 15], [0, 1], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
  });

  const threatsOpacity = interpolate(
    frame,
    [TAB_CLICK, TAB_CLICK + 7],
    [1, 0],
    { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' },
  );
  const actionsOpacity = interpolate(
    frame,
    [TAB_CLICK, TAB_CLICK + 7],
    [0, 1],
    { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' },
  );

  return (
    <div style={{ position: 'absolute', inset: 0, opacity: entry }}>
      <MockDashboardChrome
        subName={MOCK_SUB}
        activeTab={frame < TAB_CLICK ? 'threats' : 'actions'}
        status="polling"
      >
        {frame < TAB_CLICK + 7 ? (
          <div style={{ position: 'absolute', inset: 0, opacity: threatsOpacity }}>
            <MockTabPanel
              title="Threat Feed"
              detail="Incoming peer alerts indexed from trusted subreddit wiki feeds."
            />
          </div>
        ) : null}
        {frame >= TAB_CLICK ? (
          <div style={{ position: 'absolute', inset: 0, opacity: actionsOpacity }}>
            <MockTabPanel
              title="Action Log"
              detail="Recent setup and moderation events stored for auditability."
            >
              <div
                style={{
                  display: 'grid',
                  gridTemplateColumns: '1fr 1fr',
                  gap: 12,
                }}
              >
                {MOCK_ACTIONS_AFTER_BAN.map((entry, i) => {
                  const enterAt = i === 0 ? TAB_CLICK + 20 : -120;
                  const isUndoRow = entry.id === 'a3';
                  return (
                    <MockActionLogEntry
                      key={entry.id}
                      title={entry.title}
                      detail={entry.detail}
                      relativeTime={entry.ts}
                      type={entry.type}
                      showUndo={entry.showUndo}
                      enterFrame={enterAt}
                      confirmFrame={isUndoRow ? UNDO_CLICK : undefined}
                      collapseFrame={isUndoRow ? ROW_COLLAPSE : undefined}
                      undoClickFrame={isUndoRow ? UNDO_CLICK : undefined}
                      confirmClickFrame={isUndoRow ? CONFIRM_CLICK : undefined}
                    />
                  );
                })}
              </div>
            </MockTabPanel>
          </div>
        ) : null}
      </MockDashboardChrome>

      <MockToast
        message="removed r/hive_demo_c from your trust graph."
        tone="success"
        enterFrame={TOAST_IN}
        exitFrame={TOAST_OUT}
      />

      <Caption
        text="everything is logged."
        fontSize={84}
        fontWeight={700}
        color={tokens.text.onDark}
        position={{ kind: 'bottom', bottom: 110 }}
        fadeIn={[20, 35]}
        hold={75}
        fadeOut={[140, 155]}
      />
      <Caption
        text="trust changes need a confirm."
        fontSize={78}
        fontWeight={700}
        color={tokens.text.onDark}
        position={{ kind: 'bottom', bottom: 110 }}
        fadeIn={[170, 185]}
        hold={75}
        fadeOut={[290, 305]}
      />
      <Caption
        text="audit trail, mod-readable."
        fontSize={80}
        fontWeight={700}
        color={tokens.text.onDark}
        position={{ kind: 'bottom', bottom: 110 }}
        fadeIn={[300, 315]}
        hold={75}
        fadeOut={[405, 420]}
      />

      {/* Click pulses:
            1. "Action Log" tab pill at TAB_CLICK.
            2. "Undo" button on the most recent ban row at UNDO_CLICK.
            3. "Confirm" button (which has replaced Undo) at CONFIRM_CLICK. */}
      <ClickPulse at={{ x: 710, y: 360 }} clickAt={TAB_CLICK} targetRadius={36} />
      <ClickPulse at={{ x: 1280, y: 760 }} clickAt={UNDO_CLICK} targetRadius={36} />
      <ClickPulse at={{ x: 1280, y: 760 }} clickAt={CONFIRM_CLICK} targetRadius={36} />
    </div>
  );
};
