const { Client, GatewayIntentBits, EmbedBuilder } = require('discord.js');
const axios = require('axios');

// IMPORTANT: Set these in Railway environment variables
const DISCORD_TOKEN = process.env.DISCORD_TOKEN;
const BOT_API_URL = process.env.BOT_API_URL; // Your MC bot Railway URL

if (!DISCORD_TOKEN) {
    console.error('❌ DISCORD_TOKEN not set in environment variables!');
    process.exit(1);
}

if (!BOT_API_URL) {
    console.error('❌ BOT_API_URL not set in environment variables!');
    console.error('   Set it to: https://your-minecraft-bot-app.up.railway.app');
    process.exit(1);
}

const client = new Client({
    intents: [
        GatewayIntentBits.Guilds,
        GatewayIntentBits.GuildMessages,
        GatewayIntentBits.MessageContent
    ]
});

// Helper to call MC bot API
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

client.on('ready', () => {
    console.log(`✅ Discord bot logged in as ${client.user.tag}`);
    console.log(`🔗 Connected to MC Bot API: ${BOT_API_URL}`);
    client.user.setActivity('!help for commands', { type: 'WATCHING' });
});

client.on('messageCreate', async (message) => {
    // Ignore bot messages
    if (message.author.bot) return;
    
    // Only respond to commands starting with !
    if (!message.content.startsWith('!')) return;
    
    const args = message.content.slice(1).trim().split(/ +/);
    const command = args.shift().toLowerCase();
    
    try {
        switch (command) {
            case 'start': {
                // !start username email:password:token
                if (args.length < 2) {
                    return message.reply('❌ Usage: `!start <username> <email:password:token>`');
                }
                
                const username = args[0];
                const token = args.slice(1).join(' ');
                
                // Delete the message to hide the token
                try {
                    await message.delete();
                } catch (e) {
                    console.log('Could not delete message (missing permissions)');
                }
                
                const loadingMsg = await message.channel.send(`⏳ Starting bot **${username}**...`);
                
                try {
                    const result = await callBotAPI('/add', { 
                        username, 
                        token,
                        host: 'donutsmp.net',
                        port: 25565
                    });
                    
                    const embed = new EmbedBuilder()
                        .setColor(0x00ff00)
                        .setTitle('✅ Bot Started Successfully')
                        .addFields(
                            { name: 'Bot ID', value: username, inline: true },
                            { name: 'MC Username', value: result.mcUsername || 'Unknown', inline: true },
                            { name: 'Server', value: 'donutsmp.net', inline: false }
                        )
                        .setTimestamp()
                        .setFooter({ text: 'Bot Manager' });
                    
                    await loadingMsg.edit({ content: null, embeds: [embed] });
                } catch (error) {
                    await loadingMsg.edit(`❌ Failed to start bot: ${error.message}`);
                }
                break;
            }
            
            case 'stop': {
                // !stop username
                if (args.length < 1) {
                    return message.reply('❌ Usage: `!stop <username>`');
                }
                
                const username = args[0];
                
                try {
                    await callBotAPI('/remove', { username });
                    
                    const embed = new EmbedBuilder()
                        .setColor(0xff0000)
                        .setTitle('🛑 Bot Stopped')
                        .setDescription(`Bot **${username}** has been stopped`)
                        .setTimestamp();
                    
                    await message.reply({ embeds: [embed] });
                } catch (error) {
                    await message.reply(`❌ Error: ${error.message}`);
                }
                break;
            }
            
            case 'chat': {
                // !chat username message
                if (args.length < 2) {
                    return message.reply('❌ Usage: `!chat <username> <message>`');
                }
                
                const username = args[0];
                const chatMessage = args.slice(1).join(' ');
                
                try {
                    await callBotAPI('/chat', { username, message: chatMessage });
                    await message.reply(`💬 **${username}** said: ${chatMessage}`);
                } catch (error) {
                    await message.reply(`❌ Error: ${error.message}`);
                }
                break;
            }
            
            case 'cmd':
            case 'command': {
                // !cmd username /command
                if (args.length < 2) {
                    return message.reply('❌ Usage: `!cmd <username> <command>`');
                }
                
                const username = args[0];
                const cmd = args.slice(1).join(' ');
                
                try {
                    await callBotAPI('/chat', { 
                        username, 
                        message: cmd.startsWith('/') ? cmd : `/${cmd}`
                    });
                    await message.reply(`⚡ Executed command as **${username}**`);
                } catch (error) {
                    await message.reply(`❌ Error: ${error.message}`);
                }
                break;
            }
            
            case 'status': {
                // !status
                try {
                    const response = await axios.get(`${BOT_API_URL}/status`, { timeout: 10000 });
                    const { bots, count } = response.data;
                    
                    if (count === 0) {
                        return message.reply('📊 No bots currently running');
                    }
                    
                    const embed = new EmbedBuilder()
                        .setColor(0x0099ff)
                        .setTitle(`🤖 Active Bots (${count})`)
                        .setDescription(`${count} bot${count !== 1 ? 's' : ''} online`)
                        .setTimestamp();
                    
                    bots.forEach(bot => {
                        const status = bot.connected ? '🟢 Online' : '🔴 Offline';
                        const health = bot.health ? `${bot.health}/20` : 'N/A';
                        const food = bot.food ? `${bot.food}/20` : 'N/A';
                        
                        embed.addFields({
                            name: `${bot.mcUsername || bot.username}`,
                            value: `${status}\nHealth: ${health} | Food: ${food}`,
                            inline: true
                        });
                    });
                    
                    await message.reply({ embeds: [embed] });
                } catch (error) {
                    await message.reply(`❌ Error fetching status: ${error.message}`);
                }
                break;
            }
            
            case 'help': {
                const embed = new EmbedBuilder()
                    .setColor(0x0099ff)
                    .setTitle('🤖 Minecraft Bot Manager - Commands')
                    .setDescription('Control your Minecraft bots from Discord')
                    .addFields(
                        { 
                            name: '!start <username> <token>', 
                            value: 'Start a bot with session token\n**Format:** `email:password:jwt_token`\n⚠️ Message will be deleted for security',
                            inline: false
                        },
                        { 
                            name: '!stop <username>', 
                            value: 'Stop a running bot',
                            inline: false
                        },
                        { 
                            name: '!chat <username> <message>', 
                            value: 'Send a chat message as the bot',
                            inline: false
                        },
                        { 
                            name: '!cmd <username> <command>', 
                            value: 'Execute a command as the bot',
                            inline: false
                        },
                        { 
                            name: '!status', 
                            value: 'View all active bots and their status',
                            inline: false
                        }
                    )
                    .setFooter({ text: 'Bot Manager v1.0 | DonutSMP' })
                    .setTimestamp();
                
                await message.reply({ embeds: [embed] });
                break;
            }
            
            case 'ping': {
                const sent = await message.reply('🏓 Pinging...');
                const latency = sent.createdTimestamp - message.createdTimestamp;
                await sent.edit(`🏓 Pong! Latency: ${latency}ms`);
                break;
            }
            
            default: {
                // Unknown command
                if (command.length > 0) {
                    await message.reply('❌ Unknown command. Use `!help` for a list of commands.');
                }
            }
        }
    } catch (error) {
        console.error('Command error:', error);
        await message.reply(`❌ An error occurred: ${error.message}`).catch(() => {});
    }
});

// Error handling
client.on('error', error => {
    console.error('Discord client error:', error);
});

process.on('unhandledRejection', error => {
    console.error('Unhandled promise rejection:', error);
});

// Login
client.login(DISCORD_TOKEN);

console.log('🚀 Discord bot starting...');
console.log(`📡 Bot API URL: ${BOT_API_URL}`);
