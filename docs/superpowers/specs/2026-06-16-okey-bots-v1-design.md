# Tasarım: Okey Botları v1 (güvenli auto-play)

> Tarih: 2026-06-16
> Kapsam: Tek bir insanın okey'i botlara karşı oynayabilmesi. Bot = sunucunun, sırası
> gelince motorun mevcut **güvenli auto-play** mantığıyla (`autoMoves`: çek + at)
> oynadığı, soketi olmayan bir koltuk. **LLM yok, ek API maliyeti yok.**

## Amaç

Çevrimiçi kullanıcı bulamadan oyunu solo test etmek (ve ileride çevrimdışı oynamak) için
odayı botlarla doldurabilmek. v1 botu basittir: el açmaz/bitmez, yalnız deste çekip taş atar
— bu, akışı/UI'ı/reconnect'i test etmek ve **insanın** açıp bitirmesini denemek için yeterli.
(Daha akıllı sezgisel bot ayrı, sonraki bir dilim.)

## İlke

Mekanik zaten var: `OkeySession.autoPlayTurn(seat)` (turn-timeout'ta kullanılıyor) bir koltuğu
güvenli hamlelerle oynatıp sırayı geçirir. Bot desteği = (1) odayı bot oyuncularla doldurma
(jenerik), (2) sırası bota gelince bu auto-play'i sürme (okey'e özel). Sunucu otoritesi ve
per-player gizlilik aynen korunur: botların eli `toOkeyPlayerView` ile gizli, soketi olmadığı
için onlara hiçbir şey yollanmaz.

## Bileşenler / değişiklikler

### shared
- `Player` tipine **`isBot?: boolean`** eklenir (jenerik oyuncu meta; oyun-özel değil).
- `ClientEvents`'e **`addBots: "addBots"`**; `addBotsSchema = z.object({}).strict()` (gövdesiz —
  odayı kapasiteye kadar bot ile doldurur). `AddBotsPayload = z.infer<...>`.

### core
- `RoomService.addBots(code, count): Room | undefined` — `count` kadar bot `Player` üretir
  (`id` rng ile benzersiz, örn. `bot_<6-char>`; `nickname` `"Bot 1".."Bot 3"`; `isBot: true`),
  kapasiteyi aşmadan `room.players`'a ekler, `repo.update`. (Bot id'leri kayıt defterine
  (registry) girmez; sadece oda üyesi + koltuk için.)
- `register-handlers.ts`: yeni `addBots` handler'ı (mevcut lobi kalıbı): `addBotsSchema.parse`;
  oyuncu kimliği zorunlu; oda sahibi olmalı; oda `status==="waiting"`; eksik koltuk varsa
  `rooms.addBots(code, capacity - players.length)`; sonra `sendRoomState`. Kötü durumda `AppError`.
- Bu **jenerik** bir oda yeteneğidir (üyelik); okey-özel kural sızmaz.

### okey
- `SeatInfo`'ya **`isBot: boolean`** eklenir; `OkeySession` koltuk bilgisini `Player.isBot`'tan
  doldurur. `OkeySession.isBotSeat(seat): boolean`.
- `handlers.ts`: `driveBots(code)` yardımcı — `!session.isOver && session.isBotSeat(session.currentSeat)`
  olduğu sürece `session.autoPlayTurn(session.currentSeat)` (yüksek guard, ör. 10000 güvenlik ağı).
  Sonunda `currentSeat` ya insan ya da maç bitmiş olur.
- `driveBots` çağrı noktaları: **startGame sonrası**, **her `okey:move` apply'ından sonra**,
  ve **timeout auto-play'inden sonra** — broadcast'ten ÖNCE. `armTimer` yalnız `currentSeat`
  **insan** ise timer kurar (zaten driveBots sonrası bot kalmaz; yine de guard'lı).
- Botların soketi yoktur → `broadcast` döngüsündeki `connections.socketForPlayer(botId)`
  `undefined` döner ve atlanır (mevcut davranış).

### client
- `net/socket.ts`: `addBots(): void` → emit `"addBots"` `{}`.
- `core/Room.tsx`: sahibe **"Botlarla Doldur"** butonu — `room.status==="waiting"` ve
  `players.length < capacity` iken; tıklayınca `socket.addBots()`. Bot dolunca oda dolar →
  mevcut `StartGamePanel` görünür.
- `games/okey/types.ts`: `SeatInfo`'ya `isBot: boolean` aynalanır (masada bot etiketi gösterilebilir;
  zorunlu değil ama tutarlı). Bot oyuncular zaten `nickname` "Bot N" ile görünür.

## Akış (özet)

1. Sahip oda kurar (1/4). "Botlarla Doldur" → sunucu 3 bot ekler → oda 4/4, herkese roomState.
2. Sahip config seçip "Oyunu Başlat" → `OkeySession` (koltuk 0 = sahip-insan, 1–3 = bot).
3. İnsan oynar; her hamleden sonra `driveBots` botları sırayla oynatır, sıra insana döner,
   yeni `okey:state` yayınlanır. İnsan açıp/işleyip bitirebilir; bot eli açmaz.

## Kapsam dışı / sonraki
- **Sezgisel (akıllı) bot** (per/çift arar, açar, bitebilir) — ayrı dilim.
- Bot hamleleri arası gecikme/animasyon (v1: botlar senkron oynar, tek broadcast).
- Bot'u oyundan çıkarma / insanla değiştirme; bot zorluk seviyesi.

## Hata yönetimi
- `addBots`: sahip değilse / oda waiting değilse / zaten dolu ise `AppError` → `errorEvent`.
- `driveBots`: `autoPlayTurn` güvenli hamle üretir; bir hata olursa timeout-callback'teki gibi
  loglanır, oyun bozulmaz.

## Test (Vitest)
- **core:** `RoomService.addBots` N bot ekler (benzersiz id, `isBot:true`, kapasiteyi aşmaz,
  zaten dolu ise eklemez).
- **okey session:** `isBotSeat` doğru; bot koltuk bilgisi `SeatInfo.isBot`'a yansır.
- **okey handlers:** 1 insan (koltuk 0) + 3 bot kurulu oturumda, insanın bir hamlesinden sonra
  `driveBots` ile sıranın **insana** dönmesi; tek-broadcast; bitmeyen el ilerlemesi
  (FakeClock gerekmez — botlar senkron). Sahte io/socket ile.
- **client:** `addBots` doğru event'i emit eder (mevcut socket testi yoksa, en azından typecheck).

## Tamamlanma kriterleri (DoD)
- `pnpm typecheck`, `pnpm test`, `pnpm lint`, `pnpm build` temiz.
- Sahip odayı botlarla doldurup oyunu başlatabilir; insan tüm hamle türlerini oynayabilir,
  botlar otomatik çek+at ile ilerler; per-player gizlilik korunur; çekirdek oyun-agnostik kalır
  (addBots jenerik üyelik); `shared`'a okey-özel tip eklenmez (`isBot` jeneriktir).
