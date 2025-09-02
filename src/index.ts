// Point d’entrée du bot.
// TODO: créer le client Discord, enregistrer les slash-commands, router vers /ping /focus /profile.
import { Client, Collection, GatewayIntentBits, REST, Routes, Events } from 'discord.js';
import { env } from './lib/config';
import * as ping from './commands/ping';
import './lib/db'; // side-effect: crée les tables si absentes


const client = new Client({ intents: [GatewayIntentBits.Guilds] });

// registre des commandes
const commands = new Collection<string, any>([[ping.data.name, ping]]);

async function registerSlashCommands() {
  const rest = new REST({ version: '10' }).setToken(env.DISCORD_TOKEN);
  const body = [ping.data.toJSON()];
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
