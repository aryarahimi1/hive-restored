import React from 'react';
import { interpolate, useCurrentFrame } from 'remotion';
import { Caption } from '../../components/Caption';
import { tokens } from '../../theme';
import { ClickPulse } from '../components/ClickPulse';
import { MockBadgeModal } from '../components/MockBadgeModal';
import { MockDashboardChrome } from '../components/MockDashboardChrome';
import { MockTabPanel } from '../components/MockTabPanel';
import { MockThreatRow } from '../components/MockThreatRow';
import { MockToast } from '../components/MockToast';
import { MOCK_BANNED_USER, MOCK_SUB, MOCK_THREAT } from '../mockData';

// scene-local
const MODAL_IN = 15;
const PRESS = 242;
const CHECKMARK = 250;
const MODAL_OUT = 280;
const TOAST_IN = 300;
const TOAST_OUT = 390;

export const ModqueueBadge: React.FC = () => {
  const frame = useCurrentFrame();

  const entry = interpolate(frame, [0, 15], [0, 1], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
  });

  // Dashboard brightness drops when modal opens, returns when it closes.
  const dim = interpolate(
    frame,
    [MODAL_IN, MODAL_IN + 12, MODAL_OUT, MODAL_OUT + 24],
    [1, 0.35, 0.35, 1],
    { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' },
  );

  return (
    <div style={{ position: 'absolute', inset: 0, opacity: entry }}>
      {/* Dashboard backing — dims while modal is open */}
      <div style={{ position: 'absolute', inset: 0, filter: `brightness(${dim})` }}>
        <MockDashboardChrome
          subName={MOCK_SUB}
          activeTab="threats"
          status="polling"
        >
          <MockTabPanel
            title="Threat Feed"
            detail="Incoming peer alerts indexed from trusted subreddit wiki feeds."
          >
            <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
              <MockThreatRow
                publisherSub={MOCK_THREAT.publisherSub}
                alertId={MOCK_THREAT.alertId}
                category="Cadence"
                composite={MOCK_THREAT.composite}
                matchedSignal="Cadence"
                publishedAt={MOCK_THREAT.publishedAt}
                ttlAt={MOCK_THREAT.ttlAt}
                enterFrame={-360} /* already rendered */
                expandFrame={-360} /* already expanded */
              />
            </div>
          </MockTabPanel>
        </MockDashboardChrome>
      </div>

      {/* Modal */}
      <MockBadgeModal
        username={MOCK_BANNED_USER}
        composite={87}
        signals={[
          { name: 'Cadence', ok: true },
          { name: 'Domain history', ok: true },
          { name: 'Posting-time entropy', ok: true },
        ]}
        publisher={MOCK_THREAT.publisherSub}
        ttl="14d"
        enterFrame={MODAL_IN}
        exitFrame={MODAL_OUT}
        pressFrame={PRESS}
        checkmarkFrame={CHECKMARK}
      />

      {/* Confirmation toast */}
      <MockToast
        message="banned u/example_alt, published hashed alert."
        tone="success"
        enterFrame={TOAST_IN}
        exitFrame={TOAST_OUT}
      />

      <Caption
        text="badge lands in modqueue."
        fontSize={78}
        fontWeight={700}
        color={tokens.text.onDark}
        position={{ kind: 'bottom', bottom: 110 }}
        fadeIn={[20, 35]}
        hold={75}
        fadeOut={[140, 155]}
      />
      <Caption
        text="three signals crossed the threshold."
        fontSize={78}
        fontWeight={700}
        color={tokens.text.onDark}
        position={{ kind: 'bottom', bottom: 110 }}
        fadeIn={[160, 175]}
        hold={75}
        fadeOut={[280, 295]}
      />
      <Caption
        text="ban publishes a hashed alert."
        fontSize={78}
        fontWeight={700}
        color={tokens.text.onDark}
        position={{ kind: 'bottom', bottom: 110 }}
        fadeIn={[290, 305]}
        hold={75}
        fadeOut={[405, 420]}
      />

      {/* Click pulse on the "Ban + publish" CTA at the bottom-right of the
          badge modal. The MockBadgeModal also gets its own pressFrame so
          the button itself compresses + the checkmark draws over it. */}
      <ClickPulse at={{ x: 1180, y: 760 }} clickAt={PRESS} targetRadius={56} />
    </div>
  );
};
