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
        .setDescription('Remove a bot')
        .addStringOption(option =>
            option.setName('botid')
                .setDescription('Bot ID to remove')
                .setRequired(true)),
    
    new SlashCommandBuilder()
        .setName('status')
        .setDescription('View all active bots'),
    
    new SlashCommandBuilder()
        .setName('list')
        .setDescription('Simple list of active bots'),
    
    new SlashCommandBuilder()
        .setName('help')
        .setDescription('Show all commands'),
    
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
                await interaction.reply({
                    content: `Thank you for your purchase! Please vouch at <#1449355333637115904>`,
                    ephemeral: false
                });
                break;
            }

            case 'website': {
                await interaction.reply({
                    content: `Visit our website: https://www.donutmarket.eu/`,
                    ephemeral: false
                });
                break;
            }

            case 'rewards': {
                await interaction.reply({
                    content: `Thank you for inviting Please vouch at <#1447280588842336368>`,
                    ephemeral: false
                });
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
                        .setTitle('✅ Bot Started')
                        .addFields(
                            { name: 'Bot ID', value: botId, inline: true },
                            { name: 'MC Username', value: result.mcUsername || 'Unknown', inline: true },
                            { name: 'Proxy', value: result.proxy || 'Direct', inline: true }
                        )
                        .setTimestamp();

                    await interaction.editReply({ embeds: [embed] });
                } catch (error) {
                    await interaction.editReply(`❌ Failed: ${error.message}`);
                }
                break;
            }

            case 'remove': {
                const botId = interaction.options.getString('botid');

                try {
                    await callBotAPI('/remove', { username: botId });
                    await interaction.reply(`✅ Bot **${botId}** stopped`);
                } catch (error) {
                    await interaction.reply(`❌ Error: ${error.message}`);
                }
                break;
            }

            case 'status': {
                try {
                    const response = await axios.get(`${BOT_API_URL}/status`, { timeout: 10000 });
                    const { bots = [], count = 0 } = response.data;

                    if (count === 0) {
                        return interaction.reply('📊 No bots currently running\n\nUse `/add` to start a bot!');
                    }

                    const embed = new EmbedBuilder()
                        .setColor(0x0099ff)
                        .setTitle(`🤖 Active Bots (${count})`)
                        .setDescription(`${count} bot${count !== 1 ? 's' : ''} online`)
                        .setTimestamp();

                    bots.forEach((bot, index) => {
                        const status = bot.connected ? '🟢 Online' : '🔴 Offline';
                        embed.addFields({
                            name: `${bot.mcUsername} (${bot.username})`,
                            value: `${status}\nQueue: ${bot.queue} | Cooldowns: ${bot.cooldowns}\nProxy: ${bot.proxy}`,
                            inline: true
                        });
                    });

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
                        return interaction.reply('📊 No bots currently running');
                    }

                    let botList = `**Active Bots (${count}):**\n\n`;
                    bots.forEach((bot, index) => {
                        const status = bot.connected ? '🟢' : '🔴';
                        botList += `${status} **${bot.mcUsername}** (ID: \`${bot.username}\`) [Q:${bot.queue}]\n`;
                    });

                    await interaction.reply(botList);
                } catch (error) {
                    await interaction.reply(`❌ Error: ${error.message}`);
                }
                break;
            }

            case 'help': {
                const embed = new EmbedBuilder()
                    .setColor(0x0099ff)
                    .setTitle('🤖 Bot Manager - Commands')
                    .setDescription('Auto-message bot system for DonutSMP')
                    .addFields(
                        { name: '/add <token>', value: 'Start a bot with TheAltening token', inline: false },
                        { name: '/remove <botid>', value: 'Stop a running bot', inline: false },
                        { name: '/status', value: 'View detailed bot status', inline: false },
                        { name: '/list', value: 'Simple bot list', inline: false },
                        { name: '/forcemsg <botid> <player>', value: 'Force send message to player', inline: false },
                        { name: '/vouch', value: 'Get vouching information', inline: false },
                        { name: '/website', value: 'Get website link', inline: false },
                        { name: '/rewards', value: 'Get rewards info', inline: false },
                        { name: '\u200B', value: '**Legacy ! Commands:**', inline: false },
                        { name: '!add <token>', value: 'Start a bot (old style)', inline: false },
                        { name: '!status', value: 'View bot status (old style)', inline: false },
                        { name: '!list', value: 'List bots (old style)', inline: false }
                    )
                    .setFooter({ text: 'TheAltening Bot Manager | DonutSMP' })
                    .setTimestamp();

                await interaction.reply({ embeds: [embed] });
                break;
            }

            case 'forcemsg': {
                const botId = interaction.options.getString('botid');
                const player = interaction.options.getString('player');

                try {
                    await callBotAPI('/forcemsg', { username: botId, target: player });
                    await interaction.reply(`✅ Sent message to **${player}** from **${botId}**`);
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

// OLD ! COMMANDS (still work)
client.on('messageCreate', async (message) => {
    if (message.author.bot) return;
    if (!message.content.startsWith('!')) return;

    const args = message.content.slice(1).trim().split(/ +/);
    const command = args.shift().toLowerCase();

    try {
        switch (command) {
            case 'add': {
                const token = args.join(' ');
                const botId = generateBotId(token);

                try {
                    await message.delete();
                } catch {}

                const loadingMsg = await message.channel.send(`⏳ Starting bot **${botId}**...`);

                try {
                    const result = await callBotAPI('/add', {
                        username: botId,
                        token: token,
                        host: 'donutsmp.net',
                        port: 25565
                    });

                    const embed = new EmbedBuilder()
                        .setColor(0x00ff00)
                        .setTitle('✅ Bot Started')
                        .addFields(
                            { name: 'Bot ID', value: botId, inline: true },
                            { name: 'MC Username', value: result.mcUsername || 'Unknown', inline: true },
                            { name: 'Proxy', value: result.proxy || 'Direct', inline: true }
                        );

                    await loadingMsg.edit({ content: null, embeds: [embed] });
                } catch (error) {
                    await loadingMsg.edit(`❌ Failed: ${error.message}`);
                }
                break;
            }

            case 'remove':
            case 'stop': {
                const botId = args[0];
                if (!botId) {
                    return message.reply('Usage: `!remove <botid>`');
                }

                try {
                    await callBotAPI('/remove', { username: botId });
                    await message.reply(`✅ Bot **${botId}** stopped`);
                } catch (error) {
                    await message.reply(`❌ Error: ${error.message}`);
                }
                break;
            }

            case 'status': {
                try {
                    const response = await axios.get(`${BOT_API_URL}/status`, { timeout: 10000 });
                    const { bots = [], count = 0 } = response.data;

                    if (count === 0) {
                        return message.reply('📊 No bots running');
                    }

                    const embed = new EmbedBuilder()
                        .setColor(0x0099ff)
                        .setTitle(`🤖 Active Bots (${count})`)
                        .setTimestamp();

                    bots.forEach(bot => {
                        const status = bot.connected ? '🟢' : '🔴';
                        embed.addFields({
                            name: `${bot.mcUsername} (${bot.username})`,
                            value: `${status} | Queue: ${bot.queue} | Proxy: ${bot.proxy}`,
                            inline: true
                        });
                    });

                    await message.reply({ embeds: [embed] });
                } catch (error) {
                    await message.reply(`❌ Error: ${error.message}`);
                }
                break;
            }

            case 'list': {
                try {
                    const response = await axios.get(`${BOT_API_URL}/status`, { timeout: 10000 });
                    const { bots = [], count = 0 } = response.data;

                    if (count === 0) {
                        return message.reply('📊 No bots running');
                    }

                    let botList = `**Active Bots (${count}):**\n\n`;
                    bots.forEach(bot => {
                        const status = bot.connected ? '🟢' : '🔴';
                        botList += `${status} **${bot.mcUsername}** (ID: \`${bot.username}\`)\n`;
                    });

                    await message.reply(botList);
                } catch (error) {
                    await message.reply(`❌ Error: ${error.message}`);
                }
                break;
            }

            case 'help': {
                const embed = new EmbedBuilder()
                    .setColor(0x0099ff)
                    .setTitle('🤖 Bot Manager - Commands')
                    .addFields(
                        { name: '!add <token>', value: 'Start a bot', inline: false },
                        { name: '!remove <botid>', value: 'Stop a bot', inline: false },
                        { name: '!status', value: 'View bot status', inline: false },
                        { name: '!list', value: 'List all bots', inline: false },
                        { name: '!help', value: 'Show this message', inline: false },
                        { name: '\u200B', value: '**You can also use slash commands: /help**', inline: false }
                    );

                await message.reply({ embeds: [embed] });
                break;
            }

            case 'forcemsg': {
                const botId = args[0];
                const target = args[1];

                if (!botId || !target) {
                    return message.reply('Usage: `!forcemsg <botid> <player>`');
                }

                try {
                    await callBotAPI('/forcemsg', { username: botId, target: target });
                    await message.reply(`✅ Sent to **${target}** from **${botId}**`);
                } catch (error) {
                    await message.reply(`❌ Error: ${error.message}`);
                }
                break;
            }
        }
    } catch (error) {
        console.error('Command error:', error);
        await message.reply(`❌ Error: ${error.message}`);
    }
});

client.on('error', error => {
    console.error('Discord error:', error);
});

client.login(DISCORD_TOKEN);
