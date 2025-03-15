import * as Discord from 'discord.js';
import fetch from 'node-fetch';
import iconv from 'iconv-lite';

export default {
    data: new Discord.SlashCommandBuilder()
        .setName('zocbo')
        .setDescription('Download/Request PDF from zocbo.com')
        .addStringOption((option) =>
            option.setName('url')
                .setDescription('URL of the zocbo.com download popup')
                .setRequired(true)),
    run: async (client: Discord.Client, interaction: Discord.CommandInteraction) => {
        const initialResponse = await interaction.reply({
            embeds: [
                new Discord.EmbedBuilder()
                    .setTitle('Processing...')
                    .setColor(Discord.Colors.Yellow)
                    .setTimestamp()
            ], flags: [Discord.MessageFlags.Ephemeral], withResponse: true
        });
        const urlValue = interaction.options.get('url');
        if (!urlValue || !urlValue.value) return;
        const url = urlValue.value as string;
        if (!url.match(/https?:\/\/(www\.)?zocbo\.com\//)) {
            await interaction.editReply({
                embeds: [
                    new Discord.EmbedBuilder()
                        .setTitle('Invalid URL')
                        .setColor(Discord.Colors.Red)
                        .setTimestamp()
                ]
            });
            return;
        }
        const response = await fetch(url);
        if (!response.ok) {
            await interaction.editReply({
                embeds: [
                    new Discord.EmbedBuilder()
                        .setTitle('Failed to fetch data from the URL specified')
                        .setColor(Discord.Colors.Red)
                        .setTimestamp()
                ]
            });
            return;
        }
        const data = await response.arrayBuffer();
        const u8Data = iconv.decode(Buffer.from(data), 'euc-kr');
        const match = u8Data.match(/<p class="title">(.*)<\/p>/)![0].replace("<p class=\"title\">", "").replace("</p>", "");
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
        const onedrvFile = await fetch(`https://graph.microsoft.com/v1.0/me/drive/root:/zocbo/${encodeURIComponent(match)}.pdf`, {
            headers: {
                Authorization: `Bearer ${oneDrvTokenRequest.access_token}`
            }
        }).then((response) => response.json()) as any;
        if (onedrvFile.error) {
            const row = new Discord.ActionRowBuilder()
                .addComponents(
                    new Discord.ButtonBuilder()
                        .setCustomId('request')
                        .setLabel('Yes')
                        .setStyle(Discord.ButtonStyle.Primary),
                    new Discord.ButtonBuilder()
                        .setCustomId('cancel')
                        .setLabel('No')
                        .setStyle(Discord.ButtonStyle.Danger)
                )
            await interaction.editReply({
                embeds: [
                    new Discord.EmbedBuilder()
                        .setTitle('Request PDF')
                        .setDescription('The file you requested hasn\'t been downloaded by other users yet. Do you want to request the file?')
                        .addFields([
                            { name: 'Title', value: match },
                            { name: 'URL', value: url }
                        ])
                        .setColor(Discord.Colors.Yellow)
                        .setTimestamp()
                ],
                // @ts-ignore
                components: [row]
            });
            try {
                const collector = await initialResponse.resource!.message!.awaitMessageComponent({
                    filter: (i: Discord.Interaction) => i.user.id === interaction.user.id,
                    time: 60000
                });
                if (collector.customId === 'request') {
                    client.channels.fetch(process.env.ZOCBO_CHANNEL_ID!).then(async (channel) => {
                        await (channel as Discord.TextChannel).send({
                            content: `<@&${process.env.MOD_ROLE_ID}>`,
                            embeds: [
                                new Discord.EmbedBuilder()
                                    .setTitle('New Zocbo Request')
                                    .setDescription("Confirm that the PDF has owner password removed before uploading.")
                                    .addFields([
                                        { name: 'Title', value: match },
                                        { name: 'URL', value: url }
                                    ])
                                    .setColor(Discord.Colors.Yellow)
                                    .setTimestamp()
                            ],
                            components: [
                                // @ts-ignore
                                new Discord.ActionRowBuilder()
                                    .addComponents(
                                        new Discord.ButtonBuilder()
                                            .setCustomId(`zocbo-approve-${interaction.user.id}`)
                                            .setLabel('Approve')
                                            .setStyle(Discord.ButtonStyle.Success)
                                    ),
                                // @ts-ignore
                                new Discord.ActionRowBuilder()
                                    .addComponents(
                                        new Discord.StringSelectMenuBuilder()
                                            .setCustomId(`zocbo-reject-${interaction.user.id}`)
                                            .setPlaceholder('Rejection Reason')
                                            .addOptions([
                                                new Discord.StringSelectMenuOptionBuilder()
                                                    .setLabel('Too many requests')
                                                    .setValue('Too many requests'),
                                                new Discord.StringSelectMenuOptionBuilder()
                                                    .setLabel('Invalid URL')
                                                    .setValue('Invalid URL')
                                            ])
                                    )
                            ]
                        });
                        await interaction.editReply({
                            embeds: [
                                new Discord.EmbedBuilder()
                                    .setTitle('Request Sent')
                                    .setDescription('Your request has been sent to the moderators. Please wait for their response.')
                                    .setColor(Discord.Colors.Blurple)
                                    .setTimestamp()
                            ],
                            components: []
                        });
                    });
                } else {
                    await interaction.editReply({
                        embeds: [
                            new Discord.EmbedBuilder()
                                .setTitle('Request Cancelled')
                                .setColor(Discord.Colors.Red)
                                .setTimestamp()
                        ],
                        components: []
                    });
                }
            } catch {
                interaction.editReply({
                    embeds: [
                        new Discord.EmbedBuilder()
                            .setTitle('Request Timeout')
                            .setColor(Discord.Colors.Red)
                            .setTimestamp()
                    ],
                    components: []
                });
            }
        } else {
            await interaction.editReply({
                embeds: [
                    new Discord.EmbedBuilder()
                        .setTitle('Downloaded PDF')
                        .setDescription('The file you requested has already been downloaded by other users. You can download it from the link below.')
                        .addFields([
                            { name: 'Title', value: match },
                            { name: 'Download', value: `[Click Here](${onedrvFile['@microsoft.graph.downloadUrl']})` }
                        ])
                        .setColor(Discord.Colors.Green)
                        .setTimestamp()
                ]
            });
        }
    }
}