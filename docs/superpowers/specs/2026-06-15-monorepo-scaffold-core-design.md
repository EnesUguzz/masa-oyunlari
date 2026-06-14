# Tasarım: Monorepo İskelesi + Çalışan Dikey Dilim (Sub-project 1)

> Tarih: 2026-06-15
> Kapsam: Online Masa Oyunları Platformu'nun **çekirdek motoru** ve ilk uçtan-uca akışı.
> Bu spec, Okey 101 oyun mantığını **içermez** — o ayrı bir spec/plan döngüsüdür.

## Amaç

CLAUDE.md'de tanımlı mimariyi (sunucu otoritesi, per-player view, token kimlik,
reconnect, turn-timeout) gerçek bir uçtan-uca akışla **erkenden kanıtlamak**:
oyuncu takma ad girer → kalıcı token alır → oda kurar/kod ile katılır → lobiyi
kendi `PlayerView`'i olarak görür. Henüz oyun yok; sadece motor.

Bu, projenin en riskli kısımlarını (kimlik, per-player view, reconnect) Okey
kurallarının karmaşıklığı işin içine girmeden doğrular.

## Kapsam dışı (YAGNI)

- Okey 101 (veya herhangi bir) oyun mantığı, taşlar, kurallar.
- Açık oda listesi / oda arama (katılma yalnızca **oda kodu** ile).
- Sohbet.
- Redis / kalıcı veritabanı (depo arayüzü arkasında in-memory; Redis kurulmaz).
- Playwright E2E (UI dilimine bırakıldı).
- Hesap sistemi / şifre (guest takma ad + token yeterli).

## Mimari genel bakış

pnpm workspaces monorepo, 3 paket + TypeScript project references:

- **`@masa/shared`** — oyun-bağımsız tipler + event sözleşmeleri (Zod). TS tipleri
  `z.infer` ile şemadan türetilir.
- **`@masa/server`** — Node + Socket.IO. `core/` (oyun-bağımsız) + `games/` (boş, placeholder).
- **`@masa/client`** — React + Vite, `shared`'dan tip alan typed socket istemcisi.

`client` ve `server`, `shared`'ı paket adıyla (`@masa/shared`) import eder; göreli
yol kullanılmaz. `shared` değişince project references ile tip kontrolü iki tarafa yayılır.

### Klasör yapısı (bu dilim sonunda)

```
/
├── shared/
│   └── src/
│       ├── types/        # Player, PlayerId, Room, RoomStatus, GameState<TPublic>, PlayerView
│       ├── events/       # event adları + Zod şemaları
│       └── index.ts
├── server/
│   └── src/
│       ├── core/
│       │   ├── player/           # PlayerRegistry
│       │   ├── room/             # RoomRepository (arayüz) + InMemoryRoomRepository + RoomService
│       │   ├── connection/       # ConnectionManager (reconnect grace)
│       │   ├── turn/             # TurnTimer (jenerik, bu dilimde oyuna bağlı değil)
│       │   ├── view/             # toPlayerView
│       │   ├── errors/           # özel hata sınıfları
│       │   ├── config.ts         # env'den config
│       │   ├── logger.ts         # pino
│       │   └── rng.ts            # enjekte edilebilir crypto RNG
│       ├── games/                # boş (placeholder .gitkeep)
│       ├── socket/               # ince Socket.IO handler'ları
│       └── index.ts              # sunucu giriş noktası
├── client/
│   └── src/
│       ├── core/                 # NicknameEntry, Lobby, Room ekranları
│       ├── games/                # boş (placeholder)
│       ├── net/                  # typed socket-client sarmalayıcı
│       └── main.tsx
├── pnpm-workspace.yaml
├── package.json                  # kök; ortak script'ler
├── tsconfig.base.json
├── .gitignore
└── CLAUDE.md
```

Yeni oyun eklemek = `server/games/<oyun>/` + `client/games/<oyun>/` eklemek.
Çekirdek (`core/`) değişmemeli.

## `shared` paketi detayı

