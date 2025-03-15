import * as Discord from 'discord.js';

export default async function unverify(client: Discord.Client, id: string) {
    const guild = await client.guilds.fetch(process.env.GUILD_ID as string)
    const member = await guild.members.fetch(id)
    await member.roles.remove(process.env.ROLE_ID as string);
}