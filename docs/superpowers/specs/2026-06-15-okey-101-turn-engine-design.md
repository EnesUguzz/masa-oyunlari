# Tasarım: Okey 101 Tur Motoru (Sub-project Okey-1b)

> Tarih: 2026-06-15
> Kapsam: Okey 101'in **saf, ağ-bağımsız tur motoru** — tek bir eli baştan bitişe
> oynatan değişmez (immutable) state makinesi. Tüm varyant mekaniği (katlamalı/katlamasız,
> eşli/eşsiz, cezalı/cezasız) config ile. **Puan/ceza aritmetiği 1c'ye aittir.**
> Kanonik kurallar: `docs/okey-101-rules.md`. 1a primitifleri: `server/src/games/okey/`.

## Amaç

1a saf primitiflerinin (tile/okey/deck/deal/meld/pairs/points) üstüne, Okey 101'in
**tur akışını** kuran bir motor: çek → (aç / işle) → at döngüsü, sunucu-otoritesi hamle
doğrulama, bitiş tespiti, besleme/iptal olaylarının kaydı ve per-player view. Motor
**tek bir eli** oynatır ve sonunda yapısal bir `HandOutcome` üretir; **maç döngüsü
(N el) ve puanlama 1c'dedir** (birkaç ceza sayısı henüz doğrulanmadı, bkz. kurallar).

CLAUDE.md uygulaması: "saf oyun mantığı — ağdan bağımsız, birim test edilebilir",
"sunucu otoritesi", "per-player view (`toPlayerView`) zorunlu", "RNG enjekte edilebilir".

## Mimari

**Yaklaşım: saf reducer / değişmez state makinesi.** `applyMove(state, move) → state`
saf fonksiyonu; girdiyi mutasyona uğratmaz, yeni state döner. RNG yalnız `setup`'ta
(deal/shuffle) kullanılır; oyun ilerlemesi deterministiktir. Bilgi gizliliği `view`
katmanında izole edilir. Çekirdeğin `Rng` arayüzünü kullanır; turn-timeout çekirdek
`TurnTimer`'a dışarıdan bağlanır (motor saf kalır).

### Klasör yapısı (1b'nin eklediği)

```
server/src/games/okey/
├── (1a: tile, okey, deck, deal, meld, pairs, points, index)
├── game-config.ts   # OkeyGameConfig + mod tipleri + varsayılanlar
├── game-state.ts    # OkeyGameState, PlayerHandState, TableMeld, HandOutcome (tip)
├── errors.ts        # okey'e özel hata sınıfları (core AppError'dan türer)
├── setup.ts         # createHand(config, players, rng) -> başlangıç state
├── move.ts          # Move birleşik tipi
├── apply.ts         # applyMove(state, move) -> state (dağıtıcı + doğrulama)
├── opening.ts       # açış doğrulama (melds/pairs, eşik, eskalasyon, gösterge +1, void)
├── outcome.ts       # bitiş tespiti, finishType bayrakları, HandOutcome montajı
└── view.ts          # toOkeyPlayerView(state, seat) -> OkeyPlayerView
```

Barrel (`index.ts`) bu yeni modülleri de re-export eder.

## Bölüm 1 — Config ve State

```ts
// game-config.ts
export type PairingMode = "essiz" | "esli";
export type EscalationMode = "katlamasiz" | "katlamali";
export type PenaltyMode = "cezasiz" | "cezali";

export interface OkeyGameConfig {
  pairing: PairingMode;
  escalation: EscalationMode;
  penalty: PenaltyMode;
  targetHands: 7 | 11 | 21;   // maç uzunluğu — 1c kullanır, 1b'de taşınır
  openThreshold: number;       // varsayılan 101
  minPairs: number;            // varsayılan 5
}
export const DEFAULT_CONFIG: Omit<OkeyGameConfig, "pairing" | "escalation" | "penalty" | "targetHands">;
// = { openThreshold: 101, minPairs: 5 }
```

