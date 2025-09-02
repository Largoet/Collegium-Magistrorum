// Chargement des variables d'env + validation.
// TODO: dotenv + zod.

import 'dotenv/config';
import { z } from 'zod';

const Env = z.object({
  DISCORD_TOKEN: z.string().min(1, 'DISCORD_TOKEN manquant'),
  APPLICATION_ID: z.string().min(1, 'APPLICATION_ID manquant'),
  GUILD_ID: z.string().min(1, 'GUILD_ID manquant'),
  DB_FILE: z.string().default('./data/bot.db')
});

export const env = Env.parse(process.env);
