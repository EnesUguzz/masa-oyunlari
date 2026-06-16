export type PairingMode = "essiz" | "esli";
export type EscalationMode = "katlamasiz" | "katlamali";
export type PenaltyMode = "cezasiz" | "cezali";
export type TargetHands = 7 | 11 | 21;
export type PartnerEscalation = "ese-katlamali" | "ese-katlamasiz";

export const DEFAULT_OPEN_THRESHOLD = 101;
export const DEFAULT_MIN_PAIRS = 5;
export const DEFAULT_PARTNER_ESCALATION: PartnerEscalation = "ese-katlamali";

export interface OkeyGameConfig {
  pairing: PairingMode;
  escalation: EscalationMode;
  penalty: PenaltyMode;
  targetHands: TargetHands;
  openThreshold: number;
  minPairs: number;
  partnerEscalation: PartnerEscalation;
}

export interface OkeyGameConfigInput {
  pairing: PairingMode;
  escalation: EscalationMode;
  penalty: PenaltyMode;
  targetHands: TargetHands;
  openThreshold?: number;
  minPairs?: number;
  partnerEscalation?: PartnerEscalation;
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
  };
}