```ts
// game-state.ts
export interface TableMeld {
  id: string;                  // setup/açışta üretilen kısa kimlik
  owner: number;               // açan koltuk
  kind: "run" | "set" | "pair";
  tiles: OkeyTile[];
}

export interface PlayerHandState {
  seat: number;                // 0..3
  playerId: PlayerId;
  team: 0 | 1 | null;          // yalnız eşli; eşsizde null
  hand: OkeyTile[];           // GİZLİ — view'da sadece sahibine
  opened: boolean;
  openMode: "melds" | "pairs" | null;   // mod kilidi
  openScore: number;           // açışta yatırılan toplam puan (eskalasyon/skor)
  pairCount: number;           // çift modunda açılan çift sayısı
  openedOnTurn: number | null; // hangi turda açtı (elden-bitiş tespiti)
}

export interface FinishType { elden: boolean; okey: boolean; pairs: boolean; }

export interface FeedingEvent {
  feederSeat: number;          // taşı atan
  takerSeat: number;           // yerden alıp açan
  tileValue: number;           // beslenen taşın değeri
  takerMode: "melds" | "pairs";
}

export interface HandOutcome {
  finisherSeat: number | null;       // null = void ya da deste tükendi
  finishType: FinishType | null;
  leftovers: { seat: number; tiles: OkeyTile[] }[];   // skor için elde kalanlar
  feedingEvents: FeedingEvent[];     // cezalı modda 1c puanlar
  isVoid: boolean;                   // 4-çift iptali
  deckExhausted: boolean;            // deste bitti, bitiren yok
}

export interface OkeyGameState {
  config: OkeyGameConfig;
  indicator: NumberedTile;
  okey: NumberedTile;
  players: PlayerHandState[];        // 4
  drawPile: OkeyTile[];              // sunucu sırasını görür
  discards: OkeyTile[][];            // koltuk başına yığın; son eleman = üst
  tableMelds: TableMeld[];
  turn: number;                      // sıradaki koltuk
  turnSeq: number;                   // global tur sayacı (her tur ilerleyince +1); elden tespiti
  phase: "draw" | "act";
  pendingFloorTile: OkeyTile | null; // bu tur kullanılmak zorunda olan yerden-alınan taş
  highestOpenScore: number | null;   // katlamalı seri eskalasyonu
  highestOpenPairs: number | null;   // katlamalı çift eskalasyonu
  status: "playing" | "finished" | "void";
  outcome: HandOutcome | null;
}
```

**`setup.ts`:** `createHand(config, players: {id}[4], rng) -> OkeyGameState`. 1a
`buildDeck() → shuffle(rng) → deal()` zinciriyle başlangıç. `okey = determineOkey(indicator)`.
`players[0]` 22 taşlı (başlayan), turn=0, phase="draw". Eşli'de team ataması: koltuk
0&2 → takım 0, 1&3 → takım 1 (karşılıklı). `discards` = 4 boş dizi; `tableMelds` = [].
Tüm sayaçlar null/0. Saf değildir (RNG kullanır) ama RNG enjekte; SeededRng ile deterministik.

## Bölüm 2 — Hamleler ve faz makinesi

```ts
// move.ts
export type Move =
  | { kind: "drawFromPile" }
  | { kind: "drawFromDiscard" }                        // önceki koltuğun son attığını al
  | { kind: "openMelds"; melds: OkeyTile[][] }         // ilk açış: puanlı perler
  | { kind: "openPairs"; pairs: OkeyTile[][] }         // ilk açış: çiftler
  | { kind: "openNewMeld"; tiles: OkeyTile[] }         // açıktan sonra kendi yeni peri/çifti
  | { kind: "processToMeld"; meldId: string; tiles: OkeyTile[] }  // masadaki bir pere işleme
  | { kind: "discard"; tile: OkeyTile };               // at; eli bitirebilir
```

