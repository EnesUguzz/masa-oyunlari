# Tasarım: Okey 101 Sunucu Entegrasyonu (Sub-project 2a)

> Tarih: 2026-06-16
> Kapsam: Tamamlanmış saf okey motorunu (1a/1b/1c) çekirdeğin oda/socket katmanına
> bağlamak. Oyun yaşam döngüsü (başlat → hamleler → çok-el → maç sonu), Zod-doğrulamalı
> hamle event'leri, per-player okey view broadcast, turn-timeout, reconnect.
> **UI yok** (o, 2b). Kanonik kurallar: `docs/okey-101-rules.md`.

## Amaç

Saf motor (`createHand`, `applyMove`, `toOkeyPlayerView`, `scoreHand`, `createMatch`,
`applyHandScore`) bir orkestrasyon + transport katmanına bağlanacak. Sunucu otoritesi
korunur: istemci yalnız niyet (hamle) yollar, her şey sunucuda doğrulanır, her oyuncuya
yalnız kendi `OkeyPlayerView`'i gider. Çekirdek (oda/lobi/bağlantı) **oyun-agnostik**
kalır; okey her şeyi `games/okey/` altında kurar.

## Mimari ilkeleri (CLAUDE.md)

- **Sunucu otoritesi:** tüm kurallar sunucuda; istemciye güvenilmez.
- **Per-player view:** `toOkeyPlayerView` ile; "tüm state'i herkese yolla" yasak.
- **Zod doğrulama:** istemciden gelen her mesaj sunucuda Zod ile doğrulanır.
- **Oyuna özel tip `shared`'a konmaz:** okey wire-sözleşmesi `games/okey/`'te; 2b istemci
  tarafında aynayı kurar. `shared`'da yalnız oyun-agnostik şeyler (mevcut event'ler) kalır.
- **Katmanlı:** socket handler'ları ince; iş mantığı `OkeySession`'a delege.
- **RNG/Clock enjekte:** `OkeySession` çekirdeğin `Rng`/`Clock`'unu alır; testte seed'li/fake.

## Bileşenler ve dosya yapısı

```
server/src/games/okey/
├── (1a/1b/1c modülleri — değişmez)
├── contract.ts    # YENİ: Zod şemaları (tile, move, startGame config) + event adları
├── table-view.ts  # YENİ: OkeyTableView (per-player payload: view + match standings)
├── session.ts     # YENİ: OkeySession (orkestrasyon: state + hamle + çok-el + view)
├── auto-move.ts   # YENİ: turn-timeout için otomatik hamle üretimi
└── handlers.ts    # YENİ: registerOkeyHandlers(socket, deps) — ince socket teli
server/src/core/
└── ... (değişmez; register-handlers.ts'e tek satır okey-handler kaydı eklenir)
```

> Tek oyun olduğundan oturum deposu (`roomCode → OkeySession`) sade bir in-memory
> `Map` olarak `handlers.ts`/bir `OkeySessionStore` içinde tutulur (YAGNI: jenerik
> "oyun modülü registry"si UNO gelince soyutlanır). `register-handlers.ts`'e yalnız
> "okey handler'larını kaydet" çağrısı eklenir — çekirdek mantığı değişmez.

## Bölüm 1 — Wire sözleşmesi (`contract.ts`)

İstemciden gelen güvenilmeyen veriyi Zod ile doğrula. Tile ve Move şemaları motorun
tiplerine `z.infer` ile hizalı.

```ts
import { z } from "zod";

export const OkeyClientEvents = { startGame: "okey:startGame", move: "okey:move" } as const;
export const OkeyServerEvents = { state: "okey:state", ended: "okey:ended" } as const;

const colorSchema = z.enum(["red", "yellow", "black", "blue"]);
const tileSchema = z.discriminatedUnion("kind", [
  z.object({ kind: z.literal("numbered"), color: colorSchema, value: z.number().int().min(1).max(13) }).strict(),
  z.object({ kind: z.literal("fakeJoker") }).strict(),
]);

export const moveSchema = z.discriminatedUnion("kind", [
  z.object({ kind: z.literal("drawFromPile") }).strict(),
  z.object({ kind: z.literal("drawFromDiscard") }).strict(),
  z.object({ kind: z.literal("openMelds"), melds: z.array(z.array(tileSchema)) }).strict(),
  z.object({ kind: z.literal("openPairs"), pairs: z.array(z.array(tileSchema)) }).strict(),
  z.object({ kind: z.literal("openNewMeld"), tiles: z.array(tileSchema) }).strict(),
  z.object({ kind: z.literal("processToMeld"), meldId: z.string(), tiles: z.array(tileSchema) }).strict(),
  z.object({ kind: z.literal("discard"), tile: tileSchema }).strict(),
]);

export const startGameSchema = z.object({
  pairing: z.enum(["essiz", "esli"]),
  escalation: z.enum(["katlamasiz", "katlamali"]),
  penalty: z.enum(["cezasiz", "cezali"]),
  partnerEscalation: z.enum(["ese-katlamali", "ese-katlamasiz"]).optional(),
  targetHands: z.union([z.literal(7), z.literal(11), z.literal(21)]),
}).strict();

export const okeyMoveSchema = z.object({ move: moveSchema }).strict();
export type MovePayload = z.infer<typeof moveSchema>;        // === engine Move
export type StartGamePayload = z.infer<typeof startGameSchema>;
```

