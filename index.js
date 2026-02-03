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

client.on('clientReady', () => {
    console.log(`✅ ${client.user.tag}`);
    client.user.setActivity('!help or /help', { type: 3 });
});

// SLASH COMMANDS
client.on('interactionCreate', async interaction => {
    if (!interaction.isChatInputCommand()) return;

    try {
        switch (interaction.commandName) {
            case 'vouch':
                await interaction.reply({ embeds: [new EmbedBuilder().setColor(0x00ff00).setTitle('⭐ Thank You!').setDescription('Vouch at <#1449355333637115904>').setTimestamp()] });
                break;

            case 'website':
                await interaction.reply({ embeds: [new EmbedBuilder().setColor(0x0099ff).setTitle('🌐 Website').setDescription('[DonutMarket](https://www.donutmarket.eu/)').setTimestamp()] });
                break;

            case 'rewards':
                await interaction.reply({ embeds: [new EmbedBuilder().setColor(0xffd700).setTitle('🎁 Rewards').setDescription('Claim at <#1447280588842336368>').setTimestamp()] });
                break;

            case 'add':
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

            case 'remove':
                const removeId = interaction.options.getString('botid');
                try {
                    await callBotAPI('/remove', { username: removeId });
                    await interaction.reply(`✅ Stopped ${removeId}`);
                } catch (error) {
                    await interaction.reply(`❌ ${error.message}`);
                }
                break;

            case 'stopall':
                await interaction.deferReply();
                try {
                    const result = await callBotAPI('/stopall', {});
                    await interaction.editReply(`⛔ Stopped ${result.stopped} bot(s)`);
                } catch (error) {
                    await interaction.editReply(`❌ ${error.message}`);
                }
                break;

            case 'status':
                try {
                    const response = await axios.get(`${BOT_API_URL}/status`, { timeout: 10000 });
                    const { online = 0, total = 0 } = response.data;
                    await interaction.reply({ embeds: [new EmbedBuilder().setColor(0x0099ff).setTitle('📊 Status').setDescription(`**Bots:** ${online}/${total} online`).setTimestamp()] });
                } catch (error) {
                    await interaction.reply(`❌ ${error.message}`);
                }
                break;

            case 'list':
                try {
                    const response = await axios.get(`${BOT_API_URL}/status`, { timeout: 10000 });
                    const { online = 0, total = 0 } = response.data;
                    await interaction.reply(`📋 **Bots:** ${online}/${total} online`);
                } catch (error) {
                    await interaction.reply(`❌ ${error.message}`);
                }
                break;

            case 'forcemsg':
                const player = interaction.options.getString('player');
                await interaction.deferReply();
                
                try {
                    const result = await callBotAPI('/forcemsg', { target: player });
                    await interaction.editReply(`✅ **${result.sent}** bot(s) are now force messaging **${player}**\n\nUse \`/stopforce\` to resume normal queue`);
                } catch (error) {
                    await interaction.editReply(`❌ ${error.message}`);
                }
                break;

            case 'stopforce':
                try {
                    const result = await callBotAPI('/stopforce', {});
                    await interaction.reply(`✅ Stopped force messaging on **${result.stopped}** bot(s) - Queue resumed`);
                } catch (error) {
                    await interaction.reply(`❌ ${error.message}`);
                }
                break;

            case 'help':
                await interaction.reply({ embeds: [new EmbedBuilder().setColor(0x0099ff).setTitle('📖 Commands').setDescription('Bot manager commands').addFields(
                    { name: '/add <token>', value: 'Start a bot', inline: false },
                    { name: '/stopall', value: 'Stop all bots', inline: false },
                    { name: '/status', value: 'View bot count', inline: false },
                    { name: '/forcemsg <player>', value: 'ALL bots spam player', inline: false },
                    { name: '/stopforce', value: 'Stop force & resume queue', inline: false },
                    { name: '\u200B', value: '**Also works with ! commands**', inline: false }
                ).setTimestamp()] });
                break;
        }
    } catch (error) {
        console.error(error);
    }
});

