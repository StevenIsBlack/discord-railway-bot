const { Client, GatewayIntentBits } = require('discord.js');
const axios = require('axios');

const client = new Client({
    intents: [
        GatewayIntentBits.Guilds,
        GatewayIntentBits.GuildMessages,
        GatewayIntentBits.MessageContent
    ]
});

const MC_API = process.env.MC_BOT_URL || 'http://localhost:3000';

client.on('ready', () => {
    console.log(`Logged in as ${client.user.tag}!`);
});

client.on('messageCreate', async (message) => {
    if (message.author.bot) return;
    if (!message.content.startsWith('!')) return;
    
    const args = message.content.slice(1).split(' ');
    const cmd = args[0].toLowerCase();
    
    console.log(`Command received: ${cmd}`);
    
    try {
        if (cmd === 'ping') {
            await message.reply('Pong!');
        }
        
        if (cmd === 'status') {
            const res = await axios.get(`${MC_API}/status`);
            await message.reply(`🤖 **Bot Status**\nOnline: ${res.data.online}/${res.data.total}`);
        }
        
        if (cmd === 'add') {
            if (!args[1]) return message.reply('Usage: `!add <token>`');
            
            const res = await axios.post(`${MC_API}/add`, { 
                token: args[1],
                username: args[2] || 'Bot' + Date.now()
            });
            await message.reply(`✅ Added: ${res.data.username}`);
        }
        
        if (cmd === 'start') {
            await axios.post(`${MC_API}/startall`);
            await message.reply('🚀 Starting all bots!');
        }
        
        if (cmd === 'stop') {
            await axios.post(`${MC_API}/stopall`);
            await message.reply('🛑 Stopped all bots!');
        }
        
        if (cmd === 'list') {
            const res = await axios.get(`${MC_API}/list`);
            const list = res.data.accounts.map((a, i) => 
                `${i+1}. ${a.username} - ${a.online ? '🟢' : '🔴'}`
            ).join('\n') || 'No accounts';
            await message.reply(`**Accounts:**\n${list}`);
        }
        
    } catch (err) {
        console.error('Command error:', err.message);
        await message.reply('❌ Error: ' + err.message);
    }
});

client.login(process.env.TOKEN);
