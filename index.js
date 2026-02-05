const { Client, GatewayIntentBits, EmbedBuilder, REST, Routes, SlashCommandBuilder } = require('discord.js');
const axios = require('axios');

const DISCORD_TOKEN = process.env.DISCORD_TOKEN;
const BOT_API_URL = process.env.BOT_API_URL;
const CLIENT_ID = process.env.CLIENT_ID;

if (!DISCORD_TOKEN || !BOT_API_URL || !CLIENT_ID) {
    console.error('❌ Missing environment variables!');
    process.exit(1);
}

const client = new Client({
    intents: [
        GatewayIntentBits.Guilds,
        GatewayIntentBits.GuildMessages,
        GatewayIntentBits.MessageContent
    ]
});

const commands = [
    new SlashCommandBuilder().setName('vouch').setDescription('Vouching information'),
    new SlashCommandBuilder().setName('website').setDescription('Website link'),
    new SlashCommandBuilder().setName('rewards').setDescription('Rewards info'),
    new SlashCommandBuilder().setName('rules').setDescription('📜 View server rules'),
    new SlashCommandBuilder().setName('prices').setDescription('💰 View our prices'),
    new SlashCommandBuilder().setName('payment').setDescription('💳 View payment methods'),
    new SlashCommandBuilder().setName('sell').setDescription('💸 Sell to us'),
    new SlashCommandBuilder().setName('domain').setDescription('🌐 Website information'),
    new SlashCommandBuilder().setName('add').setDescription('Add bot').addStringOption(o => o.setName('token').setDescription('Token').setRequired(true)),
    new SlashCommandBuilder().setName('remove').setDescription('Remove bot').addStringOption(o => o.setName('botid').setDescription('Bot ID').setRequired(true)),
    new SlashCommandBuilder().setName('stopall').setDescription('Stop all bots'),
    new SlashCommandBuilder().setName('status').setDescription('Bot status'),
    new SlashCommandBuilder().setName('list').setDescription('List bots'),
    new SlashCommandBuilder().setName('help').setDescription('Show commands'),
    new SlashCommandBuilder().setName('forcemsg').setDescription('Force ALL bots to message player').addStringOption(o => o.setName('player').setDescription('Player name').setRequired(true)),
    new SlashCommandBuilder().setName('stopforce').setDescription('Stop force messaging and resume queue'),
].map(c => c.toJSON());

const rest = new REST({ version: '10' }).setToken(DISCORD_TOKEN);

(async () => {
    try {
        await rest.put(Routes.applicationCommands(CLIENT_ID), { body: commands });
        console.log('✅ Commands registered');
    } catch (error) {
        console.error('❌ Failed:', error);
    }
})();

async function callBotAPI(endpoint, data = {}) {
    try {
        const response = await axios.post(`${BOT_API_URL}${endpoint}`, data, {
            headers: { 'Content-Type': 'application/json' },
            timeout: 30000
        });
        return response.data;
    } catch (error) {
        throw new Error(error.response?.data?.error || error.message);
    }
}

function generateBotId() {
    return 'bot_' + Date.now().toString().slice(-6);
}

client.on('ready', () => {
    console.log(`✅ ${client.user.tag}`);
    client.user.setActivity('/help for commands', { type: 3 });
});