> `moveSchema` çıktısı motorun `Move` birleşik tipiyle yapısal olarak aynı olmalı; bir
> derleme-zamanı kontrolü (`const _check: Move = ... ` veya `satisfies`) ile hizalama
> kilitlenir (plan adımı).

## Bölüm 2 — Per-player payload (`table-view.ts`)

```ts
export interface MatchStanding {
  seatTotals: number[];
  teamTotals: [number, number] | null;
  handsPlayed: number;
  targetHands: number;
  status: "playing" | "finished";
  winner: MatchWinner;   // match.ts'ten
}
export interface OkeyTableView {
  view: OkeyPlayerView;     // toOkeyPlayerView(hand, seat)
  match: MatchStanding;
  handNumber: number;       // 1..targetHands
  seating: { seat: number; playerId: PlayerId; nickname: string }[];  // koltuk→oyuncu (genel)
}
```

`seating` herkese açık (kim hangi koltukta); el içi gizli bilgi yine `view` içinde izole.

## Bölüm 3 — Orkestrasyon (`session.ts`)

`OkeySession` bir odanın canlı oyununu tutar. Saf motoru sarmalar; state'i değişmez
tutup her hamlede değiştirir (kendisi stateful, `RoomService`'in odaları tutması gibi).

```ts
export class OkeySession {
  constructor(
    config: OkeyGameConfig,
    seating: readonly PlayerId[],        // 4, koltuk sırası (maç boyu sabit; eşli takımları bundan)
    private readonly rng: Rng,
  );
  readonly config: OkeyGameConfig;
  get currentSeat(): number;             // hand.turn
  get isOver(): boolean;                 // match.status === "finished"
  seatOf(playerId: PlayerId): number | null;
  apply(bySeat: number, move: Move): void;   // hand'i ilerletir; el biterse skorla + sonraki el
  tableViewFor(seat: number): OkeyTableView;
}
```

**`apply(bySeat, move)`:**
1. `hand = applyMove(hand, move, bySeat)` (motor sırayı/kuralı doğrular; hata fırlatırsa
   handler yakalar, state değişmez).
2. `hand.status === "finished"` ise:
   - `score = scoreHand(hand)`, `match = applyHandScore(match, score)`.
   - `match.status === "playing"` ise **sonraki eli dağıt**: `hand = createHand(config, seating, rng)`,
     `handNumber += 1`. (Başlangıç koltuğu — bkz. karar D6.)
   - Aksi halde maç bitti (handler `okey:ended` yollar).

**Kararlar (v1 — basitleştirmeler, test aşamasında gözden geçirilebilir):**
- **D6 — Dağıtıcı rotasyonu yok:** `createHand` her el koltuk 0'ı 22 taşla başlatır;
  v1'de her el koltuk 0 başlar. Gerçek okey dağıtıcıyı döndürür; bunu 1b `createHand`'e
  `startingSeat` parametresi eklemeden yapmak takımları (eşli koltuk paritesi) bozar, bu
  yüzden v1'de sabit. (Sonra ele alınır.)
- **D7 — Koltuk = katılım sırası:** odadaki oyuncu sırası koltuk sırası; eşli takımlar
  koltuk paritesinden (0&2 vs 1&3).
- **D8 — Sonraki el otomatik:** el biter bitmez sunucu sonraki eli dağıtır ve yayınlar
  (ara "hazır" beklemesi yok).

## Bölüm 4 — Turn-timeout (`auto-move.ts` + handler)

Her tur, sıradaki koltuk için handler bir `TurnTimer` (çekirdek) kurar; süre dolarsa
oyunu ilerletmek için **otomatik hamle** oynanır:

```ts
export function autoMoves(hand: OkeyGameState): Move[];
// phase "draw"  -> [{kind:"drawFromPile"}, {kind:"discard", tile: <çekilen ya da eldeki ilk taş>}]
// phase "act"   -> [{kind:"discard", tile: <pendingFloorTile değilse eldeki ilk uygun taş>}]
```

- Timer sıra o koltuğa geçtiğinde (draw fazı) kurulur; oyuncunun **her başarılı hamlesinde
  temizlenip yeniden kurulur** (aktif düşünen oyuncu sub-aksiyonlar arası kesilmez).
- Süre dolunca handler `autoMoves(hand)` döngüsüyle `session.apply(currentSeat, m)` çağırır,
  sonra yeniden yayınlar ve sonraki tur için timer'ı yeniden kurar.
- **Edge — act fazında `pendingFloorTile`:** auto-move asla yerden çekmez, bu yüzden bu
  durum yalnız oyuncunun **kendi** yerden çekip takılmasıyla oluşur (2b UI yalnız
  kullanılabilir taşın yerden alınmasına izin vereceği için pratikte oluşmaz). Bu nadir
  halde `autoMoves` **boş** döner ve tur açık bırakılır (zorla geçersiz hamle üretilmez).
  Bilinen v1 sınırı; ileride motora "yerden alınan taş anında kullanılabilir olmalı"
  doğrulaması eklenebilir.
- Süre `config`/env'ten gelir (vsy. örn. 30 sn). Test'te `FakeClock` ile deterministik.

> Auto-move "en güvenli ilerletme"dir (aç/işle denemez) — bağlantısı kopan ya da
> gecikmiş oyuncu el bekletmesin diye. Botvari akıllı oynama YAGNI.

## Bölüm 5 — Socket teli (`handlers.ts`) ve çekirdek kancası

`registerOkeyHandlers(socket, deps)` çekirdeğin `io.on("connection")` akışından çağrılır
(register-handlers.ts'e tek satır). Mevcut lobi handler'ları aynen kalır.

- **`okey:startGame`** (oda sahibi): `startGameSchema` doğrula; oda dolu (4) ve
  `status==="waiting"` olmalı (yoksa `AppError`). `OkeySession` kur (seating = oda oyuncu
  sırası), store'a koy, oda durumunu "playing" yap, herkese `okey:state` yayınla, sıradaki
  koltuk için timer kur.
- **`okey:move`** (koltuktaki oyuncu): `okeyMoveSchema` doğrula; oturum bul; `seat =
  session.seatOf(player.id)` (yoksa hata); `session.apply(seat, move)` (motor sıra/kural
  doğrular — `NotYourTurnError`/`InvalidMoveError` istemciye **mevcut `errorEvent`** olarak
  döner; yeni hata event'i eklenmez); timer temizle; yeniden yayınla; maç bitmediyse yeni
  timer kur; bittiyse `okey:ended` (final standings).
- **Yayın (`broadcastState`)**: her koltuktaki oyuncuya `connections.socketForPlayer` ile
  `okey:state` = `session.tableViewFor(seat)` gönder. Bağlı olmayanı atla.
- **Reconnect:** mevcut `identify` reconnect dalına ek — oyuncunun odasında aktif oturum
  varsa ona `okey:state` (kendi view'i) tekrar yollanır. (register-handlers.ts'teki
  reconnect bloğuna okey kontrolü eklenir.)
- **Disconnect/grace:** oyun sırasında koltuk korunur; sıradaki oyuncu bağlı değilse
  turn-timeout auto-move ile ilerletir (özel iş yok). Reconnect'te view geri gelir.

Hata çevirisi mevcut kalıbı kullanır: `AppError` → `{code, message}`; beklenmeyen → INTERNAL
(stack sızdırmaz).

## Hata yönetimi

- İstemci verisi Zod ile doğrulanır; başarısızsa `ValidationError`/`errorEvent`.
- Motor `NotYourTurnError`/`InvalidMoveError`/okey hatalarını fırlatır; handler yakalar,
  güvenli mesaja çevirir; state değişmez.
- Sıra dışı `startGame` (dolu değil / zaten oynanıyor) → `AppError`.

## Test (Vitest)

Socket/ağ olmadan, orkestrasyon ve sözleşme saf test edilir:
- **contract:** geçerli/şema-dışı move ve startGame payload'ları; `moveSchema` çıktısının
  motorun `Move`'una atanabildiği (tip uyumu).
- **session:** start → tam bir eli hamlelerle bitir → skor + sonraki el dağıtıldı
  (`handNumber` arttı, yeni hand "playing"); son el → `isOver` + standings doğru;
  `seatOf`; geçersiz hamlede state değişmez (hata fırlatır).
- **auto-move:** draw fazında çek+at; act fazında at; `pendingFloorTile` varken güvenli
  ilerletme; FakeClock ile timeout zincirinin eli ilerletmesi.
- **handlers (ince):** sahte `io`/`socket` ve `connections` ile: startGame yetkisi/oda-dolu
  kontrolü; move sıra kontrolü; her koltuğa ayrı `okey:state` gittiği (gizlilik: bir
  koltuğun payload'ı başka koltuğun elini içermez); maç sonu `okey:ended`.

## Kapsam dışı (sonraki dilimler)

- İstemci okey masası UI (2b).
- E2E (Playwright) — iki tarayıcı (2c).
- Dağıtıcı rotasyonu, "hazır" beklemesi, akıllı bot, hedef-skor/baraj — sonraki iyileştirmeler.

## Tamamlanma kriterleri (DoD)

- `pnpm typecheck`, `pnpm test`, `pnpm lint`, `pnpm build` temiz.
- Sunucu, socket event'leriyle 4 oyunculu tam bir okey maçı oynatabilir (birim/entegrasyon
  testleriyle kanıtlı); her oyuncuya yalnız kendi view'i gider.
- Çekirdek oyun-agnostik kalır (yalnız tek satır okey-handler kaydı); `shared`'a okey-özel
  tip eklenmez.
