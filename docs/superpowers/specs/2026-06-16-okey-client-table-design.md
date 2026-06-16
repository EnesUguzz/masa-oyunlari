# Tasarım: Okey 101 İstemci Masası (Sub-project 2b)

> Tarih: 2026-06-16
> Kapsam: 2a sunucu sözleşmesini tüketen React okey masası — oda sahibinin config
> seçip oyunu başlatması, `okey:state`/`okey:ended` ile masayı çizmek, tüm hamle
> türlerini gönderebilmek, skor tablosu. Mevcut minimal inline-stil istemci kalıbı korunur.

## Amaç

Dört oyuncunun tarayıcıda tam bir okey maçı oynayabilmesi. Sunucu otoritesi korunur:
istemci yalnız niyet (hamle) yollar, gördüğü her şey sunucudan gelen `OkeyTableView`'dir.
Görsel cila ve E2E sonraki (2c) işidir; bu dilim **fonksiyonel ve doğru**.

## Mevcut yapı (korunur)
- `App.tsx`: ekran durum makinesi (`nickname`/`lobby`/`room`), `GameSocket`, `PlayerView`.
- `net/socket.ts`: ince socket.io sarmalayıcı (listener'lar).
- `core/{NicknameEntry,Lobby,Room}.tsx`: inline-stil basit bileşenler.
- Stil: `style={{...}}` inline; ayrı CSS sistemi yok.

## Tip aynası (CLAUDE.md kısıtı)

İstemci yalnız `@masa/shared`'ı import eder; sunucu paketini import edemez ve okey-özel
tipler (`OkeyTile` bir parça tipi) `shared`'a konmaz. Bu yüzden okey wire tipleri istemci
tarafında **aynalanır**: `client/src/games/okey/types.ts`. Wire JSON olduğundan yapısal
eşleşme yeterli. (Sürüklenmeyi azaltmak için tipler minimal ve tek dosyada; 2a `table-view.ts`
ile aynı şekiller.)

```ts
// client/src/games/okey/types.ts  (server şekillerinin aynası)
export type OkeyColor = "red" | "yellow" | "black" | "blue";
export type OkeyTile = { kind: "numbered"; color: OkeyColor; value: number } | { kind: "fakeJoker" };
export interface TableMeld { id: string; owner: number; kind: "run" | "set" | "pair"; tiles: OkeyTile[]; }
export interface PublicPlayer { seat: number; playerId: string; team: 0 | 1 | null; opened: boolean; openMode: "melds" | "pairs" | null; pairCount: number; handCount: number; lastDiscard: OkeyTile | null; }
export interface OkeyPlayerView { config: OkeyConfig; indicator: NumberedTile; okey: NumberedTile; you: number; yourHand: OkeyTile[]; turn: number; phase: "draw" | "act"; drawPileCount: number; players: PublicPlayer[]; tableMelds: TableMeld[]; status: "playing" | "finished"; outcome: HandOutcome | null; }
export type MatchWinner = { kind: "seat"; seat: number } | { kind: "team"; team: 0 | 1 } | null;
export interface MatchStanding { seatTotals: number[]; teamTotals: [number, number] | null; handsPlayed: number; targetHands: number; status: "playing" | "finished"; winner: MatchWinner; }
export interface SeatInfo { seat: number; playerId: string; nickname: string; }
export interface OkeyTableView { view: OkeyPlayerView; match: MatchStanding; handNumber: number; seating: SeatInfo[]; }
export type Move = ...; // 2a moveSchema ile aynı 7 varyant
export interface StartGameConfig { pairing; escalation; penalty; partnerEscalation?; targetHands; }
```
(`NumberedTile`/`OkeyConfig`/`HandOutcome` da aynalanır — sadece UI'nın okuduğu alanlar.)

## Socket genişletmesi (`net/socket.ts`)

`GameSocket`'e okey eklenir (mevcut lobi davranışı değişmez):
- Listener'lar: `onOkeyState(tv: OkeyTableView)`, `onOkeyEnded(tv: OkeyTableView)`.
- Metotlar: `startGame(config: StartGameConfig)` → emit `"okey:startGame"`;
  `sendMove(move: Move)` → emit `"okey:move"` `{ move }`.
- Event adları string sabit (`"okey:state"` vb.) — 2a `OkeyServerEvents`/`OkeyClientEvents`
  ile aynı; istemci kendi sabitlerini tutar (mirror).

## Ekran akışı (`App.tsx`)

- Yeni ekran: `"table"`. `onOkeyState`/`onOkeyEnded` gelince `tableView` state'i set edilir
  ve ekran `"table"` olur. (`okey:ended` de aynı payload'u taşır; `match.status==="finished"`
  ile maç-sonu gösterilir.)
- `"room"` ekranı (lobi odası) korunur; oyun başlayınca `okey:state` ile `"table"`'a geçilir.
- Reconnect: 2a kimlik-doğrulamada aktif oturum varsa `okey:state` yeniden yollar → istemci
  doğrudan masaya döner.

## Bileşenler (`client/src/games/okey/`)

Hepsi inline-stil, küçük ve odaklı:
- **`OkeyTable.tsx`** — düzen: üstte gösterge+okey, kalan deste sayısı, el no, sıra; ortada
  `tableMelds` (açılmış perler); kenarda 3 rakip (`PublicPlayer`: nick, taş sayısı, açıldı mı,
  son attığı taş); altta kendi elin + kontroller; yanda `Scoreboard`.
- **`Tile.tsx`** — tek taş: sayılı taş renk+değer kutusu; sahte okey "🃏". Tıklanabilir (seçim).
- **`Hand.tsx`** — `yourHand` taşları; çoklu seçim (toggle), seçili taşlar vurgulu.
- **`Controls.tsx`** — sıra sendeyse hamle butonları (aşağıda); değilse "sıra: <nick>".
- **`Scoreboard.tsx`** — `seatTotals`/`teamTotals`, el no/hedef, maç bitince kazanan.
- **`StartGamePanel.tsx`** — oda sahibine (oda dolu + "waiting"): pairing/escalation/penalty/
  (katlamalı+eşli ise partnerEscalation)/targetHands seçicileri + "Oyunu Başlat".

`StartGamePanel` `Room.tsx`'e eklenir (sahip + 4 oyuncu + waiting iken görünür).

## Hamle kurma (`move-builder.ts` — saf, test edilir)

UI seçimlerinden `Move` üretmenin saf mantığı izole edilir (tek gerçek-mantık parçası):
```ts
// gruplama: sahnelenen taş listelerinden açış/işleme hamlesi kur
export function buildOpenMelds(groups: OkeyTile[][]): Move;
export function buildOpenPairs(pairs: OkeyTile[][]): Move;
export function buildProcess(meldId: string, tiles: OkeyTile[]): Move;
export function buildOpenNewMeld(tiles: OkeyTile[]): Move;
export function buildDiscard(tile: OkeyTile): Move;
// seçim yardımcıları (UX ipucu — kesin doğrulama sunucuda):
export function canDiscard(selected: OkeyTile[]): boolean;       // tam 1 taş
export function tilesEqual(a, b): boolean;                        // seçim toggle için
```
Etkileşim akışı (v1, sade):
- **Çek:** "Desteden çek" (drawFromPile) / "Yerden al" (drawFromDiscard) butonları (draw fazı).
- **Açış (per):** elden taş seç → "Gruba ekle" (sahne listesine bir meld ekler) → tekrar →
  "Perlerle Aç" → `buildOpenMelds(stagedGroups)` gönderilir. **Çift:** benzer, 2'lik gruplar →
  "Çiftlerle Aç".
- **İşle:** taş seç + masadaki bir perr (dropdown, meldId) → "İşle" → `buildProcess`.
- **Yeni per:** taş seç → "Yeni Per" → `buildOpenNewMeld`.
- **At:** tam 1 taş seç → "At" → `buildDiscard` (el biterse sunucu sonlandırır).

Sunucu her hamleyi yine doğrular; UX yardımcıları yalnız buton aktif/pasif içindir.

## Hata gösterimi

Mevcut `onError` banner'ı korunur (`errorEvent` → kırmızı metin). Geçersiz hamlede sunucu
`errorEvent` döner; istemci banner'da gösterir, seçim sıfırlanır.

## Test

- **`move-builder.test.ts` (vitest, istemci):** İstemci paketine minimal `vitest` eklenir
  (devDep + `test` script + `vitest.config.ts`, jsdom'suz — saf mantık). `buildOpen*`/
  `buildDiscard`/`canDiscard`/`tilesEqual` test edilir.
- **Bileşenler:** otomatik bileşen testi bu dilimde yok (jsdom/RTL yığını eklenmez); doğrulama
  `pnpm typecheck` + `pnpm build` + elle çalıştırma. Tam akış E2E'si **2c**'dedir.

## Kapsam dışı (2c ve sonrası)
- Playwright E2E (iki tarayıcı aynı masa).
- Görsel cila / animasyon / sürükle-bırak; taş sıralama/gruplama yardımcıları; ses.
- Dağıtıcı rotasyonu UI'ı (sunucuda da v1'de yok).

## Tamamlanma kriterleri (DoD)
- `pnpm typecheck`, `pnpm lint`, `pnpm build` temiz; `move-builder` testleri yeşil.
- Oda sahibi config seçip başlatabilir; dört oyuncu `okey:state` ile masayı görür (yalnız
  kendi eli); sıradaki oyuncu tüm hamle türlerini gönderebilir; el/maç sonu skor tablosunda
  görünür; reconnect masaya döndürür.
- `shared`'a okey-özel tip eklenmez; çekirdek UI (lobi) davranışı bozulmaz.