**Faz makinesi** (her hamle `applyMove`'da doğrulanır; yanlış faz → `WrongPhaseError`):

- **phase = "draw"** (sıradaki oyuncu bir taş almalı):
  - `drawFromPile`: `drawPile`'ın üstündeki taş → ele; `phase="act"`.
    Deste boşsa hamle yerine **el biter** (bkz. deste tükenmesi).
  - `drawFromDiscard`: **önceki koltuğun** (`(turn+3)%4`) discard yığınının üstündeki
    taş → ele; `pendingFloorTile` = o taş; `phase="act"`.
    **Kısıt:** çiftle açmış oyuncu yerden alamaz (`IllegalDrawError`). Yerden alınan taş
    bu tur bir per/çifte konmak zorunda (atışta doğrulanır).
- **phase = "act"** (oyuncu isteğe bağlı açış/işleme yapar, sonra **tam 1 taş atar**):
  - `openMelds` / `openPairs`: yalnız `!opened` iken (bkz. Bölüm 3). Tekrar edilemez.
  - `openNewMeld` / `processToMeld`: yalnız `opened` iken; tekrarlanabilir.
  - `discard`: eldeki taşı seçer → kendi discard yığınına. `pendingFloorTile` varsa ve
    masaya işlenmemişse `FloorTileUnusedError`. Atıştan sonra:
    - **Bitiş:** elde taş kalmadıysa → `status="finished"`, `outcome` montajı (Bölüm 3).
    - Değilse `phase="draw"`, `turn=(turn+1)%4`, `turnSeq += 1`, `pendingFloorTile=null`.

**Deste tükenmesi:** "draw" fazında `drawFromPile` çağrılır ve `drawPile` boşsa, el
bitiren olmadan sona erer: `status="finished"`, `outcome.deckExhausted=true`,
`finisherSeat=null`, herkesin eli `leftovers`.

## Bölüm 3 — Doğrulama, açış, eskalasyon, void, işleme, bitiş

Tüm taş-kombinasyon doğrulamaları **1a primitiflerini** kullanır
(`isValidMeld`, `isPair`, `meldsTotal`, `isWildcard` ...). Hamle hatalarında okey'e özel
hata fırlatılır (Bölüm 5).

**Açış — `openMelds`** (`opening.ts`):
1. Oyuncu `!opened` olmalı (yoksa `AlreadyOpenedError`).
2. Tüm `melds` `isValidMeld(meld, okey)`; taşların hepsi oyuncunun elinde olmalı.
3. Toplam = `meldsTotal(melds, okey)`; **eşik** ≥ kontrolü:
   - `katlamasiz`: eşik = `config.openThreshold` (101).
   - `katlamali`: `highestOpenScore===null` ise eşik = `openThreshold`; değilse
     eşik = `highestOpenScore + 1`. (Sonraki açan öncekini geçmeli.)
   - Toplam < eşik → `OpeningThresholdNotMetError` (state değişmez; "geri al + 101 ceza"
     gibi şeyler 1c, motor sadece reddeder).
4. Başarı: taşlar elden çıkar, her meld `tableMelds`'e (`owner=seat`, id üretilir);
   `opened=true`, `openMode="melds"`, `openScore=toplam`, `openedOnTurn=<turnSeq>`;
   `highestOpenScore = max(highestOpenScore, toplam)`.

**Açış — `openPairs`:**
1. `!opened`. Her çift tam 2 taş ve **geçerli çift** — doğrulama `validatePairsOpening`
   (aşağıda, **gösterge +1** dahil).
2. Çift sayısı ≥ **çift eşiği**:
   - `katlamasiz`: `config.minPairs` (5).
   - `katlamali`: `highestOpenPairs===null` ise `minPairs`; değilse `highestOpenPairs + 1`.
   - Sağlanmazsa `OpeningThresholdNotMetError`.
3. Başarı: çiftler `tableMelds`'e (`kind="pair"`); `opened=true`, `openMode="pairs"`,
   `pairCount=N`, `highestOpenPairs = max(highestOpenPairs, N)`.
4. **4-çift iptali:** açıştan sonra `openMode==="pairs"` olan oyuncu sayısı **4** ise
   `status="void"`, `outcome.isVoid=true` (el bozulur).

**Gösterge +1 (`validatePairsOpening`)**: 1a `isPair`/`isAllPairs` mantığına ek olarak,
**gösterge değerinin ikinci kopyası** (açık gösterge oyunda değil; ikinci kopya oyunda)
oyuncunun elindeyse, **çift modunda** onu **herhangi bir taşla** eşleyip geçerli bir çift
sayılmasına izin verir — en fazla **+1 çift**. (Gerçek okey wildcard'ı zaten 1a'da her
çifte bağlanıyor.) Yalnız bu özel taş için, yalnız çift açışında geçerli.

**İşleme — `processToMeld`:**
1. Oyuncu `opened` olmalı (`NotOpenedError`).
2. `meldId` masadaki bir perdir; `tiles` oyuncunun elinde.
3. **Yeni taş kümesi** = `mevcut meld.tiles ∪ tiles` uygun şekilde dizilince hâlâ geçerli
   meld olmalı (run uzatma / set tamamlama → `isValidMeld`). Pere herkes işleyebilir
   (kendi + rakip). Geçersizse `InvalidMoveError`.
4. Başarı: taşlar elden çıkar, hedef `meld.tiles` güncellenir.

**Yeni per/çift — `openNewMeld`:**
1. Oyuncu `opened` olmalı.
2. `openMode==="melds"` ise `tiles` geçerli run/set olmalı; `openMode==="pairs"` ise
   geçerli çift olmalı. (Seri açan yeni seri/grup açabilir; çift açan yeni çift koyabilir.)
3. Başarı: `tableMelds`'e eklenir (`owner=seat`).

**Besleme olayı (FeedingEvent):** `drawFromDiscard` ile alınan `pendingFloorTile`,
aynı turda bir **açış** (`openMelds`/`openPairs`) içinde tüketilirse **ve** oyuncu bu açışla
**ilk kez açıyorsa**, bir `FeedingEvent` kaydedilir: `feederSeat=(turn+3)%4`,
`takerSeat=turn`, `tileValue` = beslenen taşın değeri (okey ise temsil değeri),
`takerMode = openMode`. (Alan zaten açıksa olay yok — ceza yok.) Olaylar `state` içinde
biriktirilir ve `outcome.feedingEvents`'e geçer. **Ceza puanı (×10/×20) 1c'de.**

**Bitiş tespiti ve `finishType` (`outcome.ts`):** `discard` sonrası elde taş kalmazsa:
- `elden` = oyuncu **bu turda** açıp bitirdiyse (`openedOnTurn === state.turnSeq`);
  yani tur başında `opened` değildi, bu turda hem açtı hem bitirdi.
- `okey` = atılan son taş `isWildcard(tile, okey)`.
- `pairs` = bitiren oyuncunun `openMode==="pairs"`.
- `finishType = { elden, okey, pairs }` bayrak yapısı (1c bunları çarpana çevirir;
  `ciftOkey`=pairs&okey, `eldenOkey`=elden&okey vb. kombinasyonlar burada doğal kodlanır).
- `outcome`: `finisherSeat`, `finishType`, diğer oyuncuların elleri `leftovers`,
  `feedingEvents`, `isVoid=false`, `deckExhausted=false`.

## Bölüm 4 — Per-player view

```ts
// view.ts
export interface PublicPlayer {
  seat: number; playerId: PlayerId; team: 0 | 1 | null;
  opened: boolean; openMode: "melds" | "pairs" | null; pairCount: number;
  handCount: number;                 // taş SAYISI (içerik değil)
  lastDiscard: OkeyTile | null;      // discard yığınının üstü
}
export interface OkeyPlayerView {
  config: OkeyGameConfig;
  indicator: NumberedTile;
  okey: NumberedTile;
  you: number;                       // bakan koltuk
  yourHand: OkeyTile[];             // yalnız sahibinin elini içerir
  turn: number;
  phase: "draw" | "act";
  drawPileCount: number;             // SADECE sayı (sıra/içerik değil)
  players: PublicPlayer[];           // 4
  tableMelds: TableMeld[];           // herkese açık
  status: "playing" | "finished" | "void";
  outcome: HandOutcome | null;       // el bitince
}
export function toOkeyPlayerView(state: OkeyGameState, seat: number): OkeyPlayerView;
```

**Gizlilik değişmezi (CLAUDE.md):** view **asla** başka oyuncunun el taşlarını,
`drawPile`'ın içeriğini/sırasını içermez — yalnız sayılar. Saf ve test edilebilir.
`outcome.leftovers` el bitince herkese görünür (skor şeffaflığı için); oyun sürerken
`outcome` null'dur, dolayısıyla sızıntı yok.

## Bölüm 5 — Hata yönetimi

Okey'e özel hatalar `errors.ts` içinde, çekirdeğin `AppError` tabanından türer (mevcut
`NotYourTurnError`, `InvalidMoveError` çekirdekten kullanılır). Hepsi `applyMove`'da
fırlatılır; transport katmanı (sonraki entegrasyon) bunları güvenli istemci mesajına çevirir.

