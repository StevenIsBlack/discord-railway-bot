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

  if (interaction.commandName === "website") {
    await interaction.reply("https://www.donutmarket.eu/");
  }

  if (interaction.commandName === "vouch") {
    await interaction.reply("When you have recieved your product pelase vouch #vouches");
  }

  if (interaction.commandName === "reward") {
    await interaction.reply("Pelase vouch #vouches-rewards");
  }
});

client.login(process.env.TOKEN);
