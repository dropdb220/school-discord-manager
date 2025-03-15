import { REST, Routes } from 'discord.js';
import dotenv from 'dotenv';
import fs from 'node:fs/promises';
import path from 'node:path';

dotenv.config();

const files = (await fs.readdir('./dist/bot/commands')).filter(file => file.endsWith('.js'));
const commands = [];

for (const file of files) {
    const { default: cmd } = await import(`./commands/${file}`);
    if (cmd.data && cmd.run) {
        commands.push(cmd.data);
    }
}

const rest = new REST().setToken(process.env.TOKEN!);

try {
    console.log(`Started refreshing ${commands.length} application (/) commands.`);
    const data = await rest.put(
        Routes.applicationGuildCommands(process.env.CLIENT_ID!, process.env.GUILD_ID!),
        { body: commands },
    );
    console.log(`Successfully reloaded ${(data as any).length} application (/) commands.`);
} catch (error) {
    console.error(error);
}