- `NotYourTurnError` (çekirdek) — `turn !== move sahibi`.
- `WrongPhaseError` — yanlış fazda hamle (örn. "act" beklerken `drawFromPile`).
- `IllegalDrawError` — çiftle açan oyuncu `drawFromDiscard`; ya da deste/discard kuralı ihlali.
- `AlreadyOpenedError` — `opened` iken `openMelds`/`openPairs`.
- `NotOpenedError` — `!opened` iken `processToMeld`/`openNewMeld`.
- `OpeningThresholdNotMetError` — eşik/çift sayısı yetersiz.
- `ModeLockedError` — açış modu kilidine aykırı yeni per/çift.
- `FloorTileUnusedError` — `pendingFloorTile` işlenmeden `discard`.
- `TileNotInHandError` — hamlede olmayan taş kullanımı.

Doğrulama başarısızsa state **değişmez** (saf); çağıran hatayı yakalar.

## Test (Vitest, TDD)

Hepsi seed'li `SeededRng` ile deterministik. Önce başarısız test.
- **setup:** el boyları 22/21/21/21, gösterge sayılı, okey doğru, drawPile=20, eşli takım
  ataması (0&2 / 1&3), saflık (deck girdisi değişmez), determinizm.
- **draw:** pile/discard alımı, faz geçişi, çiftle-açanın yerden alamaması, deste tükenmesi
  → `deckExhausted` sonucu.
