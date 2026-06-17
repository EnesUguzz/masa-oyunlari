// Maps server error codes to friendly Turkish messages for the UI banner.
const MESSAGES: Record<string, string> = {
  WRONG_PHASE: "Şu an bu hamleyi yapamazsın (yanlış aşama).",
  ILLEGAL_DRAW: "Bu taşı çekemezsin.",
  ALREADY_OPENED: "Bu el zaten açtın.",
  NOT_OPENED: "Önce el açman gerekiyor.",
  OPENING_THRESHOLD_NOT_MET: "Açmak için yeterli puanın yok (en az 101 gerekir).",
  MODE_LOCKED: "Bu el açtığın moda (per/çift) kilitlisin.",
  FLOOR_TILE_UNUSED: "Yerden aldığın taşı bu el bir pere/çifte kullanmalısın.",
  TILE_NOT_IN_HAND: "O taş elinde yok.",
  NOT_YOUR_TURN: "Sıra sende değil.",
  ROOM_FULL: "Oda dolu.",
  VALIDATION: "Geçersiz istek.",
  INTERNAL: "Beklenmeyen bir sunucu hatası oluştu.",
};

export function turkishError(code: string, fallback: string): string {
  return MESSAGES[code] ?? fallback;
}
