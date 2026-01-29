require("dotenv").config();
const fs = require("fs");
const {
  Client,
  GatewayIntentBits,
  REST,
  Routes,
  SlashCommandBuilder
} = require("discord.js");

const client = new Client({
  intents: [GatewayIntentBits.Guilds],
});

// ---------- INVITE LIST PERSISTENCE ----------

const DATA_FILE = "./invites.json";

// Load invite list from file or start empty
let inviteList = {};
if (fs.existsSync(DATA_FILE)) {
  try {
    inviteList = JSON.parse(fs.readFileSync(DATA_FILE, "utf-8"));
  } catch (err) {
    console.error("Failed to read invite list:", err);
    inviteList = {};
  }
}

// Helper to save invite list
function saveInviteList() {
  fs.writeFileSync(DATA_FILE, JSON.stringify(inviteList, null, 2));
}

// ---------- COMMANDS ----------

const commands = [
  new SlashCommandBuilder()
    .setName("website")
    .setDescription("Get my website link"),

  new SlashCommandBuilder()
    .setName("vouch")
    .setDescription("Send the vouch message"),

  new SlashCommandBuilder()
    .setName("reward")
    .setDescription("Send the reward message"),

  new SlashCommandBuilder()
    .setName("inviteadd")
    .setDescription("Add a user to the invite list")
    .addUserOption(option =>
      option.setName("user")
        .setDescription("The user to add")
        .setRequired(true)
    )
    .addIntegerOption(option =>
      option.setName("amount")
        .setDescription("Number of invites to add")
        .setRequired(false)
    ),

  new SlashCommandBuilder()
    .setName("invlist")
    .setDescription("See the list of invited users"),

  new SlashCommandBuilder()
    .setName("invlistreset")
    .setDescription("Clear the invite list"),
].map(c => c.toJSON());

// ---------- REGISTER ----------

const rest = new REST({ version: "10" }).setToken(process.env.TOKEN);

(async () => {
  try {
    await rest.put(
      Routes.applicationCommands(process.env.CLIENT_ID),
      { body: commands }
    );
    console.log("Commands registered.");
  } catch (err) {
    console.error(err);
  }
})();

// ---------- READY ----------

client.once("ready", () => {
  console.log(`Logged in as ${client.user.tag}`);
});

// ---------- HANDLER ----------

client.on("interactionCreate", async interaction => {
  if (!interaction.isChatInputCommand()) return;

  const { commandName } = interaction;

  if (commandName === "website") {
    await interaction.reply("https://www.donutmarket.eu/");
  }

  if (commandName === "vouch") {
    await interaction.reply("When you have received your product/s please vouch at <#1449355333637115904>");
  }

  if (commandName === "reward") {
    await interaction.reply("Thank you for inviting, please leave a vouch at <#1447280588842336368>");
  }

  if (commandName === "inviteadd") {
    const user = interaction.options.getUser("user");
    const amount = interaction.options.getInteger("amount") || 1;

    if (!inviteList[user.id]) inviteList[user.id] = 0;
    inviteList[user.id] += amount;

    saveInviteList();

    await interaction.reply(`${user.tag} has been added with **${amount} invite(s)**. Total: **${inviteList[user.id]}**`);
  }

  if (commandName === "invlist") {
    const entries = Object.entries(inviteList);
    if (entries.length === 0) {
      await interaction.reply("The invite list is currently empty.");
      return;
    }

    // Build a clean list
    const formattedList = entries
      .map(([id, count], index) => `${index + 1}. <@${id}> - ${count} invite(s)`)
      .join("\n");

    await interaction.reply(`**Invite List:**\n${formattedList}`);
  }

  if (commandName === "invlistreset") {
    inviteList = {};
    saveInviteList();
    await interaction.reply("The invite list has been cleared.");
  }
});

client.login(process.env.TOKEN);
