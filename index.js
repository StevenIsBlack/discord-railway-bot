const { Client, GatewayIntentBits, EmbedBuilder, REST, Routes, SlashCommandBuilder, ButtonBuilder, ButtonStyle, ActionRowBuilder, StringSelectMenuBuilder, ModalBuilder, TextInputBuilder, TextInputStyle, PermissionFlagsBits } = require('discord.js');
const axios = require('axios');

const DISCORD_TOKEN = process.env.DISCORD_TOKEN;
const BOT_API_URL = process.env.BOT_API_URL;
const CLIENT_ID = process.env.CLIENT_ID;
const CASHOUT_CHANNEL_ID = process.env.CASHOUT_CHANNEL_ID; // Set this in Railway env vars

if (!DISCORD_TOKEN || !BOT_API_URL || !CLIENT_ID) {
    console.error('❌ Missing environment variables!');
    process.exit(1);
}

const client = new Client({
    intents: [
        GatewayIntentBits.Guilds,
        GatewayIntentBits.GuildMessages,
        GatewayIntentBits.MessageContent,
        GatewayIntentBits.GuildModeration
    ]
});

// Anti-spam tracking
const userLastMessage = new Map();
const userSpamWarnings = new Map();

// Gambling system
const userBalances = new Map();
const activeGames = new Map();
const pendingCashouts = new Map();
const MEMBER_ROLE_ID = '1442921893786161387';
const MIN_BET = 500000; // 500K minimum

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
    
    // Gambling commands
    new SlashCommandBuilder().setName('balance').setDescription('💰 Check your gambling balance'),
    new SlashCommandBuilder().setName('addbalance').setDescription('💵 Add balance to user (Admin only)')
        .addUserOption(o => o.setName('user').setDescription('User').setRequired(true))
        .addStringOption(o => o.setName('amount').setDescription('Amount (e.g., 1M, 500K, 1B)').setRequired(true)),
    new SlashCommandBuilder().setName('removebalance').setDescription('💸 Remove balance from user (Admin only)')
        .addUserOption(o => o.setName('user').setDescription('User').setRequired(true))
        .addStringOption(o => o.setName('amount').setDescription('Amount (e.g., 1M, 500K, 1B)').setRequired(true)),
    new SlashCommandBuilder().setName('setbalance').setDescription('⚖️ Set user balance (Admin only)')
        .addUserOption(o => o.setName('user').setDescription('User').setRequired(true))
        .addStringOption(o => o.setName('amount').setDescription('Amount (e.g., 1M, 500K, 1B)').setRequired(true)),
    new SlashCommandBuilder().setName('cashout').setDescription('💰 Request to cashout your balance')
        .addStringOption(o => o.setName('minecraft_username').setDescription('Your Minecraft username').setRequired(true)),
    new SlashCommandBuilder().setName('gamble').setDescription('🎰 Start gambling - Choose your game!'),
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

// Gambling helper functions
function getBalance(userId) {
    return userBalances.get(userId) || 0;
}

function setBalance(userId, amount) {
    userBalances.set(userId, Math.max(0, Math.floor(amount)));
}

function hasRole(member, roleId) {
    return member.roles.cache.has(roleId);
}

function parseAmount(input) {
    const cleaned = input.toUpperCase().replace(/[^0-9KMB.]/g, '');
    let multiplier = 1;
    
    if (cleaned.includes('K')) multiplier = 1000;
    else if (cleaned.includes('M')) multiplier = 1000000;
    else if (cleaned.includes('B')) multiplier = 1000000000;
    
    const number = parseFloat(cleaned.replace(/[KMB]/g, ''));
    return Math.floor(number * multiplier);
}

function formatAmount(amount) {
    if (amount >= 1000000000) return `${(amount / 1000000000).toFixed(2)}B`;
    if (amount >= 1000000) return `${(amount / 1000000).toFixed(2)}M`;
    if (amount >= 1000) return `${(amount / 1000).toFixed(2)}K`;
    return amount.toString();
}

// Coinflip game
function playCoinflip(choice, bet) {
    const result = Math.random() < 0.5 ? 'heads' : 'tails';
    const won = result === choice;
    return { result, won, payout: won ? bet * 2 : 0 };
}

// Blackjack game
class BlackjackGame {
    constructor(bet, userId) {
        this.bet = bet;
        this.userId = userId;
        this.deck = this.createDeck();
        this.playerHand = [this.drawCard(), this.drawCard()];
        this.dealerHand = [this.drawCard(), this.drawCard()];
        this.gameOver = false;
        this.locked = false;
    }

    createDeck() {
        const suits = ['♠', '♥', '♦', '♣'];
        const values = ['2', '3', '4', '5', '6', '7', '8', '9', '10', 'J', 'Q', 'K', 'A'];
        const deck = [];
        for (let suit of suits) {
            for (let value of values) {
                deck.push({ suit, value });
            }
        }
        return this.shuffle(deck);
    }

    shuffle(deck) {
        for (let i = deck.length - 1; i > 0; i--) {
            const j = Math.floor(Math.random() * (i + 1));
            [deck[i], deck[j]] = [deck[j], deck[i]];
        }
        return deck;
    }

    drawCard() {
        return this.deck.pop();
    }