client.on('interactionCreate', async interaction => {
    if (!interaction.isChatInputCommand()) return;

    try {
        switch (interaction.commandName) {
            case 'sell': {
                const embed = new EmbedBuilder()
                    .setColor(0xf39c12)
                    .setTitle('💸 Sell to Us')
                    .setDescription('**We buy your items at competitive rates!**')
                    .addFields(
                        { 
                            name: '💀 Skeleton Spawner Prices', 
                            value: '```\n1 Spawner = €0.06```', 
                            inline: false 
                        },
                        { 
                            name: '💵 Money Prices', 
                            value: '```\n1M = €0.03```', 
                            inline: false 
                        },
                        { 
                            name: '\u200B', 
                            value: '━━━━━━━━━━━━━━━━━━━━━━━━━━', 
                            inline: false 
                        },
                        { 
                            name: '📩 How to Sell', 
                            value: 'Create a ticket in <#1442921292977279117> to sell your items!', 
                            inline: false 
                        },
                        { 
                            name: '\u200B', 
                            value: '🌐 **[Visit DonutMarket](https://www.donutmarket.eu/)**', 
                            inline: false 
                        }
                    )
                    .setFooter({ text: 'Fast & Fair Payments' })
                    .setTimestamp();

                await interaction.reply({ embeds: [embed] });
                break;
            }

            case 'domain': {
    const embed = new EmbedBuilder()
        .setColor(0x3498db)
        .setTitle('🌐 Website Information')
        .setDescription('**Important Purchase Information**')
        .addFields(
            { 
                name: '💰 In-Game Currency Purchases', 
                value: 'If you purchase in-game currency from our website, there is no need to create a ticket. The money will be paid out instantly or as soon as we are available.', 
                inline: false 
            },
            { 
                name: '🎁 Spawners & Elytras', 
                value: 'If you purchase spawners or elytras, you must create a ticket and include your in-game name. We will then give you your items immediately or when we are available.', 
                inline: false 
            },
            { 
                name: '\u200B', 
                value: '━━━━━━━━━━━━━━━━━━━━━━━━━━', 
                inline: false 
            },
            { 
                name: '🔗 Visit Our Website', 
                value: '[Click here to visit DonutMarket](https://www.donutmarket.eu/)', 
                inline: false 
            }
        )
        .setFooter({ text: 'Instant Delivery' })
        .setTimestamp();

    await interaction.reply({ embeds: [embed] });
    break;
}

            case 'rules': {
                const embed = new EmbedBuilder()
                    .setColor(0xff6b6b)
                    .setTitle('📜 Server Rules')
                    .setDescription('**Please follow all the rules listed below**')
                    .addFields(
                        { 
                            name: '🌍 Rule 1: English Only', 
                            value: 'All text channels are English only. Mods must be able to read all messages clearly.', 
                            inline: false 
                        },
                        { 
                            name: '💬 Rule 2: Stay On Topic', 
                            value: 'Keep all discussion civil and in the correct channels. Mods may ask you to move your conversation.', 
                            inline: false 
                        },
                        { 
                            name: '🤝 Rule 3: No Inappropriate Language', 
                            value: 'Remain respectful of others at all times.', 
                            inline: false 
                        },
                        { 
                            name: '🚫 Rule 4: No Personal Drama', 
                            value: 'Keep personal drama out of chat.', 
                            inline: false 
                        },
                        { 
                            name: '👤 Rule 5: No Impersonation', 
                            value: 'Do not impersonate other users, moderators, and/or famous personalities.', 
                            inline: false 
                        },
                        { 
                            name: '📢 Rule 6: No Spamming', 
                            value: 'Do not flood chat rooms with messages. Encouraging others to spam is also not allowed.', 
                            inline: false 
                        },
                        { 
                            name: '🔞 Rule 7: No NSFW Content', 
                            value: 'Do not post or have conversations around NSFW content.', 
                            inline: false 
                        },
                        { 
                            name: '🎨 Rule 8: Appropriate Profiles', 
                            value: 'No inappropriate or offensive usernames, status, or profile pictures. You may be asked to change these.', 
                            inline: false 
                        },
                        { 
                            name: '🚷 Rule 9: No Self-Promotion', 
                            value: 'No self-promotion, soliciting, or advertising. This also includes user DMs.', 
                            inline: false 
                        },
                        { 
                            name: '🔗 Rule 10: No Malicious Links', 
                            value: 'Any link that tracks IP addresses or leads to malicious websites will be removed.', 
                            inline: false 
                        },
                        { 
                            name: '🛡️ Rule 11: Don\'t Evade Filters', 
                            value: 'This applies to both words and links. If something is censored, it\'s censored for a reason!', 
                            inline: false 
                        },
                        { 
                            name: '📋 Rule 12: Follow Discord ToS', 
                            value: '[Terms of Service](https://discordapp.com/terms) • [Community Guidelines](https://discord.com/guidelines)', 
                            inline: false 
                        },
                        { 
                            name: '👮 Rule 13: Moderators Hold Final Say', 
                            value: 'Listen to and respect the volunteers that keep this server running.', 
                            inline: false 
                        },
                        { 
                            name: '🔕 Rule 14: Don\'t Ping Staff', 
                            value: 'Do not mention staff or owners unnecessarily.', 
                            inline: false 
                        }
                    )
                    .setFooter({ text: 'Thank you for following the rules!' })
                    .setTimestamp();

                await interaction.reply({ embeds: [embed] });
                break;
            }

            case 'prices': {
                const embed = new EmbedBuilder()
                    .setColor(0x4ecdc4)
                    .setTitle('💰 DonutMarket Prices')
                    .setDescription('**DonutMarket • Trusted Service**')
                    .addFields(
                        { 
                            name: '💀 Skeleton Spawner Prices', 
                            value: '```\n1 Spawner = €0.23\n━━━━━━━━━━━━━━━━━\n100 Spawners  → €23.00\n200 Spawners  → €46.00\n400 Spawners  → €92.00\n800 Spawners  → €184.00\n1000 Spawners → €230.00```', 
                            inline: false 
                        },
                        { 
                            name: '💵 In-Game Money Prices', 
                            value: '```\n1M = €0.08\n━━━━━━━━━━━━━━━━━\n100M  → €8.00\n250M  → €20\n500M  → €45.00\n750M  → €60.00\n1B    → €80.00```', 
                            inline: false 
                        },
                        { 
                            name: '🦅 Elytra Prices', 
                            value: '```\n1 Elytra → €40.00```', 
                            inline: true 
                        },
                        { 
                            name: '🎮 Minecraft Account', 
                            value: '```\nJava & Bedrock → €15.00```', 
                            inline: true 
                        },
                        { 
                            name: '\u200B', 
                            value: '━━━━━━━━━━━━━━━━━━━━━━━━━━', 
                            inline: false 
                        },
                        { 
                            name: '📝 Important Information', 
                            value: '**💶 Minimum Order:** €5.00\n**🕐 Timezone:** GMT+2\n**📧 Support:** Open a ticket in <#1442921292977279117>\n\n🌐 **[Visit DonutMarket](https://www.donutmarket.eu/)**', 
                            inline: false 
                        }
                    )
                    .setFooter({ text: 'All prices in EUR (€)' })
                    .setTimestamp();

                await interaction.reply({ embeds: [embed] });
                break;
            }

            case 'payment': {
                const embed = new EmbedBuilder()
                    .setColor(0x95e1d3)
                    .setTitle('💳 Payment Methods')
                    .setDescription('**Choose your preferred payment method**')
                    .addFields(
                        { 
                            name: '🌐 Website Purchases', 
                            value: '**Supports almost all payment methods**\n\n✅ Credit/Debit Cards\n✅ PayPal\n✅ Crypto\n✅ Local Payment Methods\n\n⚠️ *A small service fee is included in website prices*\n\n🔗 **[Visit Website](https://www.donutmarket.eu/)**', 
                            inline: false 
                        },
                        { 
                            name: '💬 Discord Purchases', 
                            value: '**PayPal Friends & Family**\n\n✅ **No fees** when buying through Discord\n✅ Instant delivery\n✅ Direct support from our team\n\n📩 **How to purchase:**\nOpen a ticket in <#1442921292977279117> and our team will help you out!', 
                            inline: false 
                        },
                        { 
                            name: '\u200B', 
                            value: '━━━━━━━━━━━━━━━━━━━━━━━━━━', 
                            inline: false 
                        },
                        { 
                            name: '💡 Why Buy Through Discord?', 
                            value: '🚀 Faster processing\n💰 No extra fees\n🛡️ Direct support\n✨ Better communication', 
                            inline: true 
                        },
                        { 
                            name: '⏱️ Processing Time', 
                            value: '⚡ Usually **5-30 minutes**\n🌙 May vary during off-hours\n📍 Timezone: **GMT+2**', 
                            inline: true 
                        },
                        { 
                            name: '\u200B', 
                            value: '\u200B', 
                            inline: false 
                        },
                        { 
                            name: '❤️ Thank You!', 
                            value: 'Thank you for supporting the server!', 
                            inline: false 
                        }
                    )
                    .setFooter({ text: 'All transactions are safe and secure' })
                    .setTimestamp();

                await interaction.reply({ embeds: [embed] });
                break;
            }

            case 'vouch': {
                await interaction.reply({ embeds: [new EmbedBuilder().setColor(0x00ff00).setTitle('⭐ Thank You for your purchase!').setDescription('Please vouch at <#1449355333637115904>').setTimestamp()] });
                break;
            }

            case 'website': {
                await interaction.reply({ embeds: [new EmbedBuilder().setColor(0x0099ff).setTitle('🌐 Website').setDescription('[Visit DonutMarket](https://www.donutmarket.eu/)').setTimestamp()] });
                break;
            }

            case 'rewards': {
                await interaction.reply({ embeds: [new EmbedBuilder().setColor(0xffd700).setTitle('🎁 Rewards').setDescription('Thank you for inviting! Please leave a vouch at <#1447280588842336368>').setTimestamp()] });
                break;
            }

            case 'add': {
                const token = interaction.options.getString('token');
                const botId = generateBotId();
                await interaction.deferReply();
                
                try {
                    const result = await callBotAPI('/add', { username: botId, token });
                    await interaction.editReply({ embeds: [new EmbedBuilder().setColor(0x00ff00).setTitle('✅ Bot Started').addFields({ name: 'Bot ID', value: `\`${botId}\``, inline: true }, { name: 'Username', value: result.mcUsername || 'Unknown', inline: true }).setTimestamp()] });
                } catch (error) {
                    await interaction.editReply(`❌ ${error.message}`);
                }
                break;
            }

            case 'remove': {
                const removeId = interaction.options.getString('botid');
                try {
                    await callBotAPI('/remove', { username: removeId });
                    await interaction.reply(`✅ Stopped ${removeId}`);
                } catch (error) {
                    await interaction.reply(`❌ ${error.message}`);
                }
                break;
            }

            case 'stopall': {
                await interaction.deferReply();
                try {
                    const result = await callBotAPI('/stopall', {});
                    await interaction.editReply(`⛔ Stopped ${result.stopped} bot(s)`);
                } catch (error) {
                    await interaction.editReply(`❌ ${error.message}`);
                }
                break;
            }

            case 'status': {
                try {
                    const response = await axios.get(`${BOT_API_URL}/status`, { timeout: 10000 });
                    const { online = 0, total = 0 } = response.data;
                    await interaction.reply({ embeds: [new EmbedBuilder().setColor(0x0099ff).setTitle('📊 Status').setDescription(`**Bots:** ${online}/${total} online`).setTimestamp()] });
                } catch (error) {
                    await interaction.reply(`❌ ${error.message}`);
                }
                break;
            }

            case 'list': {
                try {
                    const response = await axios.get(`${BOT_API_URL}/status`, { timeout: 10000 });
                    const { online = 0, total = 0 } = response.data;
                    await interaction.reply(`📋 **Bots:** ${online}/${total} online`);
                } catch (error) {
                    await interaction.reply(`❌ ${error.message}`);
                }
                break;
            }

            case 'forcemsg': {
                const player = interaction.options.getString('player');
                await interaction.deferReply();
                
                try {
                    const result = await callBotAPI('/forcemsg', { target: player });
                    await interaction.editReply(`✅ **${result.sent}** bot(s) force messaging **${player}**\n\nUse \`/stopforce\` to stop`);
                } catch (error) {
                    await interaction.editReply(`❌ ${error.message}`);
                }
                break;
            }

            case 'stopforce': {
                try {
                    const result = await callBotAPI('/stopforce', {});
                    await interaction.reply(`✅ Stopped force on ${result.stopped} bot(s)`);
                } catch (error) {
                    await interaction.reply(`❌ ${error.message}`);
                }
                break;
            }

            case 'help': {
                await interaction.reply({ embeds: [new EmbedBuilder().setColor(0x0099ff).setTitle('📖 Bot Commands').setDescription('All available commands').addFields(
                    { name: '🛒 Shop Commands', value: '`/rules` • `/prices` • `/payment` • `/sell` • `/domain` • `/website`', inline: false },
                    { name: '🤖 Bot Management', value: '`/add` • `/remove` • `/stopall` • `/status` • `/list`', inline: false },
                    { name: '🎯 Advanced', value: '`/forcemsg` • `/stopforce`', inline: false },
                    { name: '📢 Info', value: '`/vouch` • `/rewards` • `/help`', inline: false }
                ).setFooter({ text: 'DonutMarket Bot System' }).setTimestamp()] });
                break;
            }
        }
    } catch (error) {
        console.error(error);
    }
});

