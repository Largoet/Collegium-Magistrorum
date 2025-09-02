// src/index.ts
import { Client, Collection, GatewayIntentBits, REST, Routes, Events } from 'discord.js';
import { env } from './lib/config';
import * as ping from './commands/ping';
import * as focus from './commands/focus';
import * as profile from './commands/profile';
import './lib/db';

const client = new Client({ intents: [GatewayIntentBits.Guilds] });

// registre des commandes
const commands = new Collection<string, any>([
  [ping.data.name, ping],
  [focus.data.name, focus],
  [profile.data.name, profile],
]);

async function registerSlashCommands() {
  const rest = new REST({ version: '10' }).setToken(env.DISCORD_TOKEN);
  const body = [ping.data, focus.data, profile.data].map(c => c.toJSON());
  await rest.put(
    Routes.applicationGuildCommands(env.APPLICATION_ID, env.GUILD_ID),
    { body }
  );
  console.log('✅ Slash commands registered for guild', env.GUILD_ID);
}

client.once(Events.ClientReady, (c) => {
  console.log(`🤖 Logged in as ${c.user.tag}`);
});

client.on('interactionCreate', async (interaction) => {
  if (!interaction.isChatInputCommand()) return;
  const cmd = commands.get(interaction.commandName);
  if (!cmd) return;
  try {
    await cmd.execute(interaction);
  } catch (err) {
    console.error(err);
    const msg = 'Une erreur est survenue.';
    if (interaction.deferred || interaction.replied) {
      await interaction.followUp({ content: msg, ephemeral: true });
    } else {
      await interaction.reply({ content: msg, ephemeral: true });
    }
  }
});

(async () => {
  await registerSlashCommands();
  await client.login(env.DISCORD_TOKEN);
})();
