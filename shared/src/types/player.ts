// Branded id so a raw string can't be passed where a PlayerId is expected.
export type PlayerId = string & { readonly __brand: "PlayerId" };

export interface Player {
  id: PlayerId;
  nickname: string;
  isBot?: boolean;
}