// ! COMMANDS (RESTORED)
client.on('messageCreate', async (message) => {
    if (message.author.bot) return;
    if (!message.content.startsWith('!')) return;

    const args = message.content.slice(1).trim().split(/ +/);
    const command = args.shift().toLowerCase();

    try {
        switch (command) {
            case 'add':
                const token = args.join(' ');
                const botId = generateBotId();

                try { await message.delete(); } catch {}

                const loading = await message.channel.send(`⏳ Starting bot...`);

                try {
                    const result = await callBotAPI('/add', { username: botId, token });
                    await loading.edit({ content: null, embeds: [new EmbedBuilder().setColor(0x00ff00).setTitle('✅ Bot Started').addFields({ name: 'Bot ID', value: `\`${botId}\``, inline: true }, { name: 'Username', value: result.mcUsername || 'Unknown', inline: true })] });
                } catch (error) {
                    await loading.edit(`❌ ${error.message}`);
                }
                break;

            case 'stopall':
                try {
                    const result = await callBotAPI('/stopall', {});
                    await message.reply(`⛔ Stopped ${result.stopped} bot(s)`);
                } catch (error) {
                    await message.reply(`❌ ${error.message}`);
                }
                break;

            case 'remove':
            case 'stop':
                const removeId = args[0];
                if (!removeId) return message.reply('Usage: `!remove <botid>`');

                try {
                    await callBotAPI('/remove', { username: removeId });
                    await message.reply(`✅ Stopped ${removeId}`);
                } catch (error) {
                    await message.reply(`❌ ${error.message}`);
                }
                break;

            case 'status':
                try {
                    const response = await axios.get(`${BOT_API_URL}/status`, { timeout: 10000 });
                    const { online = 0, total = 0 } = response.data;
                    await message.reply({ embeds: [new EmbedBuilder().setColor(0x0099ff).setTitle('📊 Status').setDescription(`**Bots:** ${online}/${total} online`).setTimestamp()] });
                } catch (error) {
                    await message.reply(`❌ ${error.message}`);
                }
                break;

            case 'list':
                try {
                    const response = await axios.get(`${BOT_API_URL}/status`, { timeout: 10000 });
                    const { online = 0, total = 0 } = response.data;
                    await message.reply(`📋 **Bots:** ${online}/${total} online`);
                } catch (error) {
                    await message.reply(`❌ ${error.message}`);
                }
                break;

            case 'forcemsg':
                const player = args[0];
                if (!player) return message.reply('Usage: `!forcemsg <player>`');

                try {
                    const result = await callBotAPI('/forcemsg', { target: player });
                    await message.reply(`✅ **${result.sent}** bot(s) force messaging **${player}**\n\nUse \`!stopforce\` to stop`);
                } catch (error) {
                    await message.reply(`❌ ${error.message}`);
                }
                break;

            case 'stopforce':
                try {
                    const result = await callBotAPI('/stopforce', {});
                    await message.reply(`✅ Stopped force on ${result.stopped} bot(s)`);
                } catch (error) {
                    await message.reply(`❌ ${error.message}`);
                }
                break;

            case 'help':
                await message.reply({ embeds: [new EmbedBuilder().setColor(0x0099ff).setTitle('📖 Commands').addFields(
                    { name: '!add <token>', value: 'Start bot' },
                    { name: '!stopall', value: 'Stop all' },
                    { name: '!status', value: 'View status' },
                    { name: '!forcemsg <player>', value: 'Force spam player' },
                    { name: '!stopforce', value: 'Stop force mode' }
                )] });
                break;
        }
    } catch (error) {
        console.error(error);
        await message.reply(`❌ ${error.message}`);
    }
});

client.on('error', console.error);
client.login(DISCORD_TOKEN);