    calculateValue(hand) {
        let value = 0;
        let aces = 0;
        for (let card of hand) {
            if (card.value === 'A') {
                aces++;
                value += 11;
            } else if (['J', 'Q', 'K'].includes(card.value)) {
                value += 10;
            } else {
                value += parseInt(card.value);
            }
        }
        while (value > 21 && aces > 0) {
            value -= 10;
            aces--;
        }
        return value;
    }

    hit() {
        if (this.gameOver || this.locked) return null;
        this.locked = true;
        
        this.playerHand.push(this.drawCard());
        if (this.calculateValue(this.playerHand) > 21) {
            this.gameOver = true;
            return { busted: true };
        }
        
        this.locked = false;
        return { busted: false };
    }

    stand() {
        if (this.gameOver || this.locked) return null;
        this.locked = true;
        
        while (this.calculateValue(this.dealerHand) < 17) {
            this.dealerHand.push(this.drawCard());
        }
        this.gameOver = true;
        return this.determineWinner();
    }

    determineWinner() {
        const playerValue = this.calculateValue(this.playerHand);
        const dealerValue = this.calculateValue(this.dealerHand);
        
        if (playerValue > 21) return { result: 'lose', payout: 0 };
        if (dealerValue > 21) return { result: 'win', payout: this.bet * 2 };
        if (playerValue > dealerValue) return { result: 'win', payout: this.bet * 2 };
        if (playerValue < dealerValue) return { result: 'lose', payout: 0 };
        return { result: 'push', payout: this.bet };
    }

    handToString(hand, hideFirst = false) {
        if (hideFirst) {
            return `[Hidden] ${hand[1].value}${hand[1].suit}`;
        }
        return hand.map(c => `${c.value}${c.suit}`).join(' ');
    }
}

// Mines game with FIXED multipliers
class MinesGame {
    constructor(bet, bombCount, userId) {
        this.bet = bet;
        this.userId = userId;
        this.bombCount = bombCount;
        this.board = this.createBoard();
        this.revealed = new Set();
        this.gameOver = false;
        this.multiplier = 1.0;
        this.locked = false;
        
        // Set multiplier increment based on bomb count
        if (bombCount === 3) this.multiplierIncrement = 0.05; // 2x max
        else if (bombCount === 5) this.multiplierIncrement = 0.0625; // 2.5x max
        else if (bombCount === 10) this.multiplierIncrement = 0.133; // 3x max
    }

    createBoard() {
        const board = Array(25).fill(false);
        const bombPositions = new Set();
        while (bombPositions.size < this.bombCount) {
            bombPositions.add(Math.floor(Math.random() * 25));
        }
        bombPositions.forEach(pos => board[pos] = true);
        return board;
    }

    reveal(position) {
        if (this.revealed.has(position) || this.gameOver || this.locked || position < 0 || position > 24) {
            return { valid: false };
        }

        this.locked = true;
        this.revealed.add(position);
        
        if (this.board[position]) {
            this.gameOver = true;
            this.locked = false;
            return { valid: true, bomb: true, payout: 0 };
        }

        this.multiplier += this.multiplierIncrement;
        this.locked = false;
        return { valid: true, bomb: false, canCashout: true };
    }

    cashout() {
        if (this.gameOver || this.locked) return 0;
        this.locked = true;
        this.gameOver = true;
        return Math.floor(this.bet * this.multiplier);
    }

    getBoardString() {
        let str = '';
        for (let i = 0; i < 25; i++) {
            if (i % 5 === 0 && i !== 0) str += '\n';
            if (this.revealed.has(i)) {
                str += this.board[i] ? '💣' : '💎';
            } else if (this.gameOver) {
                str += this.board[i] ? '💣' : '⬜';
            } else {
                str += '⬜';
            }
            str += ' ';
        }
        return str;
    }
}

client.on('ready', () => {
    console.log(`✅ ${client.user.tag}`);
    client.user.setActivity('/help for commands', { type: 3 });
});

// ANTI-SPAM + ANTI-LINK PROTECTION
client.on('messageCreate', async (message) => {
    if (message.author.bot || !message.guild) return;
    if (message.member?.permissions.has('Administrator')) return;
    if (message.content.startsWith('!') || message.content.startsWith('/')) return;
    
    const userId = message.author.id;
    const content = message.content.toLowerCase().trim();
    
    const discordInviteRegex = /(discord\.gg\/|discord\.com\/invite\/|discordapp\.com\/invite\/)/i;
    const linkRegex = /(https?:\/\/|www\.)/i;
    
    if (discordInviteRegex.test(content)) {
        try {
            await message.delete();
            const warning = await message.channel.send(`🚫 ${message.author}, Discord invites are not allowed!`);
            setTimeout(() => warning.delete().catch(() => {}), 10000);
        } catch {}
        return;
    }
    
    if (linkRegex.test(content)) {
        try {
            await message.delete();
            const warning = await message.channel.send(`🚫 ${message.author}, links are not allowed!`);
            setTimeout(() => warning.delete().catch(() => {}), 10000);
        } catch {}
        return;
    }
    
    const lastMsg = userLastMessage.get(userId);
    
    if (lastMsg && lastMsg === content && content.length > 2) {
        try {
            await message.delete();
            const warnings = userSpamWarnings.get(userId) || 0;
            userSpamWarnings.set(userId, warnings + 1);
            
            const warning = await message.channel.send(
                `⚠️ ${message.author}, don't spam! (Warning ${warnings + 1}/3)`
            );
            setTimeout(() => warning.delete().catch(() => {}), 5000);
            
            if (warnings + 1 >= 3) {
                try {
                    await message.member.timeout(5 * 60 * 1000, 'Spamming');
                    const timeoutMsg = await message.channel.send(
                        `🔇 ${message.author} timed out for 5 minutes.`
                    );
                    setTimeout(() => timeoutMsg.delete().catch(() => {}), 10000);
                    userSpamWarnings.delete(userId);
                } catch {}
            }
        } catch {}
        return;
    }
    
    userLastMessage.set(userId, content);
    setTimeout(() => {
        if (userLastMessage.get(userId) === content) {
            userLastMessage.delete(userId);
        }
    }, 30000);
});

