const { Client, GatewayIntentBits, EmbedBuilder, REST, Routes, SlashCommandBuilder } = require('discord.js');
const axios = require('axios');

const DISCORD_TOKEN = process.env.DISCORD_TOKEN;
const BOT_API_URL = process.env.BOT_API_URL;
const CLIENT_ID = process.env.CLIENT_ID; // Discord bot client ID

if (!DISCORD_TOKEN) {
    console.error('❌ DISCORD_TOKEN not set!');
    process.exit(1);
}

if (!BOT_API_URL) {
    console.error('❌ BOT_API_URL not set!');
    process.exit(1);
}

if (!CLIENT_ID) {
    console.error('❌ CLIENT_ID not set! Get it from Discord Developer Portal');
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

client.on('interactionCreate', async interaction => {
    if (!interaction.isChatInputCommand()) return;

    const { commandName } = interaction;

    try {
        switch (commandName) {
            case 'vouch': {
                // EDIT THIS MESSAGE
                await interaction.reply({
                    content: `Thank you for your purchase! Please vouch at <#1449355333637115904>`,
                    ephemeral: false
                });
                break;
            }

            case 'website': {
                // EDIT THIS MESSAGE
                await interaction.reply({
                    content: `Visit our website: https://www.donutmarket.eu/`,
                    ephemeral: false
                });
                break;
            }

            case 'rewards': {
                // EDIT THIS MESSAGE
                await interaction.reply({
                    content: `Thank you for inviting please vouch at <#1447280588842336368>`,
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
                            { name: 'Proxy', value: result.proxy || 'Direct', inline: true },
                            { name: 'Server', value: 'donutsmp.net', inline: false }
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
                        return interaction.reply('📊 No bots running');
                    }

                    const embed = new EmbedBuilder()
                        .setColor(0x0099ff)
                        .setTitle(`🤖 Active Bots (${count})`)
                        .setTimestamp();

                    bots.forEach((bot, index) => {
                        const status = bot.connected ? '🟢' : '🔴';
                        embed.addFields({
                            name: `${bot.mcUsername} (${bot.username})`,
                            value: `${status} | Queue: ${bot.queue} | Proxy: ${bot.proxy}`,
                            inline: true
                        });
                    });

                    await interaction.reply({ embeds: [embed] });
                } catch (error) {
                    await interaction.reply(`❌ Error: ${error.message}`);
                }
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

// Old ! commands still work
client.on('messageCreate', async (message) => {
    if (message.author.bot) return;
    if (!message.content.startsWith('!')) return;

    const args = message.content.slice(1).trim().split(/ +/);
    const command = args.shift().toLowerCase();

    try {
        if (command === 'add') {
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
                        { name: 'MC Username', value: result.mcUsername || 'Unknown', inline: true }
                    );

                await loadingMsg.edit({ content: null, embeds: [embed] });
            } catch (error) {
                await loadingMsg.edit(`❌ Failed: ${error.message}`);
            }
        }
    } catch (error) {
        console.error(error);
    }
});

client.login(DISCORD_TOKEN);