### `types/`
- `PlayerId` (branded string), `RoomCode` (string).
- `Player` — `{ id: PlayerId, nickname: string }`.
- `RoomStatus` — `'waiting' | 'playing' | 'finished'`.
- `Room` (sunucu-içi tam tip) — `{ code, ownerId, status, players: Player[], capacity }`.
- `GameState<TPublic>` — jenerik taban (bu dilimde minimal; oyun dilimi genişletir).
- `PlayerView` (lobi) — oyuncunun göreceği dilim:
  `{ room: { code, status, capacity, ownerId, players: Player[], you: PlayerId } }`.
  Bu dilimde gizli bilgi yok, ama "tam state ≠ gönderilen view" ayrımı baştan kurulur.

### `events/`
Zod şemaları event sözleşmesinin **kaynağıdır**; TS tipleri `z.infer` ile türetilir.

İstemci→Sunucu:
- `identify` — `{ token?: string, nickname: string }`
- `createRoom` — `{}` (capacity sabit/varsayılan; oyun dilimi değiştirir)
- `joinRoom` — `{ code: string }`
- `leaveRoom` — `{}`

Sunucu→İstemci:
- `identified` — `{ playerId: PlayerId, token: string }`
- `roomState` — `PlayerView`
- `errorEvent` — `{ code: string, message: string }`

## `server/core` detayı (katmanlı)

**Transport (ince).** `server/src/socket/`: Socket.IO handler'ları. Her gelen mesaj
ilgili Zod şemasıyla doğrulanır; geçersizse `ValidationError`. Doğrulanan veri
servise delege edilir. Handler iş mantığı içermez.

**Domain/servisler:**
- `PlayerRegistry` — token → `Player`. Token yoksa yeni oyuncu + yeni token üretir
  (crypto). `socket.id` **kimlik değildir**.
- `RoomRepository` (arayüz: `create`, `get`, `delete`, `update`) + `InMemoryRoomRepository`.
  Redis geçişi için kapı; Redis kurulmaz.
- `RoomService` — `createRoom(owner)`, `joinRoom(code, player)`, `leaveRoom(roomId, player)`.
  Doğrulamalar: oda var mı (`RoomNotFoundError`), dolu mu (`RoomFullError`),
  `status === 'waiting'` mi. Benzersiz oda kodu üretimi (RNG enjekte).
- `ConnectionManager` — `socket.id ↔ playerId` eşlemesi + reconnect grace period.
  Enjekte edilebilir clock/timer (test için). Kopuşta oyuncuyu "disconnected"
  işaretler ve grace timer başlatır; token ile dönerse koltuğa tekrar oturtur;
  süre dolarsa `RoomService.leaveRoom` çağırır.
- `TurnTimer` — jenerik sıra zaman aşımı altyapısı (start/clear, süre dolunca callback).
  Çekirdekte hazır; bu dilimde oyuna bağlı değil ama API'si test edilir.

**`toPlayerView(room, playerId): PlayerView`** — saf fonksiyon. Her oyuncuya kendi
görünümü ayrı üretilir; broadcast bile olsa "tüm state'i herkese gönder" yok.

**Özel hatalar** (`core/errors/`): `AppError` tabanı + `RoomFullError`,
`RoomNotFoundError`, `NotYourTurnError`, `InvalidMoveError`, `ValidationError`.
Her birinin `code`'u var. Handler wrapper'ı bunları yakalar → istemciye
`{ code, message }` (güvenli mesaj; stack/iç detay sızmaz). Beklenmeyen hatalar
generic `INTERNAL` koduna maplenir ve pino ile loglanır.

**Altyapı:**
- `logger.ts` — pino (console.log yok).
- `config.ts` — env'den: `PORT`, `GRACE_PERIOD_MS`, `TURN_TIMEOUT_MS`, `CLIENT_ORIGIN`.
- `rng.ts` — `Rng` arayüzü + crypto tabanlı varsayılan impl; testte seed'li impl enjekte.

## `client` detayı

