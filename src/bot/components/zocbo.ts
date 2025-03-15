import * as Discord from 'discord.js';
import fetch from 'node-fetch';
import iconv from 'iconv-lite';

export default {
    customId: /zocbo-((approve)|(reject))-[0-9]+/,
    run: async (client: Discord.Client, interaction: Discord.ButtonInteraction | Discord.StringSelectMenuInteraction) => {
        await interaction.reply({
            embeds: [
                new Discord.EmbedBuilder()
                    .setTitle('Processing...')
                    .setColor(Discord.Colors.Yellow)
                    .setTimestamp()
            ], flags: [Discord.MessageFlags.Ephemeral], withResponse: true
        });
        const isApproved = interaction.customId.includes('approve');
        const userId = interaction.customId.split('-')[2];
        const user = await client.users.fetch(userId);
        const guild = await client.guilds.fetch(process.env.GUILD_ID!);
        const member = await guild.members.fetch(user.id);
        const origMsg = await interaction.channel!.messages.fetch(interaction.message.id);
        const title = origMsg.embeds[0].fields[0].value;
        if (!member.roles.cache.has(process.env.PDF_ROLE_ID!)) {
            await interaction.editReply({
                embeds: [
                    new Discord.EmbedBuilder()
                        .setTitle('Unauthorized')
                        .setDescription('You are not authorized to approve or reject PDFs.')
                        .setColor(Discord.Colors.Red)
                        .setTimestamp()
                ]
            });
            return;
        }
        if (isApproved) {
            const oneDrvTokenRequest = await fetch(`https://login.microsoftonline.com/${process.env.ONEDRIVE_TENANT}/oauth2/v2.0/token`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/x-www-form-urlencoded'
                },
                body: new URLSearchParams({
                    client_id: process.env.ONEDRIVE_CLIENT_ID || '',
                    scope: 'https://graph.microsoft.com/.default',
                    grant_type: 'refresh_token',
                    refresh_token: process.env.ONEDRIVE_REFRESH_TOKEN || '',
                    client_secret: process.env.ONEDRIVE_CLIENT_SECRET || ''
                })
            }).then((response) => response.json()) as any;
            if (!oneDrvTokenRequest.access_token) {
                await interaction.editReply({
                    embeds: [
                        new Discord.EmbedBuilder()
                            .setTitle('Failed to access downloaded PDFs')
                            .setColor(Discord.Colors.Red)
                            .setTimestamp()
                    ]
                });
                return;
            }
            const onedrvFile = await fetch(`https://graph.microsoft.com/v1.0/me/drive/root:/zocbo/${encodeURIComponent(title)}.pdf`, {
                headers: {
                    Authorization: `Bearer ${oneDrvTokenRequest.access_token}`
                }
            }).then((response) => response.json()) as any;
            if (onedrvFile.error) {
                await interaction.editReply({
                    embeds: [
                        new Discord.EmbedBuilder()
                            .setTitle('PDF Not Found')
                            .setDescription('The PDF is currently not downloaded. Upload the file and try again.')
                            .setColor(Discord.Colors.Red)
                            .setTimestamp()
                    ]
                });
            } else {
                await user.send({
                    embeds: [
                        new Discord.EmbedBuilder()
                            .setTitle('PDF Downloaded')
                            .setDescription('The PDF you requested has been approved and is now available for use.')
                            .addFields([
                                { name: 'Title', value: title },
                                { name: 'Download', value: `[Click Here](${onedrvFile['@microsoft.graph.downloadUrl']})` }
                            ])
                            .setColor(Discord.Colors.Green)
                            .setTimestamp()
                    ]
                })
                await interaction.deleteReply();
                await origMsg.edit({
                    embeds: [
                        new Discord.EmbedBuilder()
                            .setTitle('PDF Approved')
                            .setDescription('The PDF has been approved and is now available for use. Its download link has been sent to the user.')
                            .addFields([
                                { name: 'Title', value: title },
                                { name: 'Download', value: `[Click Here](${onedrvFile['@microsoft.graph.downloadUrl']})` }
                            ])
                            .setColor(Discord.Colors.Green)
                            .setTimestamp()
                    ],
                    components: []
                });
            }
        } else {
            await user.send({
                embeds: [
                    new Discord.EmbedBuilder()
                        .setTitle('PDF Rejected')
                        .setDescription('The PDF you requested has been rejected and will not be uploaded.')
                        .addFields([
                            { name: 'Title', value: title },
                            { name: 'Reason', value: (interaction as Discord.StringSelectMenuInteraction).values[0] }
                        ])
                        .setColor(Discord.Colors.Red)
                        .setTimestamp()
                ]
            });
            await interaction.deleteReply();
            await origMsg.edit({
                embeds: [
                    new Discord.EmbedBuilder()
                        .setTitle('PDF Rejected')
                        .setDescription('The PDF has been rejected and will not be uploaded. A message has been sent to the user.')
                        .addFields([
                            { name: 'Title', value: title },
                            { name: 'Reason', value: (interaction as Discord.StringSelectMenuInteraction).values[0] }
                        ])
                        .setColor(Discord.Colors.Red)
                        .setTimestamp()
                ],
                components: []
            });
        }
    }
}