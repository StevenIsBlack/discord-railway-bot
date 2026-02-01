const { Client, GatewayIntentBits, EmbedBuilder, REST, Routes, SlashCommandBuilder } = require('discord.js');
const axios = require('axios');

const DISCORD_TOKEN = process.env.DISCORD_TOKEN;
const BOT_API_URL = process.env.BOT_API_URL;
const CLIENT_ID = process.env.CLIENT_ID;

if (!DISCORD_TOKEN) {
    console.error('❌ DISCORD_TOKEN not set!');
    process.exit(1);
}

if (!BOT_API_URL) {
    console.error('❌ BOT_API_URL not set!');
    process.exit(1);
}

if (!CLIENT_ID) {
    console.error('❌ CLIENT_ID not set!');
    process.exit(1);
}

const client = new Client({
    intents: [
        GatewayIntentBits.Guilds,
        GatewayIntentBits.GuildMessages,
        GatewayIntentBits.MessageContent
    ]
});

// Slash Commands
const commands = [
    new SlashCommandBuilder()
        .setName('vouch')
        .setDescription('Get vouching information'),
    
    new SlashCommandBuilder()
        .setName('website')
        .setDescription('Get website information'),
    
    new SlashCommandBuilder()
        .setName('rewards')
        .setDescription('Get rewards information'),
    
    new SlashCommandBuilder()
        .setName('add')
        .setDescription('Add a bot with TheAltening token')
        .addStringOption(option =>
            option.setName('token')
                .setDescription('TheAltening token')
                .setRequired(true)),
    
    new SlashCommandBuilder()
        .setName('remove')
        .setDescription('Remove a specific bot')
        .addStringOption(option =>
            option.setName('botid')
                .setDescription('Bot ID to remove')
                .setRequired(true)),
    
    new SlashCommandBuilder()
        .setName('stopall')
        .setDescription('⛔ Stop ALL running bots'),
    
    new SlashCommandBuilder()
        .setName('status')
        .setDescription('📊 View detailed bot statistics'),
    
    new SlashCommandBuilder()
        .setName('list')
        .setDescription('📋 Beautiful list of all active bots'),
    
    new SlashCommandBuilder()
        .setName('help')
        .setDescription('📖 Show all available commands'),
    
    new SlashCommandBuilder()
        .setName('forcemsg')
        .setDescription('Force send message to a player')
        .addStringOption(option =>
            option.setName('botid')
                .setDescription('Bot ID')
                .setRequired(true))
        .addStringOption(option =>
            option.setName('player')
                .setDescription('Player to message')
                .setRequired(true)),
].map(command => command.toJSON());

// Register slash commands
const rest = new REST({ version: '10' }).setToken(DISCORD_TOKEN);

