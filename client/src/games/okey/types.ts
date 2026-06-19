export type OkeyColor = "red" | "yellow" | "black" | "blue";
export interface NumberedTile { kind: "numbered"; color: OkeyColor; value: number; }
export interface FakeJoker { kind: "fakeJoker"; }
export type OkeyTile = NumberedTile | FakeJoker;

export type PairingMode = "essiz" | "esli";
export type EscalationMode = "katlamasiz" | "katlamali";
export type PenaltyMode = "cezasiz" | "cezali";
export type PartnerEscalation = "ese-katlamali" | "ese-katlamasiz";
export type TargetHands = 7 | 11 | 21;
export type AssistMode = "destekli" | "desteksiz";

export interface OkeyConfig {
  pairing: PairingMode;
  escalation: EscalationMode;
  penalty: PenaltyMode;
  partnerEscalation: PartnerEscalation;
  targetHands: TargetHands;
  openThreshold: number;
  minPairs: number;
  assist: AssistMode;
}

export interface TableMeld { id: string; owner: number; kind: "run" | "set" | "pair"; tiles: OkeyTile[]; }
export interface FinishType { elden: boolean; okey: boolean; pairs: boolean; }
export interface HandOutcome {
  finisherSeat: number | null;
  finishType: FinishType | null;
  leftovers: { seat: number; tiles: OkeyTile[] }[];
  feedingEvents: { feederSeat: number; takerSeat: number; tileValue: number; takerMode: "melds" | "pairs" }[];
  deckExhausted: boolean;
}
export interface PublicPlayer {
  seat: number;
  playerId: string;
  team: 0 | 1 | null;
  opened: boolean;
  openMode: "melds" | "pairs" | null;
  pairCount: number;
  handCount: number;
  lastDiscard: OkeyTile | null;
}
export interface OkeyPlayerView {
  config: OkeyConfig;
  indicator: NumberedTile;
  okey: NumberedTile;
  you: number;
  yourHand: OkeyTile[];
  turn: number;
  phase: "draw" | "act";
  drawPileCount: number;
  players: PublicPlayer[];
  tableMelds: TableMeld[];
  status: "playing" | "finished";
  outcome: HandOutcome | null;
}
export type MatchWinner = { kind: "seat"; seat: number } | { kind: "team"; team: 0 | 1 } | null;
export interface MatchStanding {
  seatTotals: number[];
  teamTotals: [number, number] | null;
  handsPlayed: number;
  targetHands: number;
  status: "playing" | "finished";
  winner: MatchWinner;
}
export interface SeatInfo { seat: number; playerId: string; nickname: string; isBot: boolean; }
export interface OkeyTableView {
  view: OkeyPlayerView;
  match: MatchStanding;
  handNumber: number;
  seating: SeatInfo[];
}
export type Move =
  | { kind: "drawFromPile" }
  | { kind: "drawFromDiscard" }
  | { kind: "openMelds"; melds: OkeyTile[][] }
  | { kind: "autoOpen" }
  | { kind: "openPairs"; pairs: OkeyTile[][] }
  | { kind: "openNewMeld"; tiles: OkeyTile[] }
  | { kind: "processToMeld"; meldId: string; tiles: OkeyTile[] }
  | { kind: "discard"; tile: OkeyTile };
export interface StartGameConfig {
  pairing: PairingMode;
  escalation: EscalationMode;
  penalty: PenaltyMode;
  partnerEscalation?: PartnerEscalation;
  targetHands: TargetHands;
  assist?: AssistMode;
}
