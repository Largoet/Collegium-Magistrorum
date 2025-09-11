// src/services/focus.ts
import { sql } from '../lib/db';
import { rollLootForUser } from '../lib/loot';

/* =========================
   ÉTAT EN MÉMOIRE (UI)
   - suit les sessions lancées via panneaux (/handlers)
   ========================= */
const activeStarts = new Map<string, number>();

/* =========================
   hasRunning(userId)
   - utilisé par panelHandlers.ts pour savoir si une session est en cours
   ========================= */
export function hasRunning(userId: string): boolean {
  return activeStarts.has(userId);
}

/* =========================
   startFocusSession(...)
   Surcharges :
   1) startFocusSession(interaction, minutes, skill?, subject?)
      - appelé depuis les panneaux (UI)
   2) startFocusSession(userId, startedAt, targetMinutes?)
      - appelé depuis la commande /focus
   ========================= */
export function startFocusSession(
  a: any,
  b: number,
  c?: any,
  d?: any,
): { userId: string; startedAt: number; targetMinutes: number | null } {
  // --- Variante 2 : commande (/focus) ---
  if (typeof a === 'string') {
    const userId = a as string;
    const startedAt = b; // epoch seconds
    const targetMinutes = typeof c === 'number' ? c : null;

    // DB: création de la session
    sql.insertSession.run(userId, startedAt, targetMinutes);

    return { userId, startedAt, targetMinutes };
  }

  // --- Variante 1 : UI (panneaux) ---
  const interaction = a;
  const minutes = b;
  const userId: string = interaction.user?.id ?? interaction.member?.user?.id;
  const startedAt = Math.floor(Date.now() / 1000);
  const targetMinutes = typeof minutes === 'number' ? minutes : null;

  // Mémoire UI
  activeStarts.set(userId, startedAt);

  // DB: création de la session
  sql.insertSession.run(userId, startedAt, targetMinutes);

  return { userId, startedAt, targetMinutes };
}

/* =========================
   endFocusSession(userId, houseRoleId, startedAt)
   - appelé par la commande /focus
   - crédite or/XP puis tente un loot en fonction de la durée
   ========================= */
export function endFocusSession(
  userId: string,
  houseRoleId: string | null,
  startedAt: number, // epoch seconds
): { gold: number; xp: number; durationMin: number; drop: null | { key: string; name: string; rarity: string; emoji?: string } } {
  // Nettoie l'état UI si la session venait d'un panneau
  activeStarts.delete(userId);

  const now = Math.floor(Date.now() / 1000);
  const durationMin = Math.max(0, Math.floor((now - startedAt) / 60));

  // --- Récompenses or / xp (formules simples ; garde les tiennes si besoin) ---
  const gold = calcGoldFromDuration(durationMin);
  const xp = calcXPFromDuration(durationMin);

  sql.addGold.run(gold, userId);
  if (houseRoleId) {
    sql.insertXPWithHouse.run(userId, xp, now, houseRoleId);
  } else {
    sql.insertXP.run(userId, xp, now);
  }

  // --- Tirage de loot Focus (seuils encodés dans loot.ts) ---
  const drop = rollLootForUser(userId, houseRoleId ?? undefined, {
    source: 'focus',
    minutes: durationMin,
  });

  if (drop) {
    sql.insertLoot.run(userId, drop.key, houseRoleId, drop.rarity, now);
  }

  return { gold, xp, durationMin, drop: drop ?? null };
}

/* =========================
   Utilitaires récompenses
   ========================= */
function calcGoldFromDuration(min: number): number {
  if (min <= 0) return 0;
  return Math.max(1, Math.floor(min / 5));
}

function calcXPFromDuration(min: number): number {
  if (min <= 0) return 0;
  return Math.max(2, Math.floor((min / 5) * 2));
}
