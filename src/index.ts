import Discord from 'discord.js';
import dotenv from 'dotenv';
import startServer from './server';

dotenv.config();

const client = new Discord.Client({ intents: [Discord.GatewayIntentBits.Guilds] });

client.on('ready', () => {
    console.log('Login:', client.user?.tag);
    startServer(client);
});

client.login(process.env.TOKEN);