- **openMelds:** katlamasız 101 kabul / 100 ret; katlamalı eskalasyon (ilk 101, sonraki
  `>highestOpenScore`); mod kilidi; başarıda taşların masaya geçişi; saflık.
- **openPairs:** minPairs (5 kabul / 4 ret); katlamalı çift eskalasyonu; **gösterge +1**
  (ikinci kopya ile +1 çift); **4-çift iptali** → `status="void"`.
- **process/openNewMeld:** rakip pere işleme, run uzatma / set tamamlama geçerliliği,
  açmadan işleme reddi, mod-kilitli yeni per/çift.
- **discard + bitiş:** bitiş tespiti (el boşalınca), `finishType` bayrakları
  (elden/okey/pairs ve kombinasyonları), **besleme olayı** kaydı (açmamış alan açarsa,
  açık alan ceza-yok), `FloorTileUnusedError`.
- **view:** rakip eli ve drawPile içeriği **yok**; sayılar doğru; `outcome` el bitince görünür.
- **immutability:** `applyMove` girdiyi mutasyona uğratmaz (derin eşitlik kontrolü).

## Kapsam dışı (1c ve sonrası)

- **Puan/ceza aritmetiği:** bitiren −101, çarpan merdiveni (elden/okey/çift ×2/×4),
  açmayan 202/404, elde-okey +101, besleme ×10/×20, eşli takım puanı. (`HandOutcome`
  bu hesap için gereken **ham olguları** taşır.)
- **Maç döngüsü:** N el (7/11/21) oynatma, skor biriktirme, kazanan.
- **Çekirdeğe entegrasyon:** Socket.IO hamleleri, oda-config'ten `OkeyGameConfig` üretimi,
  turn-timeout bağlama, reconnect ile `toOkeyPlayerView` yeniden gönderimi.
- **İstemci masası / UI**, E2E.

## Tamamlanma kriterleri (DoD)

- `pnpm typecheck`, `pnpm test`, `pnpm lint`, `pnpm build` temiz.
- Motor dört varyant kombinasyonunu da mekanik olarak oynatır (config ile).
- `applyMove` saf ve değişmez; gizlilik `toOkeyPlayerView` ile zorlanır.
- `server/src/games/okey/` dışında çekirdek kod değişmez; `shared/`'a oyun-özel tip eklenmez.
