# Change Proposal: enhance-byok-onboarding

## Why
- Users now have a powerful BYOK modal, but onboarding still assumes they know where to find API keys, pricing, and recommended models.
- There is no telemetry or first-run checklist guiding people through dev-start → BYOK → first intervention, so activation can stall.

## What Changes
- Expand the BYOK modal with provider-specific help links, rate estimates, and inline validation (e.g., detecting obviously invalid keys before hitting the backend).
- Add a first-run tour/checklist that walks users through launching the dev stack, opening BYOK settings, pasting a key, and running a Muse/Loki trigger.
- Instrument anonymous telemetry (opt-in) to track BYOK adoption (provider chosen, success/error) so we can prioritize docs/support.
- Update manual testing guides and screenshots to showcase the improved onboarding flow.

## Impact
- Shortens time-to-value for new users, reducing support load.
- Provides data to iterate on provider prioritization and pricing guidance.
- Makes it easier to run workshops/demos with consistent UI cues.
