# Tasarım: Okey 101 Puanlama + Maç + Eşe-katlama (Sub-project Okey-1c)

> Tarih: 2026-06-16
> Kapsam: 1b tur motorunun ürettiği terminal `OkeyGameState`'i **el puanına** çeviren
> saf puanlama; **maç döngüsü** (N el biriktirme + kazanan); ve bir küçük **motor
> uzantısı** (eşe-katlamasız partner-hariç eşik) + **void mantığının kaldırılması**.
> Kanonik kurallar: `docs/okey-101-rules.md`. 1a/1b: `server/src/games/okey/`.

## Amaç

1b motoru tek eli oynatıp `HandOutcome` + terminal state üretiyor. 1c bu state'i
**saf, deterministik** fonksiyonlarla puana çevirir ve maç boyunca biriktirir. Tüm
varyant farkları (eşli/eşsiz, katlamalı/katlamasız, cezalı/cezasız, eşe-katlamalı/
eşe-katlamasız) burada veya 1b config'inde ele alınır. CLAUDE.md: "saf oyun mantığı —
ağdan bağımsız, test edilebilir".

## Kapsam dışı (entegrasyon)

- Sonraki elin dağıtılması (deal), turn-timeout, Socket.IO, oda-config → `OkeyGameConfig`
  üretimi, istemci UI, E2E. `match.ts` yalnız **skor biriktirir** ve maç-sonu/kazananı
  bildirir; yeni eli **başlatmaz** (orkestrasyon entegrasyona aittir).

## Mimari

İki yeni saf modül + 1b motoruna iki küçük değişiklik. Hepsi saf: girdi mutasyona
uğramaz, deterministik.

### Klasör yapısı (1c'nin dokunduğu)

```
server/src/games/okey/
├── game-config.ts   # DEĞİŞİKLİK: + partnerEscalation alanı
├── game-state.ts    # DEĞİŞİKLİK: "void" GameStatus + HandOutcome.isVoid KALDIRILIR
├── outcome.ts       # DEĞİŞİKLİK: buildVoidOutcome KALDIRILIR
├── opening.ts       # DEĞİŞİKLİK: 4-çift void tetiği KALDIRILIR
├── helpers.ts       # DEĞİŞİKLİK: meldThreshold/pairThreshold takım-farkında
├── scoring.ts       # YENİ: scoreHand(state) -> HandScore
├── match.ts         # YENİ: MatchState + createMatch/applyHandScore
└── index.ts         # DEĞİŞİKLİK: scoring + match re-export
```

## Bölüm 1 — Motor değişiklikleri (1b düzeltmeleri)

### 1a. Void mantığının kaldırılması (4-çift iptali yok)

`docs/okey-101-rules.md`: "4 oyuncu çifte giderse el iptal" kuralı **yoktur**.
- `opening.ts` `applyOpenPairs`: dört-çift void tetiği (status="void" + buildVoidOutcome)
  **silinir**. Çifte giden sayısında sınır yok.
- `game-state.ts`: `GameStatus` artık `"playing" | "finished"` (sadece); `HandOutcome.isVoid`
  alanı **silinir**.
- `outcome.ts`: `buildVoidOutcome` **silinir**. `buildExhaustOutcome` ve `buildFinishOutcome`
  kalır.
- `open-pairs.test.ts`: "voids the hand when the fourth player opens pairs" testi **silinir**;
  yerine "dört oyuncu da çifte gidebilir, iptal olmaz" testi eklenir (status hâlâ "playing").

### 1b. Eşe-katlama: partner-hariç eşik

`game-config.ts`:
```ts
export type PartnerEscalation = "ese-katlamali" | "ese-katlamasiz";
// OkeyGameConfig'e eklenir:
//   partnerEscalation: PartnerEscalation;
// makeConfig input'una opsiyonel: partnerEscalation?: PartnerEscalation (vsy "ese-katlamali")
```
Yalnız `escalation === "katlamali" && pairing === "esli" && partnerEscalation === "ese-katlamasiz"`
olduğunda partner açışı eşiği yükseltmez. Diğer tüm hallerde davranış değişmez
(global = "ese-katlamali" gibi).

