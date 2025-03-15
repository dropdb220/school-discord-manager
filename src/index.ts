import * as Discord from 'discord.js';
import dotenv from 'dotenv';
import fs from 'node:fs/promises';
import startServer from './server/index.js';

dotenv.config();

const client = new Discord.Client({ intents: [Discord.GatewayIntentBits.Guilds] });

const commands: Array<{ data: Discord.SlashCommandBuilder, run: (client: Discord.Client, interaction: Discord.CommandInteraction) => void }> = [];
const cmdFiles = (await fs.readdir('./dist/bot/commands')).filter((file) => file.endsWith('.js'));
for (const file of cmdFiles) {
    const command = await import(`./bot/commands/${file}`);
    commands.push(command.default);
    console.log('Command', command.default.data.name, 'loaded');
}
console.log('----------');

const components: Array<{ customId: RegExp, run: (client: Discord.Client, interaction: Discord.Interaction) => void }> = [];
const cpntFiles = (await fs.readdir('./dist/bot/components')).filter((file) => file.endsWith('.js'));
for (const file of cpntFiles) {
    const component = await import(`./bot/components/${file}`);
    components.push(component.default);
    console.log('Component', component.default.customId.source, 'loaded');
}
console.log('----------')

client.on('ready', () => {
    console.log('Login:', client.user?.tag);
    console.log('----------')
    startServer(client);
});

client.on('interactionCreate', async (interaction) => {
    if (!interaction.isCommand()) return;
    if (!interaction.guild) return;
    if (!interaction.member) return;
    const run = commands.find((command) => command.data.name === interaction.commandName)?.run;
    if (!run) return;
    run(client, interaction);
});

client.on('interactionCreate', async (interaction) => {
    if (interaction.isCommand() || interaction.isAutocomplete()) return;
    if (!interaction.guild) return;
    if (!interaction.member) return;
    if (interaction.channelId !== process.env.ZOCBO_CHANNEL_ID) return;
    const run = components.find((component) => component.customId.test(interaction.customId))?.run;
    if (!run) return;
    run(client, interaction);
});

client.login(process.env.TOKEN);