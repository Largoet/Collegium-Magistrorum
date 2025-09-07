// src/commands/focus.ts
import { SlashCommandBuilder, ChatInputCommandInteraction } from 'discord.js';
import { startFocusSession } from '../services/focus';

export const data = new SlashCommandBuilder()
  .setName('focus')
  .setDescription('Lancer une session de focus (avec validation ou interruption)')
  .addIntegerOption(o =>
    o.setName('minutes').setDescription('Durée (ex. 25)').setRequired(true)
      .addChoices({ name: '15', value: 15 }, { name: '25', value: 25 }, { name: '45', value: 45 }, { name: '60', value: 60 })
  )
  .addStringOption(o => o.setName('competence').setDescription('Compétence (ex. Lecture, Docker)').setRequired(false))
  .addStringOption(o => o.setName('sujet').setDescription('Sujet / note (optionnel)').setRequired(false));

export async function execute(i: ChatInputCommandInteraction) {
  const minutes = i.options.getInteger('minutes', true);
  const skill = (i.options.getString('competence') || 'Général').trim();
  const subject = (i.options.getString('sujet') || '').trim();
  await startFocusSession(i, minutes, skill, subject);
}