`helpers.ts` `meldThreshold` / `pairThreshold` **oyunculardan** hesaplanır (cached
`highestOpenScore/highestOpenPairs` yerine — bu alanlar artık türetilir; state'te
kalmaları zararsız ama eşik bunlardan değil players'tan okunur):

```ts
// Aynı takımdaki diğer koltuk (eşli). Eşsizde partner yok (null).
function partnerSeat(s: OkeyGameState, seat: number): number | null {
  if (s.config.pairing !== "esli") return null;
  for (const p of s.players) if (p.seat !== seat && p.team === s.players[seat]!.team) return p.seat;
  return null;
}

export function meldThreshold(s: OkeyGameState): number {
  if (s.config.escalation === "katlamasiz") return s.config.openThreshold;
  const me = s.turn;
  const excludePartner =
    s.config.pairing === "esli" && s.config.partnerEscalation === "ese-katlamasiz";
  const partner = excludePartner ? partnerSeat(s, me) : null;
  let best: number | null = null;
  for (const p of s.players) {
    if (p.seat === me) continue;
    if (partner !== null && p.seat === partner) continue;
    if (p.opened && p.openMode === "melds") best = best === null ? p.openScore : Math.max(best, p.openScore);
  }
  return best === null ? s.config.openThreshold : best + 1;
}

export function pairThreshold(s: OkeyGameState): number {
  if (s.config.escalation === "katlamasiz") return s.config.minPairs;
  const me = s.turn;
  const excludePartner =
    s.config.pairing === "esli" && s.config.partnerEscalation === "ese-katlamasiz";
  const partner = excludePartner ? partnerSeat(s, me) : null;
  let best: number | null = null;
  for (const p of s.players) {
    if (p.seat === me) continue;
    if (partner !== null && p.seat === partner) continue;
    if (p.opened && p.openMode === "pairs") best = best === null ? p.pairCount : Math.max(best, p.pairCount);
  }
  return best === null ? s.config.minPairs : best + 1;
}
```

> Bu, mevcut `highestOpenScore/highestOpenPairs` cache'ine olan bağımlılığı kaldırır;
> eşik daima `players[]`'tan türer. Mevcut katlamalı testleri (global davranış)
> `ese-katlamali` (varsayılan) altında aynen geçer.

## Bölüm 2 — Puanlama (`scoring.ts`)

```ts
export interface HandScore {
  perSeat: number[];                  // 4; her koltuğun bu el cezası (negatif = iyi)
  perTeam: [number, number] | null;   // eşli: [takım0 (koltuk 0,2), takım1 (1,3)]; eşsizde null
}
export function scoreHand(state: OkeyGameState): HandScore;
```

**Önkoşul:** `state.status === "finished"` (bitiş veya deste tükenmesi). Değilse
`InvalidMoveError` (çekirdek) fırlatır.

**Çarpan:** `finishMultiplier(ft: FinishType): number` → `2 ** (sayı of {elden, okey, pairs} true)`.

**Adım 1 — taban per-seat (`base: number[4]`):**
- **Deste tükenmesi** (`outcome.deckExhausted === true`, finisherSeat null):
  `base = [202, 202, 202, 202]`. (Aşağıdaki diğer adımlar atlanır; eşli'de bile herkes 202.)
- **Bitiş** (`outcome.finisherSeat !== null`): `m = finishMultiplier(outcome.finishType!)`.
  - Bitiren koltuk: `-101 * m`.
  - Her diğer oyuncu `p`:
    - `p.opened === false` → `202 * m`.
    - aksi halde → `tilesValue(p.hand) * m`, ARTI `p.hand` bir wildcard içeriyorsa `+101` (sabit).
  - `tilesValue(hand)` = sayılı taşların `tileValue` toplamı; wildcard taşların değeri
    **0** sayılır (wildcard'ın "elde kalma" cezası ayrı +101'dir; taş değeri katkısı 0).
- **Besleme cezaları (yalnız `config.penalty === "cezali"`):** her `outcome.feedingEvents`
  için `base[feederSeat] += tileValue * (takerMode === "melds" ? 10 : 20)`. (Deste-tükenmesinde
  de uygulanır — feedingEvents varsa.)

**Adım 2 — mod toplaması:**
- **Eşsiz** (`config.pairing !== "esli"`): `perSeat = base`, `perTeam = null`.
- **Eşli:** takım üyeleri koltuk paritesi (0&2 = takım0, 1&3 = takım1). Deste-tükenmesinde
  takım kuralı uygulanmaz (herkes 202; `perSeat = base`, `perTeam = [base0+base2, base1+base3]`).
  Bitişte:
  - Bitirenin takımı **kazanan takım**:
    - `m === 1` (normal) → takım değeri **0**.
    - `m > 1` (özel) → takım değeri **−101 · m**.
    - `perSeat[bitiren] = takım değeri`, `perSeat[partner] = 0` (partner cezası bağışlanır;
      partnerin elde-taş/202/elde-okey/besleme cezaları **silinir**).
  - Diğer takım **kaybeden takım**: iki üyenin `base` değerleri korunur (`perSeat = base`).
  - `perTeam = [perSeat0 + perSeat2, perSeat1 + perSeat3]`.

> Eşsiz↔eşli farkı kasıtlı: eşsizde normal bitişte bitiren −101 alır; eşlide normal
> bitişte kazanan takım 0'dır (−101 yalnız özel bitişte). (Kurallar dokümanı böyle.)

## Bölüm 3 — Maç (`match.ts`)

```ts
export interface MatchState {
  config: OkeyGameConfig;
  players: PlayerId[];                 // 4, koltuk sırası
  seatTotals: number[];                // 4 birikmiş ceza
  teamTotals: [number, number] | null; // eşli; eşsizde null
  handsPlayed: number;
  status: "playing" | "finished";
  winner: { kind: "seat"; seat: number } | { kind: "team"; team: 0 | 1 } | null;
}

export function createMatch(config: OkeyGameConfig, players: readonly PlayerId[]): MatchState;
export function applyHandScore(match: MatchState, score: HandScore): MatchState;
```

- `createMatch`: 4 oyuncu (değilse InvalidMoveError); `seatTotals=[0,0,0,0]`,
  `teamTotals = pairing==="esli" ? [0,0] : null`, `handsPlayed=0`, `status="playing"`, `winner=null`.
- `applyHandScore` (saf, yeni MatchState döner): `match.status==="finished"` ise InvalidMoveError.
  - `seatTotals[i] += score.perSeat[i]`.
  - eşli ise `teamTotals[t] += score.perTeam![t]`.
  - `handsPlayed += 1`.
  - `handsPlayed === config.targetHands` → `status="finished"`, `winner` = en düşük toplam
    (eşsiz: en düşük `seatTotals` → `{kind:"seat",seat}`; eşli: en düşük `teamTotals` →
    `{kind:"team",team}`). Beraberlikte en küçük indeks kazanır (deterministik; tiebreak
    1c için yeterli).

## Hata yönetimi

- `scoreHand` ve `applyHandScore` geçersiz girdide çekirdek `InvalidMoveError` fırlatır.
- Yeni hata sınıfı eklenmez.

## Test (Vitest, TDD)

- **engine — void kaldırma:** dört oyuncu da çifte gidebilir → `status` "playing" kalır
  (eski void testi yerine); `GameStatus`/`HandOutcome` artık void içermez (tip + derleme).
- **engine — eşe-katlama:** katlamalı+eşli+eşe-katlamasız: partner 120 açtıysa, rakip
  açmamışsa benim eşiğim 101 (partner sayılmaz); rakip 130 açtıysa eşiğim 131. Eşe-katlamalı:
  partner 120 → eşiğim 121. Katlamasız / eşsiz: davranış değişmez (regresyon testleri geçer).
- **scoring — eşsiz:** normal bitiş (bitiren −101, açık kaybeden elde-taş, açmamış 202);
  m=2 (okey) ve m=4 (elden+okey) ölçekleme; elde-okey +101 (sabit, ×m değil); cezalı besleme
  ×10/×20 doğru koltuğa; deste-tükenmesi herkes 202.
- **scoring — eşli:** normal bitiş kazanan takım 0; özel bitiş −101·m; partner cezası
  bağışlanır; kaybeden takım iki üye toplanır; perTeam doğru.
- **match:** createMatch başlangıcı; applyHandScore birikimi (eşsiz seat, eşli team);
  targetHands'e ulaşınca status="finished" + en düşük kazanan; bitmiş maça applyHandScore
  hatası.

## Tamamlanma kriterleri (DoD)

- `pnpm typecheck`, `pnpm test`, `pnpm lint`, `pnpm build` temiz (124 mevcut + yeni testler;
  silinen void testi hariç).
- Motor void içermez; `scoreHand`/`match` saf; dört varyant kombinasyonu + eşe-katlama
  alt-modu config'le çalışır.
- `server/src/games/okey/` dışında çekirdek değişmez; `shared/`'a oyun-özel tip eklenmez.