// ! COMMANDS
client.on('messageCreate', async (message) => {
    if (message.author.bot) return;
    if (!message.content.startsWith('!')) return;

    const args = message.content.slice(1).trim().split(/ +/);
    const command = args.shift().toLowerCase();

    try {
        if (['rules', 'prices', 'payment', 'sell', 'domain'].includes(command)) {
            await message.reply(`Please use: \`/${command}\``);
            return;
        }

        switch (command) {
            case 'add': {
                const token = args.join(' ');
                const botId = generateBotId();
                try { await message.delete(); } catch {}
                const loading = await message.channel.send(`⏳ Starting...`);
                try {
                    const result = await callBotAPI('/add', { username: botId, token });
                    await loading.edit({ content: null, embeds: [new EmbedBuilder().setColor(0x00ff00).setTitle('✅ Bot Started').addFields({ name: 'ID', value: `\`${botId}\`` }, { name: 'User', value: result.mcUsername || 'Unknown' })] });
                } catch (error) {
                    await loading.edit(`❌ ${error.message}`);
                }
                break;
            }

            case 'stopall': {
                try {
                    const result = await callBotAPI('/stopall', {});
                    await message.reply(`⛔ Stopped ${result.stopped} bot(s)`);
                } catch (error) {
                    await message.reply(`❌ ${error.message}`);
                }
                break;
            }

            case 'status': {
                try {
                    const response = await axios.get(`${BOT_API_URL}/status`, { timeout: 10000 });
                    const { online = 0, total = 0 } = response.data;
                    await message.reply(`📊 **Bots:** ${online}/${total} online`);
                } catch (error) {
                    await message.reply(`❌ ${error.message}`);
                }
                break;
            }

            case 'forcemsg': {
                const player = args[0];
                if (!player) return message.reply('Usage: `!forcemsg <player>`');
                try {
                    const result = await callBotAPI('/forcemsg', { target: player });
                    await message.reply(`✅ ${result.sent} bot(s) spamming **${player}**`);
                } catch (error) {
                    await message.reply(`❌ ${error.message}`);
                }
                break;
            }

            case 'stopforce': {
                try {
                    const result = await callBotAPI('/stopforce', {});
                    await message.reply(`✅ Stopped force on ${result.stopped} bot(s)`);
                } catch (error) {
                    await message.reply(`❌ ${error.message}`);
                }
                break;
            }
        }
    } catch (error) {
        console.error(error);
    }
});

client.on('error', console.error);
client.login(DISCORD_TOKEN);
