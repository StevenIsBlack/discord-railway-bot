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
    new SlashCommandBuilder().setName('forcemsg').setDescription('Force message').addStringOption(o => o.setName('botid').setDescription('Bot ID').setRequired(true)).addStringOption(o => o.setName('player').setDescription('Player').setRequired(true)),
].map(c => c.toJSON());

const rest = new REST({ version: '10' }).setToken(DISCORD_TOKEN);

(async () => {
    try {
        await rest.put(Routes.applicationCommands(CLIENT_ID), { body: commands });
        console.log('✅ Slash commands registered');
    } catch (error) {
        console.error('❌ Command registration failed:', error);
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
    console.log(`✅ Logged in as ${client.user.tag}`);
    client.user.setActivity('/help', { type: 3 });
});

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
                    const result = await callBotAPI('/add', { username: botId, token, host: 'donutsmp.net', port: 25565 });
                    await interaction.editReply({ embeds: [new EmbedBuilder().setColor(0x00ff00).setTitle('✅ Bot Started').addFields({ name: 'Bot ID', value: `\`${botId}\``, inline: true }, { name: 'Username', value: result.mcUsername, inline: true }).setTimestamp()] });
                } catch (error) {
                    await interaction.editReply(`❌ Failed: ${error.message}`);
                }
                break;

            case 'remove':
                const removeId = interaction.options.getString('botid');
                try {
                    await callBotAPI('/remove', { username: removeId });
                    await interaction.reply(`✅ Stopped **${removeId}**`);
                } catch (error) {
                    await interaction.reply(`❌ Error: ${error.message}`);
                }
                break;

            case 'stopall':
                await interaction.deferReply();
                try {
                    const result = await callBotAPI('/stopall', {});
                    await interaction.editReply(`⛔ Stopped **${result.stopped}** bot(s)`);
                } catch (error) {
                    await interaction.editReply(`❌ Error: ${error.message}`);
                }
                break;

            case 'status':
                try {
                    const response = await axios.get(`${BOT_API_URL}/status`, { timeout: 10000 });
                    const { online = 0, total = 0 } = response.data;
                    
                    await interaction.reply({ embeds: [new EmbedBuilder().setColor(0x0099ff).setTitle('📊 Bot Status').setDescription(`**Bots:** ${online}/${total} online`).setTimestamp()] });
                } catch (error) {
                    await interaction.reply(`❌ Error: ${error.message}`);
                }
                break;

            case 'list':
                try {
                    const response = await axios.get(`${BOT_API_URL}/status`, { timeout: 10000 });
                    const { online = 0, total = 0 } = response.data;
                    await interaction.reply(`📋 **Bots:** ${online}/${total} online`);
                } catch (error) {
                    await interaction.reply(`❌ Error: ${error.message}`);
                }
                break;

            case 'forcemsg':
                const botid = interaction.options.getString('botid');
                const player = interaction.options.getString('player');
                
                try {
                    await callBotAPI('/forcemsg', { username: botid, target: player });
                    await interaction.reply(`✅ Sent to **${player}**`);
                } catch (error) {
                    await interaction.reply(`❌ Error: ${error.message}`);
                }
                break;

            case 'help':
                await interaction.reply({ embeds: [new EmbedBuilder().setColor(0x0099ff).setTitle('📖 Commands').addFields({ name: '/add', value: 'Start bot' }, { name: '/stopall', value: 'Stop all' }, { name: '/status', value: 'View status' }, { name: '/forcemsg', value: 'Force message' }).setTimestamp()] });
                break;
        }
    } catch (error) {
        console.error(error);
    }
});

client.login(DISCORD_TOKEN);
