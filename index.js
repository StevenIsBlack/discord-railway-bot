const { Client, GatewayIntentBits, EmbedBuilder } = require('discord.js');
const axios = require('axios');

const DISCORD_TOKEN = process.env.DISCORD_TOKEN;
const BOT_API_URL = process.env.BOT_API_URL;

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

async function callBotAPI(endpoint, data = {}) {
    try {
        const response = await axios.post(`${BOT_API_URL}${endpoint}`, data, {
            headers: { 'Content-Type': 'application/json' },
            timeout: 30000
        });
        return response.data;
    } catch (error) {
        console.error(`API Error [${endpoint}]:`, error.message);
        if (error.response?.data) {
            console.error('Response data:', error.response.data);
        }
        throw new Error(error.response?.data?.error || error.message);
    }
}

function generateBotId(token) {
    try {
        const parts = token.split(':');
        const email = parts[0];
        return email.split('@')[0] + '_' + Date.now().toString().slice(-4);
    } catch (e) {
        return 'bot_' + Date.now().toString().slice(-6);
    }
}

client.on('ready', () => {
    console.log(`✅ Discord bot logged in as ${client.user.tag}`);
    console.log(`🔗 Connected to MC Bot API: ${BOT_API_URL}`);
    client.user.setActivity('!help for commands', { type: 3 });
});