- Token `localStorage`'da (`masa.playerToken`). Açılışta token varsa otomatik `identify`.
- Ekranlar (`client/src/core/`):
  - **NicknameEntry** — takma ad gir → `identify`.
  - **Lobby** — "Oda Kur" veya kod gir + "Katıl".
  - **Room** — `PlayerView`'i göster: oda kodu, oyuncular, sahip, durum, "Ayrıl".
- `client/src/net/` — `shared`'dan tip alan typed socket-client sarmalayıcı
  (event adları + payload tipleri derleme zamanında doğrulanır).

## Veri akışı

1. Socket bağlanır → istemci `identify{token?, nickname}` yollar → sunucu oyuncuyu
   oluşturur/yükler → `identified{playerId, token}` döner (istemci token'ı saklar).
2. `createRoom` → `RoomService` oda + benzersiz kod üretir, sahip=oyuncu →
   üyelere per-player `roomState` broadcast.
3. `joinRoom{code}` → doğrula → oyuncuyu ekle → her üyeye kendi `roomState`'i.
4. `disconnect` → `ConnectionManager` "disconnected" işaretler + grace timer başlatır.
   Token ile reconnect → socket yeniden bağlanır, koltuk korunur, `roomState`
   yeniden gönderilir. Grace dolarsa → `leaveRoom` + kalanlara güncel `roomState`.
5. `leaveRoom` → çıkar → kalanlara broadcast. Oda boşalırsa repository'den silinir.

## Hata yönetimi

- Sınır doğrulaması: Zod → `ValidationError` → güvenli mesaj.
- Domain hataları handler wrapper'ında yakalanır → `errorEvent{code, message}`.
- Sunucu istemci state'ine asla güvenmez; her hamle/işlem sunucuda doğrulanır.
- İstemciye stack/iç detay sızdırılmaz; beklenmeyenler `INTERNAL` + pino log.

## Test (Vitest)

- `RoomService`: kur / katıl / dolu (`RoomFullError`) / bulunamadı
  (`RoomNotFoundError`) / ayrıl / oda boşalınca silinir.
- `PlayerRegistry`: aynı token aynı oyuncuya çözülür; token yoksa yeni üretilir.
- `toPlayerView`: doğru dilim üretir, `you` doğru; pattern kurulur (sızıntı kontrolü).
- `ConnectionManager`: kopuş → grace içinde reconnect koltuğa oturtur; grace dolunca
  `leaveRoom` tetiklenir. **Fake timers + enjekte clock** ile deterministik.
- `RoomService` benzersiz kod üretimi: **seed'li RNG** ile deterministik test.
- Playwright E2E: bu dilimde **yok** (UI/oyun dilimine bırakıldı).

## Komutlar (kök `package.json`)

- `pnpm dev` — server + client eşzamanlı (concurrently).
- `pnpm typecheck` — tüm paketlerde `tsc --noEmit` (project references).
- `pnpm test` — Vitest birim testleri.
- `pnpm lint` — ESLint.
- `pnpm format` — Prettier.
- `pnpm build` — shared → server + client derleme.

Scaffold kapsamında `git init` (yapıldı) + `.gitignore` (node_modules, dist, .env, vb.).

## Araç kararları

- Lint/format: **ESLint + Prettier**.
- Oda katılma: **oda kodu** ile.
- Reconnect: altyapı çekirdekte + **fake timers ile birim testi**. Gerçek tarayıcı
  reconnect testi UI dilimine bırakıldı.

## Tamamlanma kriterleri (Definition of Done)

- `pnpm install`, `pnpm typecheck`, `pnpm lint`, `pnpm test`, `pnpm build` temiz geçer.
- `pnpm dev` ile: bir tarayıcıda takma ad gir → oda kur → kod al; ikinci tarayıcıda
  aynı kodla katıl → her iki oyuncu da kendi `PlayerView`'inde birbirini görür.
- Tüm Vitest testleri yeşil (reconnect grace dahil).
- Çekirdek kodu hiçbir oyuna bağlı değil; `games/` boş placeholder.