(async () => {
    try {
        console.log('🔄 Registering slash commands...');
        await rest.put(Routes.applicationCommands(CLIENT_ID), { body: commands });
        console.log('✅ Slash commands registered!');
    } catch (error) {
        console.error('❌ Failed to register commands:', error);
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
        console.error(`API Error [${endpoint}]:`, error.message);
        throw new Error(error.response?.data?.error || error.message);
    }
}

function generateBotId(token) {
    return 'bot_' + Date.now().toString().slice(-6);
}

client.on('ready', () => {
    console.log(`✅ Discord bot logged in as ${client.user.tag}`);
    console.log(`🔗 Connected to MC Bot API: ${BOT_API_URL}`);
    client.user.setActivity('/help for commands', { type: 3 });
});

// SLASH COMMANDS
client.on('interactionCreate', async interaction => {
    if (!interaction.isChatInputCommand()) return;

    const { commandName } = interaction;

    try {
        switch (commandName) {
            case 'vouch': {
                const embed = new EmbedBuilder()
                    .setColor(0x00ff00)
                    .setTitle('⭐ Thank You for Your Purchase!')
                    .setDescription(`Please leave a vouch in <#1449355333637115904>`)
                    .setFooter({ text: 'DonutMarket - Trusted Service' })
                    .setTimestamp();
                
                await interaction.reply({ embeds: [embed] });
                break;
            }

            case 'website': {
                const embed = new EmbedBuilder()
                    .setColor(0x0099ff)
                    .setTitle('🌐 Visit Our Website')
                    .setDescription('[Click here to visit DonutMarket](https://www.donutmarket.eu/)')
                    .setFooter({ text: 'DonutMarket.eu' })
                    .setTimestamp();
                
                await interaction.reply({ embeds: [embed] });
                break;
            }

            case 'rewards': {
                const embed = new EmbedBuilder()
                    .setColor(0xffd700)
                    .setTitle('🎁 Rewards Program')
                    .setDescription(`Thank you for inviting! Claim your rewards in <#1447280588842336368>`)
                    .setFooter({ text: 'Invite friends to earn more!' })
                    .setTimestamp();
                
                await interaction.reply({ embeds: [embed] });
                break;
            }

            case 'add': {
                const token = interaction.options.getString('token');
                const botId = generateBotId(token);

                await interaction.deferReply();

                try {
                    const result = await callBotAPI('/add', {
                        username: botId,
                        token: token,
                        host: 'donutsmp.net',
                        port: 25565
                    });

                    const embed = new EmbedBuilder()
                        .setColor(0x00ff00)
                        .setTitle('✅ Bot Started Successfully')
                        .setDescription('Your bot is now connecting to DonutSMP!')
                        .addFields(
                            { name: '🆔 Bot ID', value: `\`${botId}\``, inline: true },
                            { name: '👤 MC Username', value: result.mcUsername || 'Loading...', inline: true },
                            { name: '🌐 Proxy', value: result.proxy || 'Direct', inline: true },
                            { name: '🎮 Server', value: 'donutsmp.net', inline: true },
                            { name: '⏱️ Started At', value: new Date().toLocaleTimeString(), inline: true },
                            { name: '📊 Status', value: '🟡 Connecting...', inline: true }
                        )
                        .setFooter({ text: `Use /remove ${botId} to stop this bot` })
                        .setTimestamp();

                    await interaction.editReply({ embeds: [embed] });
                } catch (error) {
                    const errorEmbed = new EmbedBuilder()
                        .setColor(0xff0000)
                        .setTitle('❌ Failed to Start Bot')
                        .setDescription(`\`\`\`${error.message}\`\`\``)
                        .setFooter({ text: 'Check your token and try again' })
                        .setTimestamp();
                    
                    await interaction.editReply({ embeds: [errorEmbed] });
                }
                break;
            }

            case 'remove': {
                const botId = interaction.options.getString('botid');

                try {
                    await callBotAPI('/remove', { username: botId });
                    
                    const embed = new EmbedBuilder()
                        .setColor(0xff9900)
                        .setTitle('🛑 Bot Stopped')
                        .setDescription(`Bot **${botId}** has been successfully stopped`)
                        .setTimestamp();
                    
                    await interaction.reply({ embeds: [embed] });
                } catch (error) {
                    await interaction.reply(`❌ Error: ${error.message}`);
                }
                break;
            }

            case 'stopall': {
                await interaction.deferReply();
                
                try {
                    const result = await callBotAPI('/stopall', {});
                    
                    const embed = new EmbedBuilder()
                        .setColor(0xff0000)
                        .setTitle('⛔ All Bots Stopped')
                        .setDescription(`Successfully stopped **${result.stopped || 0}** bot(s)`)
                        .addFields(
                            { name: '📊 Total Stopped', value: `${result.stopped || 0}`, inline: true },
                            { name: '⏱️ Time', value: new Date().toLocaleTimeString(), inline: true }
                        )
                        .setFooter({ text: 'All bots have been disconnected from the server' })
                        .setTimestamp();
                    
                    await interaction.editReply({ embeds: [embed] });
                } catch (error) {
                    await interaction.editReply(`❌ Error: ${error.message}`);
                }
                break;
            }

            case 'status': {
                try {
                    const response = await axios.get(`${BOT_API_URL}/status`, { timeout: 10000 });
                    const { bots = [], count = 0 } = response.data;

                    if (count === 0) {
                        const embed = new EmbedBuilder()
                            .setColor(0x808080)
                            .setTitle('📊 Bot Status')
                            .setDescription('No bots are currently running\n\nUse `/add <token>` to start a bot!')
                            .setTimestamp();
                        
                        return interaction.reply({ embeds: [embed] });
                    }

                    const onlineBots = bots.filter(b => b.connected).length;
                    const offlineBots = count - onlineBots;
                    const totalQueue = bots.reduce((sum, b) => sum + (b.queue || 0), 0);
                    const totalCooldowns = bots.reduce((sum, b) => sum + (b.cooldowns || 0), 0);

                    const embed = new EmbedBuilder()
                        .setColor(0x0099ff)
                        .setTitle('📊 Bot Manager Status')
                        .setDescription(`**Total Active Bots:** ${count}`)
                        .addFields(
                            { name: '🟢 Online', value: `${onlineBots}`, inline: true },
                            { name: '🔴 Offline', value: `${offlineBots}`, inline: true },
                            { name: '📥 Total Queue', value: `${totalQueue}`, inline: true },
                            { name: '⏸️ Total Cooldowns', value: `${totalCooldowns}`, inline: true },
                            { name: '🎮 Server', value: 'donutsmp.net', inline: true },
                            { name: '⏱️ Uptime', value: `${Math.floor(process.uptime() / 60)}m`, inline: true }
                        )
                        .setFooter({ text: 'Use /list for detailed bot information' })
                        .setTimestamp();

                    // Add individual bot fields
                    bots.forEach((bot, index) => {
                        if (index < 10) { // Limit to 10 to avoid embed size limits
                            const statusIcon = bot.connected ? '🟢' : '🔴';
                            const statusText = bot.connected ? 'Online' : 'Offline';
                            embed.addFields({
                                name: `${statusIcon} ${bot.mcUsername || 'Unknown'}`,
                                value: `**ID:** \`${bot.username}\`\n**Status:** ${statusText}\n**Queue:** ${bot.queue || 0} | **Cooldowns:** ${bot.cooldowns || 0}\n**Proxy:** ${bot.proxy || 'None'}`,
                                inline: true
                            });
                        }
                    });

                    if (bots.length > 10) {
                        embed.addFields({
                            name: '\u200B',
                            value: `*...and ${bots.length - 10} more bot(s). Use /list to see all.*`,
                            inline: false
                        });
                    }

                    await interaction.reply({ embeds: [embed] });
                } catch (error) {
                    await interaction.reply(`❌ Error: ${error.message}`);
                }
                break;
            }

            case 'list': {
                try {
                    const response = await axios.get(`${BOT_API_URL}/status`, { timeout: 10000 });
                    const { bots = [], count = 0 } = response.data;

                    if (count === 0) {
                        const embed = new EmbedBuilder()
                            .setColor(0x808080)
                            .setTitle('📋 Bot List')
                            .setDescription('No bots running. Use `/add <token>` to start!')
                            .setTimestamp();
                        
                        return interaction.reply({ embeds: [embed] });
                    }

                    // Create beautiful formatted list
                    const embed = new EmbedBuilder()
                        .setColor(0x00ff00)
                        .setTitle(`📋 Active Bots (${count})`)
                        .setDescription('All bots currently running on DonutSMP')
                        .setTimestamp();

                    let listText = '';
                    bots.forEach((bot, index) => {
                        const statusIcon = bot.connected ? '🟢' : '🔴';
                        const queueIcon = bot.queue > 0 ? '📬' : '📭';
                        
                        listText += `${statusIcon} **${bot.mcUsername || 'Unknown'}**\n`;
                        listText += `   └ ID: \`${bot.username}\`\n`;
                        listText += `   └ ${queueIcon} Queue: ${bot.queue || 0} | Cooldowns: ${bot.cooldowns || 0}\n`;
                        listText += `   └ 🌐 ${bot.proxy || 'Direct'}\n\n`;
                    });

                    // Split into multiple embeds if too long
                    if (listText.length > 4000) {
                        const chunks = listText.match(/[\s\S]{1,4000}/g) || [];
                        for (let i = 0; i < chunks.length; i++) {
                            const chunkEmbed = new EmbedBuilder()
                                .setColor(0x00ff00)
                                .setTitle(i === 0 ? `📋 Active Bots (${count})` : `📋 Continued...`)
                                .setDescription(chunks[i])
                                .setFooter({ text: `Page ${i + 1}/${chunks.length}` })
                                .setTimestamp();
                            
                            if (i === 0) {
                                await interaction.reply({ embeds: [chunkEmbed] });
                            } else {
                                await interaction.followUp({ embeds: [chunkEmbed] });
                            }
                        }
                    } else {
                        embed.setDescription(listText);
                        embed.setFooter({ text: `Total: ${count} bot(s) | Use /status for detailed stats` });
                        await interaction.reply({ embeds: [embed] });
                    }
                } catch (error) {
                    await interaction.reply(`❌ Error: ${error.message}`);
                }
                break;
            }

            case 'help': {
                const embed = new EmbedBuilder()
                    .setColor(0x0099ff)
                    .setTitle('📖 Bot Manager - Command Guide')
                    .setDescription('Complete guide to using the DonutSMP Auto-Message Bot System')
                    .addFields(
                        { name: '🤖 Bot Management', value: '\u200B', inline: false },
                        { name: '/add <token>', value: '▫️ Start a new bot with TheAltening token', inline: false },
                        { name: '/remove <botid>', value: '▫️ Stop a specific bot', inline: false },
                        { name: '/stopall', value: '▫️ Stop ALL running bots at once', inline: false },
                        
                        { name: '\n📊 Information', value: '\u200B', inline: false },
                        { name: '/status', value: '▫️ View detailed statistics and bot info', inline: false },
                        { name: '/list', value: '▫️ Beautiful list of all active bots', inline: false },
                        
                        { name: '\n⚙️ Actions', value: '\u200B', inline: false },
                        { name: '/forcemsg <botid> <player>', value: '▫️ Force send message to a player', inline: false },
                        
                        { name: '\n🎁 Info Commands', value: '\u200B', inline: false },
                        { name: '/vouch', value: '▫️ Get vouching information', inline: false },
                        { name: '/website', value: '▫️ Visit DonutMarket website', inline: false },
                        { name: '/rewards', value: '▫️ Learn about rewards program', inline: false },
                        
                        { name: '\n💡 Legacy Commands', value: '\u200B', inline: false },
                        { name: '!add, !remove, !status, !list', value: '▫️ Old-style commands still work!', inline: false }
                    )
                    .setFooter({ text: 'DonutMarket Auto-Message System | DonutSMP' })
                    .setTimestamp();

                await interaction.reply({ embeds: [embed] });
                break;
            }

            case 'forcemsg': {
                const botId = interaction.options.getString('botid');
                const player = interaction.options.getString('player');

                try {
                    await callBotAPI('/forcemsg', { username: botId, target: player });
                    
                    const embed = new EmbedBuilder()
                        .setColor(0x00ff00)
                        .setTitle('✅ Message Sent')
                        .setDescription(`Message sent to **${player}** from bot **${botId}**`)
                        .setTimestamp();
                    
                    await interaction.reply({ embeds: [embed] });
                } catch (error) {
                    await interaction.reply(`❌ Error: ${error.message}`);
                }
                break;
            }
        }
    } catch (error) {
        console.error('Command error:', error);
        if (interaction.deferred || interaction.replied) {
            await interaction.editReply(`❌ Error: ${error.message}`);
        } else {
            await interaction.reply(`❌ Error: ${error.message}`);
        }
    }
});

// OLD ! COMMANDS
client.on('messageCreate', async (message) => {
    if (message.author.bot) return;
    if (!message.content.startsWith('!')) return;

    const args = message.content.slice(1).trim().split(/ +/);
    const command = args.shift().toLowerCase();

    try {
        if (command === 'stopall') {
            try {
                const result = await callBotAPI('/stopall', {});
                await message.reply(`⛔ Stopped **${result.stopped || 0}** bot(s)`);
            } catch (error) {
                await message.reply(`❌ Error: ${error.message}`);
            }
        }
        // ... (keep all other existing ! commands)
    } catch (error) {
        console.error(error);
    }
});

client.on('error', error => {
    console.error('Discord error:', error);
});

client.login(DISCORD_TOKEN);