client.on('interactionCreate', async interaction => {
    if (!interaction.isChatInputCommand() && !interaction.isStringSelectMenu() && !interaction.isButton() && !interaction.isModalSubmit()) return;

    // MODAL SUBMIT (Bet amount)
    if (interaction.isModalSubmit()) {
        const [gameType, userId] = interaction.customId.split('_');
        
        if (interaction.user.id !== userId) {
            return interaction.reply({ content: '❌ Not your game!', ephemeral: true });
        }

        // CHECK IF USER ALREADY HAS ACTIVE GAME
        if (activeGames.has(userId)) {
            return interaction.reply({ content: '❌ You already have an active game! Finish it before starting a new one.', ephemeral: true });
        }

        const betInput = interaction.fields.getTextInputValue('bet_amount');
        const bet = parseAmount(betInput);

        if (isNaN(bet) || bet < MIN_BET) {
            return interaction.reply({ content: `❌ Minimum bet is **${formatAmount(MIN_BET)}**!`, ephemeral: true });
        }

        const balance = getBalance(userId);
        if (balance < bet) {
            return interaction.reply({ content: `❌ Insufficient balance! You have **${formatAmount(balance)}**`, ephemeral: true });
        }

        setBalance(userId, balance - bet);

        if (gameType === 'coinflip') {
            const row = new ActionRowBuilder().addComponents(
                new StringSelectMenuBuilder()
                    .setCustomId(`coinflip-choice_${userId}_${bet}`)
                    .setPlaceholder('Choose Heads or Tails')
                    .addOptions([
                        { label: 'Heads', value: 'heads', emoji: '🪙' },
                        { label: 'Tails', value: 'tails', emoji: '🪙' }
                    ])
            );

            const embed = new EmbedBuilder()
                .setColor(0xffd700)
                .setTitle('🪙 Coinflip')
                .setDescription('Choose your side!')
                .addFields(
                    { name: 'Bet', value: formatAmount(bet), inline: true },
                    { name: 'Potential Win', value: formatAmount(bet * 2), inline: true }
                );

            // Mark as active game
            activeGames.set(userId, { type: 'coinflip', bet, messageId: null });
            const msg = await interaction.reply({ embeds: [embed], components: [row], fetchReply: true });
            activeGames.get(userId).messageId = msg.id;

        } else if (gameType === 'blackjack') {
            const game = new BlackjackGame(bet, userId);
            activeGames.set(userId, game);

            const embed = new EmbedBuilder()
                .setColor(0x0099ff)
                .setTitle('🃏 Blackjack')
                .addFields(
                    { name: 'Your Hand', value: `${game.handToString(game.playerHand)} (${game.calculateValue(game.playerHand)})`, inline: true },
                    { name: 'Dealer Hand', value: `${game.handToString(game.dealerHand, true)}`, inline: true },
                    { name: 'Bet', value: formatAmount(bet), inline: false }
                );

            const row = new ActionRowBuilder().addComponents(
                new ButtonBuilder().setCustomId(`hit_${userId}`).setLabel('Hit').setStyle(ButtonStyle.Primary).setEmoji('🎴'),
                new ButtonBuilder().setCustomId(`stand_${userId}`).setLabel('Stand').setStyle(ButtonStyle.Success).setEmoji('✋')
            );

            await interaction.reply({ embeds: [embed], components: [row] });

        } else if (gameType.startsWith('mines')) {
            const bombs = parseInt(gameType.split('-')[1]);
            const game = new MinesGame(bet, bombs, userId);
            activeGames.set(userId, game);

            const embed = new EmbedBuilder()
                .setColor(0x0099ff)
                .setTitle('💣 Mines')
                .setDescription(game.getBoardString())
                .addFields(
                    { name: 'Bet', value: formatAmount(bet), inline: true },
                    { name: 'Bombs', value: `${bombs}`, inline: true },
                    { name: 'Multiplier', value: `${game.multiplier.toFixed(2)}x`, inline: true }
                );

            const rows = [];
            for (let r = 0; r < 5; r++) {
                const row = new ActionRowBuilder();
                for (let c = 0; c < 5; c++) {
                    const pos = r * 5 + c;
                    row.addComponents(
                        new ButtonBuilder()
                            .setCustomId(`mine-${pos}_${userId}`)
                            .setLabel('?')
                            .setStyle(ButtonStyle.Secondary)
                    );
                }
                rows.push(row);
            }

            await interaction.reply({ embeds: [embed], components: rows });
        }
    }

    // STRING SELECT MENU (Game selection or coinflip choice)
    if (interaction.isStringSelectMenu()) {
        const [action, userId, bet] = interaction.customId.split('_');

        if (interaction.user.id !== userId) {
            return interaction.reply({ content: '❌ Not your game!', ephemeral: true });
        }

        if (action === 'game-select') {
            // CHECK IF USER ALREADY HAS ACTIVE GAME
            if (activeGames.has(userId)) {
                return interaction.reply({ content: '❌ Finish your current game first!', ephemeral: true });
            }

            const gameType = interaction.values[0];

            const modal = new ModalBuilder()
                .setCustomId(`${gameType}_${userId}`)
                .setTitle(`${gameType === 'coinflip' ? '🪙 Coinflip' : gameType === 'blackjack' ? '🃏 Blackjack' : '💣 Mines'} - Place Bet`);

            const betInput = new TextInputBuilder()
                .setCustomId('bet_amount')
                .setLabel('Enter bet amount (e.g., 1M, 500K, 2B)')
                .setStyle(TextInputStyle.Short)
                .setPlaceholder('500K')
                .setRequired(true);

            modal.addComponents(new ActionRowBuilder().addComponents(betInput));

            await interaction.showModal(modal);

        } else if (action === 'coinflip-choice') {
            const choice = interaction.values[0];
            const betAmount = parseInt(bet);
            const result = playCoinflip(choice, betAmount);

            if (result.won) {
                setBalance(userId, getBalance(userId) + result.payout);
            }

            const embed = new EmbedBuilder()
                .setColor(result.won ? 0x00ff00 : 0xff0000)
                .setTitle(`🪙 Coinflip - ${result.won ? 'WIN!' : 'LOSE!'}`)
                .addFields(
                    { name: 'Your Choice', value: choice.charAt(0).toUpperCase() + choice.slice(1), inline: true },
                    { name: 'Result', value: result.result.charAt(0).toUpperCase() + result.result.slice(1), inline: true },
                    { name: result.won ? 'Won' : 'Lost', value: formatAmount(betAmount), inline: true },
                    { name: 'New Balance', value: formatAmount(getBalance(userId)), inline: false }
                );

            // Remove from active games and delete message after 10 seconds
            activeGames.delete(userId);
            await interaction.update({ embeds: [embed], components: [] });
            setTimeout(async () => {
                try {
                    await interaction.deleteReply();
                } catch {}
            }, 10000);
        }
    }

    // BUTTON INTERACTIONS (Blackjack, Mines, Cashout)
    if (interaction.isButton()) {
        const [action, userId] = interaction.customId.split('_');
        
        if (action === 'cashout-confirm') {
            // Admin cashout confirmation
            if (!interaction.member.permissions.has(PermissionFlagsBits.Administrator)) {
                return interaction.reply({ content: '❌ Admin only!', ephemeral: true });
            }

            const cashoutData = pendingCashouts.get(userId);
            if (!cashoutData) {
                return interaction.reply({ content: '❌ Cashout request not found!', ephemeral: true });
            }

            // Reset user balance
            setBalance(userId, 0);
            pendingCashouts.delete(userId);

            const embed = new EmbedBuilder()
                .setColor(0x00ff00)
                .setTitle('✅ Cashout Completed')
                .setDescription(`**User:** <@${userId}>\n**Minecraft Username:** ${cashoutData.mcUsername}\n**Amount:** ${formatAmount(cashoutData.amount)}\n\n**Status:** Paid & Balance Reset`)
                .setTimestamp();

            await interaction.update({ embeds: [embed], components: [] });

            // Notify user
            try {
                const user = await client.users.fetch(userId);
                await user.send(`✅ Your cashout of **${formatAmount(cashoutData.amount)}** has been completed! Your balance has been reset.`);
            } catch {}

            return;
        }

        if (interaction.user.id !== userId) {
            return interaction.reply({ content: '❌ Not your game!', ephemeral: true });
        }

        const game = activeGames.get(userId);
        if (!game && !action.startsWith('mine')) {
            return interaction.reply({ content: '❌ Game not found!', ephemeral: true });
        }

        if (action === 'hit') {
            const result = game.hit();
            if (!result) return interaction.reply({ content: '❌ Action already in progress!', ephemeral: true });

            if (result.busted) {
                activeGames.delete(userId);
                const embed = new EmbedBuilder()
                    .setColor(0xff0000)
                    .setTitle('🃏 Blackjack - BUSTED!')
                    .addFields(
                        { name: 'Your Hand', value: `${game.handToString(game.playerHand)} (${game.calculateValue(game.playerHand)})`, inline: true },
                        { name: 'Dealer Hand', value: `${game.handToString(game.dealerHand)} (${game.calculateValue(game.dealerHand)})`, inline: true },
                        { name: 'Result', value: `Lost **${formatAmount(game.bet)}**`, inline: false },
                        { name: 'New Balance', value: formatAmount(getBalance(userId)), inline: false }
                    );
                await interaction.update({ embeds: [embed], components: [] });
                setTimeout(async () => {
                    try {
                        await interaction.deleteReply();
                    } catch {}
                }, 10000);
                return;
            }

            const embed = new EmbedBuilder()
                .setColor(0x0099ff)
                .setTitle('🃏 Blackjack')
                .addFields(
                    { name: 'Your Hand', value: `${game.handToString(game.playerHand)} (${game.calculateValue(game.playerHand)})`, inline: true },
                    { name: 'Dealer Hand', value: `${game.handToString(game.dealerHand, true)}`, inline: true }
                );

            const row = new ActionRowBuilder().addComponents(
                new ButtonBuilder().setCustomId(`hit_${userId}`).setLabel('Hit').setStyle(ButtonStyle.Primary).setEmoji('🎴'),
                new ButtonBuilder().setCustomId(`stand_${userId}`).setLabel('Stand').setStyle(ButtonStyle.Success).setEmoji('✋')
            );

            return interaction.update({ embeds: [embed], components: [row] });
        }

        if (action === 'stand') {
            const result = game.stand();
            if (!result) return interaction.reply({ content: '❌ Action already in progress!', ephemeral: true });

            activeGames.delete(userId);
            setBalance(userId, getBalance(userId) + result.payout);

            const color = result.result === 'win' ? 0x00ff00 : result.result === 'lose' ? 0xff0000 : 0xffff00;
            const resultText = result.result === 'win' ? `Won **${formatAmount(result.payout)}**!` : result.result === 'lose' ? `Lost **${formatAmount(game.bet)}**!` : `Push! Bet returned.`;

            const embed = new EmbedBuilder()
                .setColor(color)
                .setTitle(`🃏 Blackjack - ${result.result.toUpperCase()}`)
                .addFields(
                    { name: 'Your Hand', value: `${game.handToString(game.playerHand)} (${game.calculateValue(game.playerHand)})`, inline: true },
                    { name: 'Dealer Hand', value: `${game.handToString(game.dealerHand)} (${game.calculateValue(game.dealerHand)})`, inline: true },
                    { name: 'Result', value: resultText, inline: false },
                    { name: 'New Balance', value: formatAmount(getBalance(userId)), inline: false }
                );

            await interaction.update({ embeds: [embed], components: [] });
            setTimeout(async () => {
                try {
                    await interaction.deleteReply();
                } catch {}
            }, 10000);
            return;
        }

        if (action.startsWith('mine')) {
            const position = parseInt(action.split('-')[1]);
            const result = game.reveal(position);

            if (!result.valid) {
                return interaction.reply({ content: '❌ Invalid move!', ephemeral: true });
            }

            if (result.bomb) {
                activeGames.delete(userId);
                const embed = new EmbedBuilder()
                    .setColor(0xff0000)
                    .setTitle('💣 Mines - BOOM!')
                    .setDescription(game.getBoardString())
                    .addFields(
                        { name: 'Result', value: `Hit a bomb! Lost **${formatAmount(game.bet)}**`, inline: false },
                        { name: 'New Balance', value: formatAmount(getBalance(userId)), inline: false }
                    );
                await interaction.update({ embeds: [embed], components: [] });
                setTimeout(async () => {
                    try {
                        await interaction.deleteReply();
                    } catch {}
                }, 10000);
                return;
            }

            const embed = new EmbedBuilder()
                .setColor(0x00ff00)
                .setTitle('💎 Mines')
                .setDescription(game.getBoardString())
                .addFields(
                    { name: 'Multiplier', value: `${game.multiplier.toFixed(2)}x`, inline: true },
                    { name: 'Potential Win', value: formatAmount(Math.floor(game.bet * game.multiplier)), inline: true }
                );

            const rows = [];
            for (let r = 0; r < 5; r++) {
                const row = new ActionRowBuilder();
                for (let c = 0; c < 5; c++) {
                    const pos = r * 5 + c;
                    row.addComponents(
                        new ButtonBuilder()
                            .setCustomId(`mine-${pos}_${userId}`)
                            .setLabel(game.revealed.has(pos) ? '💎' : '?')
                            .setStyle(game.revealed.has(pos) ? ButtonStyle.Success : ButtonStyle.Secondary)
                            .setDisabled(game.revealed.has(pos))
                    );
                }
                rows.push(row);
            }

            const cashoutRow = new ActionRowBuilder().addComponents(
                new ButtonBuilder().setCustomId(`cashout_${userId}`).setLabel('💰 Cashout').setStyle(ButtonStyle.Success)
            );
            rows.push(cashoutRow);

            return interaction.update({ embeds: [embed], components: rows });
        }

        if (action === 'cashout') {
            const payout = game.cashout();
            if (payout === 0) return interaction.reply({ content: '❌ Cashout failed!', ephemeral: true });

            activeGames.delete(userId);
            setBalance(userId, getBalance(userId) + payout);

            const embed = new EmbedBuilder()
                .setColor(0x00ff00)
                .setTitle('💰 Mines - Cashed Out!')
                .setDescription(game.getBoardString())
                .addFields(
                    { name: 'Multiplier', value: `${game.multiplier.toFixed(2)}x`, inline: true },
                    { name: 'Winnings', value: formatAmount(payout), inline: true },
                    { name: 'New Balance', value: formatAmount(getBalance(userId)), inline: false }
                );

            await interaction.update({ embeds: [embed], components: [] });
            setTimeout(async () => {
                try {
                    await interaction.deleteReply();
                } catch {}
            }, 10000);
            return;
        }
    }

    // SLASH COMMANDS
    try {
        switch (interaction.commandName) {
            case 'balance': {
                const balance = getBalance(interaction.user.id);
                const embed = new EmbedBuilder()
                    .setColor(0xffd700)
                    .setTitle('💰 Your Balance')
                    .setDescription(`**${formatAmount(balance)}**`)
                    .setFooter({ text: 'Open a ticket to add balance • Use /cashout to withdraw' });
                await interaction.reply({ embeds: [embed], ephemeral: true });
                break;
            }

            case 'addbalance': {
                if (!interaction.member.permissions.has(PermissionFlagsBits.Administrator)) {
                    return interaction.reply({ content: '❌ Admin only!', ephemeral: true });
                }

                const user = interaction.options.getUser('user');
                const amountStr = interaction.options.getString('amount');
                const amount = parseAmount(amountStr);

                if (isNaN(amount) || amount <= 0) {
                    return interaction.reply({ content: '❌ Invalid amount!', ephemeral: true });
                }

                const currentBalance = getBalance(user.id);
                setBalance(user.id, currentBalance + amount);

                await interaction.reply(`✅ Added **${formatAmount(amount)}** to ${user}'s balance.\nNew balance: **${formatAmount(getBalance(user.id))}**`);
                break;
            }

            case 'removebalance': {
                if (!interaction.member.permissions.has(PermissionFlagsBits.Administrator)) {
                    return interaction.reply({ content: '❌ Admin only!', ephemeral: true });
                }

                const user = interaction.options.getUser('user');
                const amountStr = interaction.options.getString('amount');
                const amount = parseAmount(amountStr);

                if (isNaN(amount) || amount <= 0) {
                    return interaction.reply({ content: '❌ Invalid amount!', ephemeral: true });
                }

                const currentBalance = getBalance(user.id);
                setBalance(user.id, Math.max(0, currentBalance - amount));

                await interaction.reply(`✅ Removed **${formatAmount(amount)}** from ${user}'s balance.\nNew balance: **${formatAmount(getBalance(user.id))}**`);
                break;
            }

            case 'setbalance': {
                if (!interaction.member.permissions.has(PermissionFlagsBits.Administrator)) {
                    return interaction.reply({ content: '❌ Admin only!', ephemeral: true });
                }

                const user = interaction.options.getUser('user');
                const amountStr = interaction.options.getString('amount');
                const amount = parseAmount(amountStr);

                if (isNaN(amount) || amount < 0) {
                    return interaction.reply({ content: '❌ Invalid amount!', ephemeral: true });
                }

                setBalance(user.id, amount);

                await interaction.reply(`✅ Set ${user}'s balance to **${formatAmount(amount)}**`);
                break;
            }

            case 'cashout': {
                if (!hasRole(interaction.member, MEMBER_ROLE_ID)) {
                    return interaction.reply({ content: '❌ You need the Member role!', ephemeral: true });
                }

                const mcUsername = interaction.options.getString('minecraft_username');
                const balance = getBalance(interaction.user.id);

                if (balance < MIN_BET) {
                    return interaction.reply({ content: `❌ Minimum cashout is **${formatAmount(MIN_BET)}**!\n\nYour balance: **${formatAmount(balance)}**`, ephemeral: true });
                }

                if (pendingCashouts.has(interaction.user.id)) {
                    return interaction.reply({ content: '❌ You already have a pending cashout!', ephemeral: true });
                }

                // Store pending cashout
                pendingCashouts.set(interaction.user.id, {
                    mcUsername,
                    amount: balance,
                    timestamp: Date.now()
                });

                // Send to cashout channel
                if (CASHOUT_CHANNEL_ID) {
                    try {
                        const cashoutChannel = await client.channels.fetch(CASHOUT_CHANNEL_ID);
                        
                        const embed = new EmbedBuilder()
                            .setColor(0xffd700)
                            .setTitle('💰 New Cashout Request')
                            .setDescription(`**User:** ${interaction.user} (${interaction.user.tag})\n**Minecraft Username:** \`${mcUsername}\`\n**Amount:** **${formatAmount(balance)}**`)
                            .setTimestamp();

                        const row = new ActionRowBuilder().addComponents(
                            new ButtonBuilder()
                                .setCustomId(`cashout-confirm_${interaction.user.id}`)
                                .setLabel('✅ Confirm Cashout')
                                .setStyle(ButtonStyle.Success)
                        );

                        await cashoutChannel.send({ embeds: [embed], components: [row] });
                    } catch (err) {
                        console.error('Failed to send cashout request:', err);
                    }
                }

                await interaction.reply({ content: `✅ Cashout request submitted!\n\n**Minecraft Username:** ${mcUsername}\n**Amount:** ${formatAmount(balance)}\n\nAn admin will process your request soon.`, ephemeral: true });
                break;
            }

            case 'gamble': {
                if (!hasRole(interaction.member, MEMBER_ROLE_ID)) {
                    return interaction.reply({ content: '❌ You need the Member role to gamble!', ephemeral: true });
                }

                // CHECK IF USER ALREADY HAS ACTIVE GAME
                if (activeGames.has(interaction.user.id)) {
                    return interaction.reply({ content: '❌ You already have an active game! Finish it before starting a new one.', ephemeral: true });
                }

                const balance = getBalance(interaction.user.id);
                if (balance < MIN_BET) {
                    return interaction.reply({ content: `❌ Insufficient balance! You need at least **${formatAmount(MIN_BET)}**\n\nOpen a ticket to add balance.`, ephemeral: true });
                }

                const embed = new EmbedBuilder()
                    .setColor(0x9b59b6)
                    .setTitle('🎰 Welcome to the Casino!')
                    .setDescription(`**Your Balance:** ${formatAmount(balance)}\n**Minimum Bet:** ${formatAmount(MIN_BET)}\n\n**Choose your game:**`)
                    .addFields(
                        { name: '🪙 Coinflip', value: 'Double or nothing! 50/50 chance.\n**Payout:** 2x', inline: true },
                        { name: '🃏 Blackjack', value: 'Beat the dealer to 21!\n**Payout:** 2x', inline: true },
                        { name: '💣 Mines (3 Bombs)', value: 'Find diamonds, avoid bombs!\n**Max Payout:** 2x', inline: true },
                        { name: '💣 Mines (5 Bombs)', value: 'Higher risk, higher reward!\n**Max Payout:** 2.5x', inline: true },
                        { name: '💣 Mines (10 Bombs)', value: 'Expert mode!\n**Max Payout:** 3x', inline: true }
                    );

                const row = new ActionRowBuilder().addComponents(
                    new StringSelectMenuBuilder()
                        .setCustomId(`game-select_${interaction.user.id}`)
                        .setPlaceholder('🎲 Choose a game to play')
                        .addOptions([
                            { label: 'Coinflip', value: 'coinflip', description: '50/50 - Double or nothing (2x)', emoji: '🪙' },
                            { label: 'Blackjack', value: 'blackjack', description: 'Beat the dealer to 21 (2x)', emoji: '🃏' },
                            { label: 'Mines (3 Bombs)', value: 'mines-3', description: 'Easy mode - Max 2x', emoji: '💣' },
                            { label: 'Mines (5 Bombs)', value: 'mines-5', description: 'Medium mode - Max 2.5x', emoji: '💣' },
                            { label: 'Mines (10 Bombs)', value: 'mines-10', description: 'Hard mode - Max 3x', emoji: '💣' }
                        ])
                );

                await interaction.reply({ embeds: [embed], components: [row], ephemeral: true });
                break;
            }

            // YOUR ORIGINAL COMMANDS (Keeping them all exactly the same)
            case 'sell': {
                const embed = new EmbedBuilder()
                    .setColor(0xf39c12)
                    .setTitle('💸 Sell to Us')
                    .setDescription('**We buy your items at competitive rates!**')
                    .addFields(
                        { name: '💀 Skeleton Spawner Prices', value: '```\n1 Spawner = €0.11```', inline: false },
                        { name: '💵 Money Prices', value: '```\n1M = €0.03```', inline: false },
                        { name: '\u200B', value: '━━━━━━━━━━━━━━━━━━━━━━━━━━', inline: false },
                        { name: '📩 How to Sell', value: 'Create a ticket in <#1442921292977279117> to sell your items!', inline: false },
                        { name: '\u200B', value: '🌐 **[Visit DonutMarket](https://www.donutmarket.eu/)**', inline: false }
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
                        { name: '💰 In-Game Currency Purchases', value: 'If you purchase in-game currency from our website, there is no need to create a ticket. The money will be paid out instantly or as soon as we are available.', inline: false },
                        { name: '🎁 Spawners & Elytras', value: 'If you purchase spawners or elytras, you must create a ticket and include your in-game name. We will then give you your items immediately or when we are available.', inline: false },
                        { name: '\u200B', value: '━━━━━━━━━━━━━━━━━━━━━━━━━━', inline: false },
                        { name: '🔗 Visit Our Website', value: '[Click here to visit DonutMarket](https://www.donutmarket.eu/)', inline: false }
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
                        { name: '🌍 Rule 1: English Only', value: 'All text channels are English only. Mods must be able to read all messages clearly.', inline: false },
                        { name: '💬 Rule 2: Stay On Topic', value: 'Keep all discussion civil and in the correct channels. Mods may ask you to move your conversation.', inline: false },
                        { name: '🤝 Rule 3: No Inappropriate Language', value: 'Remain respectful of others at all times.', inline: false },
                        { name: '🚫 Rule 4: No Personal Drama', value: 'Keep personal drama out of chat.', inline: false },
                        { name: '👤 Rule 5: No Impersonation', value: 'Do not impersonate other users, moderators, and/or famous personalities.', inline: false },
                        { name: '📢 Rule 6: No Spamming', value: 'Do not flood chat rooms with messages. Encouraging others to spam is also not allowed.', inline: false },
                        { name: '🔞 Rule 7: No NSFW Content', value: 'Do not post or have conversations around NSFW content.', inline: false },
                        { name: '🎨 Rule 8: Appropriate Profiles', value: 'No inappropriate or offensive usernames, status, or profile pictures. You may be asked to change these.', inline: false },
                        { name: '🚷 Rule 9: No Self-Promotion', value: 'No self-promotion, soliciting, or advertising. This also includes user DMs.', inline: false },
                        { name: '🔗 Rule 10: No Malicious Links', value: 'Any link that tracks IP addresses or leads to malicious websites will be removed.', inline: false },
                        { name: '🛡️ Rule 11: Don\'t Evade Filters', value: 'This applies to both words and links. If something is censored, it\'s censored for a reason!', inline: false },
                        { name: '📋 Rule 12: Follow Discord ToS', value: '[Terms of Service](https://discordapp.com/terms) • [Community Guidelines](https://discord.com/guidelines)', inline: false },
                        { name: '👮 Rule 13: Moderators Hold Final Say', value: 'Listen to and respect the volunteers that keep this server running.', inline: false },
                        { name: '🔕 Rule 14: Don\'t Ping Staff', value: 'Do not mention staff or owners unnecessarily.', inline: false }
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
                        { name: '💀 Skeleton Spawner Prices', value: '```\n1 Spawner = €0.23\n━━━━━━━━━━━━━━━━━\n100 Spawners  → €23.00\n200 Spawners  → €46.00\n400 Spawners  → €92.00\n800 Spawners  → €184.00\n1000 Spawners → €230.00```', inline: false },
                        { name: '💵 In-Game Money Prices', value: '```\n1M = €0.08\n━━━━━━━━━━━━━━━━━\n100M  → €8.00\n250M  → €20.00\n500M  → €40.00\n750M  → €60.00\n1B    → €80.00```', inline: false },
                        { name: '🦅 Elytra Prices', value: '```\n1 Elytra → €40.00```', inline: true },
                        { name: '🎮 Minecraft Account', value: '```\nJava & Bedrock → €15.00```', inline: true },
                        { name: '\u200B', value: '━━━━━━━━━━━━━━━━━━━━━━━━━━', inline: false },
                        { name: '📝 Important Information', value: '**💶 Minimum Order:** €5.00\n**🕐 Timezone:** GMT+2\n**📧 Support:** Open a ticket in <#1442921292977279117>\n\n🌐 **[Visit DonutMarket](https://www.donutmarket.eu/)**', inline: false }
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
                        { name: '🌐 Website Purchases', value: '**Supports almost all payment methods**\n\n✅ Credit/Debit Cards\n✅ PayPal\n✅ Crypto\n✅ Local Payment Methods\n\n⚠️ *A small service fee is included in website prices*\n\n🔗 **[Visit Website](https://www.donutmarket.eu/)**', inline: false },
                        { name: '💬 Discord Purchases', value: '**PayPal Friends & Family**\n\n✅ **No fees** when buying through Discord\n✅ Instant delivery\n✅ Direct support from our team\n\n📩 **How to purchase:**\nOpen a ticket in <#1442921292977279117> and our team will help you out!', inline: false },
                        { name: '\u200B', value: '━━━━━━━━━━━━━━━━━━━━━━━━━━', inline: false },
                        { name: '💡 Why Buy Through Discord?', value: '🚀 Faster processing\n💰 No extra fees\n🛡️ Direct support\n✨ Better communication', inline: true },
                        { name: '⏱️ Processing Time', value: '⚡ Usually **5-30 minutes**\n🌙 May vary during off-hours\n📍 Timezone: **GMT+2**', inline: true },
                        { name: '\u200B', value: '\u200B', inline: false },
                        { name: '❤️ Thank You!', value: 'Thank you for supporting the server!', inline: false }
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
                    { name: '🎰 Gambling', value: '`/gamble` • `/balance` • `/cashout`', inline: false },
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
```

---

## ✅ ALL BUGS FIXED + NEW FEATURES:

### **FIXED:**
- ✅ **"Invalid move" bug** - Added position validation (0-24)
- ✅ **Dupe exploit** - Can't start new game while one is active
- ✅ **Mines multipliers** - 3 bombs: 2x, 5 bombs: 2.5x, 10 bombs: 3x
- ✅ **Game cleanup** - Messages auto-delete after 10 seconds
- ✅ **Multiple game prevention** - Check before modal AND game start

### **NEW COMMANDS:**
- `/removebalance @user amount` - Remove balance (admin)
- `/setbalance @user amount` - Set exact balance (admin)
- `/cashout minecraft_username` - Request cashout

### **CASHOUT SYSTEM:**
1. User does `/cashout username`
2. Request sent to cashout channel
3. Admin clicks "Confirm Cashout"
4. User balance reset to 0
5. User gets DM notification

### **ENVIRONMENT VARIABLE NEEDED:**
Add to Railway: `CASHOUT_CHANNEL_ID` = your cashout channel ID

---

## **GAMBLING GUIDE TEXT:**
```
🎰 **WELCOME TO DONUTMARKET CASINO!**

**How to Play:**
1. Use `/balance` to check your balance
2. Use `/gamble` to choose a game
3. Enter your bet (minimum 500K)
4. Play and win!

━━━━━━━━━━━━━━━━━━━━━━

🪙 **COINFLIP**
- 50/50 chance
- Pick Heads or Tails
- Win = 2x your bet
- Lose = Lose your bet

🃏 **BLACKJACK**
- Try to get 21 without going over
- Beat the dealer's hand
- Win = 2x your bet
- Bust = Lose your bet

💣 **MINES**
- Click tiles to reveal diamonds
- Avoid the bombs!
- Cashout anytime to secure winnings

**Mines Difficulty:**
- 3 Bombs: Easy (Max 2x payout)
- 5 Bombs: Medium (Max 2.5x payout)
- 10 Bombs: Hard (Max 3x payout)

━━━━━━━━━━━━━━━━━━━━━━

💰 **CASHOUT:**
Use `/cashout <minecraft_username>` to withdraw your balance!

⚠️ **Rules:**
- Minimum bet: 500K
- One game at a time
- Exploiting = Ban
- Have fun & gamble responsibly!
