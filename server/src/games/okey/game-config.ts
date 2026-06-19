export type PairingMode = "essiz" | "esli";
export type EscalationMode = "katlamasiz" | "katlamali";
export type PenaltyMode = "cezasiz" | "cezali";
export type TargetHands = 7 | 11 | 21;
export type PartnerEscalation = "ese-katlamali" | "ese-katlamasiz";
// Assist mode is presentational/help only (it does not change game rules):
// "destekli" shows auto-lay helpers and marks the okey tiles; "desteksiz" does not.
export type AssistMode = "destekli" | "desteksiz";

export const DEFAULT_OPEN_THRESHOLD = 101;
export const DEFAULT_MIN_PAIRS = 5;
export const DEFAULT_PARTNER_ESCALATION: PartnerEscalation = "ese-katlamali";
export const DEFAULT_ASSIST: AssistMode = "destekli";

export interface OkeyGameConfig {
  pairing: PairingMode;
  escalation: EscalationMode;
  penalty: PenaltyMode;
  targetHands: TargetHands;
  openThreshold: number;
  minPairs: number;
  partnerEscalation: PartnerEscalation;
  assist: AssistMode;
}

export interface OkeyGameConfigInput {
  pairing: PairingMode;
  escalation: EscalationMode;
  penalty: PenaltyMode;
  targetHands: TargetHands;
  openThreshold?: number;
  minPairs?: number;
  partnerEscalation?: PartnerEscalation;
  assist?: AssistMode;
}

export function makeConfig(input: OkeyGameConfigInput): OkeyGameConfig {
  return {
    pairing: input.pairing,
    escalation: input.escalation,
    penalty: input.penalty,
    targetHands: input.targetHands,
    openThreshold: input.openThreshold ?? DEFAULT_OPEN_THRESHOLD,
    minPairs: input.minPairs ?? DEFAULT_MIN_PAIRS,
    partnerEscalation: input.partnerEscalation ?? DEFAULT_PARTNER_ESCALATION,
    assist: input.assist ?? DEFAULT_ASSIST,
  };
}
