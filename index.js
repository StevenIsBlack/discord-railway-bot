require("dotenv").config();
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

// ---------- INVITE LIST ----------

let inviteList = []; // in-memory list of users

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

    if (inviteList.includes(user.id)) {
      await interaction.reply(`${user.tag} is already on the invite list.`);
      return;
    }

    inviteList.push(user.id);
    await interaction.reply(`${user.tag} has been added to the invite list.`);
  }

  if (commandName === "invlist") {
    if (inviteList.length === 0) {
      await interaction.reply("The invite list is currently empty.");
      return;
    }

    const mentions = inviteList.map(id => `<@${id}>`).join("\n");
    await interaction.reply(`**Invite List:**\n${mentions}`);
  }

  if (commandName === "invlistreset") {
    inviteList = [];
    await interaction.reply("The invite list has been cleared.");
  }
});

client.login(process.env.TOKEN);