client.on('messageCreate', async (message) => {
    if (message.author.bot) return;
    if (!message.content.startsWith('!')) return;
    
    const args = message.content.slice(1).trim().split(/ +/);
    const command = args.shift().toLowerCase();
    
    try {
        switch (command) {
            case 'add': {
                if (args.length < 1) {
                    return message.reply('❌ Usage: `!add <email:password:token>`\nExample: `!add user@gmail.com:pass123:eyJraWQi...`');
                }
                
                const token = args.join(' ');
                const botId = generateBotId(token);
                
                try {
                    await message.delete();
                    console.log('✅ Deleted message with token for security');
                } catch (e) {
                    console.log('⚠️ Could not delete message (missing permissions)');
                }
                
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
                        .setTitle('✅ Bot Started Successfully')
                        .addFields(
                            { name: 'Bot ID', value: botId, inline: true },
                            { name: 'MC Username', value: result.mcUsername || 'Unknown', inline: true },
                            { name: 'Server', value: 'donutsmp.net', inline: true },
                            { name: 'Status', value: '🟢 Starting...', inline: false }
                        )
                        .setTimestamp()
                        .setFooter({ text: 'Use !remove ' + botId + ' to stop this bot' });
                    
                    await loadingMsg.edit({ content: null, embeds: [embed] });
                } catch (error) {
                    console.error('Failed to start bot:', error);
                    await loadingMsg.edit(`❌ Failed to start bot: ${error.message}`);
                }
                break;
            }
            
            case 'remove':
            case 'stop': {
                if (args.length < 1) {
                    return message.reply('❌ Usage: `!remove <botId>`\nUse `!status` to see active bots');
                }
                
                const botId = args[0];
                
                try {
                    await callBotAPI('/remove', { username: botId });
                    
                    const embed = new EmbedBuilder()
                        .setColor(0xff0000)
                        .setTitle('🛑 Bot Stopped')
                        .setDescription(`Bot **${botId}** has been stopped`)
                        .setTimestamp();
                    
                    await message.reply({ embeds: [embed] });
                } catch (error) {
                    await message.reply(`❌ Error: ${error.message}`);
                }
                break;
            }
            
            case 'forcemsg': {
                // !forcemsg botId targetPlayer
                if (args.length < 2) {
                    return message.reply('❌ Usage: `!forcemsg <botId> <targetPlayer>`\nExample: `!forcemsg bot_1234 Notch`');
                }
                
                const botId = args[0];
                const target = args[1];
                
                try {
                    await callBotAPI('/forcemsg', { username: botId, target: target });
                    await message.reply(`✅ Force sent message to **${target}** from **${botId}**`);
                } catch (error) {
                    await message.reply(`❌ Error: ${error.message}`);
                }
                break;
            }
            
            case 'chat': {
                if (args.length < 2) {
                    return message.reply('❌ Usage: `!chat <botId> <message>`');
                }
                
                const botId = args[0];
                const chatMessage = args.slice(1).join(' ');
                
                try {
                    await callBotAPI('/chat', { username: botId, message: chatMessage });
                    await message.reply(`💬 **${botId}**: ${chatMessage}`);
                } catch (error) {
                    await message.reply(`❌ Error: ${error.message}`);
                }
                break;
            }
            
            case 'cmd':
            case 'command': {
                if (args.length < 2) {
                    return message.reply('❌ Usage: `!cmd <botId> <command>`');
                }
                
                const botId = args[0];
                const cmd = args.slice(1).join(' ');
                
                try {
                    await callBotAPI('/chat', { 
                        username: botId, 
                        message: cmd.startsWith('/') ? cmd : `/${cmd}`
                    });
                    await message.reply(`⚡ Executed command as **${botId}**`);
                } catch (error) {
                    await message.reply(`❌ Error: ${error.message}`);
                }
                break;
            }
            
            case 'status': {
                try {
                    const response = await axios.get(`${BOT_API_URL}/status`, { 
                        timeout: 10000,
                        headers: { 'Accept': 'application/json' }
                    });
                    
                    if (!response.data) {
                        return message.reply('❌ Invalid response from bot server');
                    }
                    
                    const { bots = [], count = 0 } = response.data;
                    
                    if (count === 0 || !bots || bots.length === 0) {
                        return message.reply('📊 No bots currently running\n\nUse `!add <token>` to start a bot!');
                    }
                    
                    const embed = new EmbedBuilder()
                        .setColor(0x0099ff)
                        .setTitle(`🤖 Active Bots (${count})`)
                        .setDescription(`${count} bot${count !== 1 ? 's' : ''} online on DonutSMP`)
                        .setTimestamp();
                    
                    if (Array.isArray(bots)) {
                        bots.forEach((bot, index) => {
                            try {
                                const status = bot.connected ? '🟢 Online' : '🔴 Offline';
                                const queue = bot.queue !== undefined ? `Queue: ${bot.queue}` : '';
                                const cooldowns = bot.cooldowns !== undefined ? `Cooldowns: ${bot.cooldowns}` : '';
                                const mcName = bot.mcUsername || bot.username || 'Unknown';
                                const botId = bot.username || `bot${index + 1}`;
                                
                                embed.addFields({
                                    name: `${mcName} (${botId})`,
                                    value: `${status}\n${queue} ${cooldowns}`.trim(),
                                    inline: true
                                });
                            } catch (err) {
                                console.error('Error processing bot:', err);
                            }
                        });
                    }
                    
                    await message.reply({ embeds: [embed] });
                } catch (error) {
                    console.error('Status error:', error.message);
                    await message.reply(`❌ Error fetching status: ${error.message}\n\nMake sure the bot server is running!`);
                }
                break;
            }
            
            case 'list': {
                try {
                    const response = await axios.get(`${BOT_API_URL}/status`, { timeout: 10000 });
                    const { bots = [], count = 0 } = response.data;
                    
                    if (count === 0) {
                        return message.reply('📊 No bots currently running');
                    }
                    
                    let botList = `**Active Bots (${count}):**\n\n`;
                    bots.forEach((bot, index) => {
                        const status = bot.connected ? '🟢' : '🔴';
                        const mcName = bot.mcUsername || bot.username || 'Unknown';
                        const botId = bot.username || `bot${index + 1}`;
                        const queue = bot.queue !== undefined ? ` [Q:${bot.queue}]` : '';
                        botList += `${status} **${mcName}** (ID: \`${botId}\`)${queue}\n`;
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
                    .setTitle('🤖 Minecraft Bot Manager - Commands')
                    .setDescription('Control your Minecraft bots on DonutSMP from Discord')
                    .addFields(
                        { 
                            name: '!add <token>', 
                            value: '**Start a bot**\nFormat: `email:password:jwt_token`\n⚠️ Message deleted for security\n\nExample:\n`!add user@gmail.com:pass:eyJraWQi...`',
                            inline: false
                        },
                        { 
                            name: '!remove <botId>', 
                            value: 'Stop a bot\nExample: `!remove bot_1234`',
                            inline: false
                        },
                        { 
                            name: '!forcemsg <botId> <player>', 
                            value: '**Force send message to a player**\nExample: `!forcemsg bot_1234 Notch`',
                            inline: false
                        },
                        { 
                            name: '!chat <botId> <message>', 
                            value: 'Send chat message\nExample: `!chat bot_1234 Hello!`',
                            inline: false
                        },
                        { 
                            name: '!cmd <botId> <command>', 
                            value: 'Execute command\nExample: `!cmd bot_1234 /spawn`',
                            inline: false
                        },
                        { 
                            name: '!status', 
                            value: 'View all active bots',
                            inline: false
                        },
                        { 
                            name: '!list', 
                            value: 'Simple bot list',
                            inline: false
                        },
                        { 
                            name: '!ping', 
                            value: 'Check latency',
                            inline: false
                        }
                    )
                    .setFooter({ text: 'Auto-Message Bot | DonutSMP' })
                    .setTimestamp();
                
                await message.reply({ embeds: [embed] });
                break;
            }
            
            case 'ping': {
                const sent = await message.reply('🏓 Pinging...');
                const latency = sent.createdTimestamp - message.createdTimestamp;
                const apiLatency = await measureApiLatency();
                
                await sent.edit(`🏓 Pong!\n📡 Discord: ${latency}ms\n🎮 Bot Server: ${apiLatency}ms`);
                break;
            }
            
            default: {
                if (command.length > 0) {
                    await message.reply('❌ Unknown command. Use `!help` for commands.');
                }
            }
        }
    } catch (error) {
        console.error('Command error:', error);
        try {
            await message.reply(`❌ An error occurred: ${error.message}`);
        } catch (e) {
            console.error('Could not send error message:', e);
        }
    }
});

async function measureApiLatency() {
    const start = Date.now();
    try {
        await axios.get(`${BOT_API_URL}/health`, { timeout: 5000 });
        return Date.now() - start;
    } catch (e) {
        return 'Error';
    }
}

client.on('error', error => {
    console.error('Discord client error:', error);
});

process.on('unhandledRejection', error => {
    console.error('Unhandled promise rejection:', error);
});

process.on('uncaughtException', error => {
    console.error('Uncaught exception:', error);
});

client.login(DISCORD_TOKEN)
    .then(() => {
        console.log('🚀 Discord bot starting...');
        console.log(`📡 Bot API URL: ${BOT_API_URL}`);
    })
    .catch(error => {
        console.error('❌ Failed to login:', error);
        process.exit(1);
    });
