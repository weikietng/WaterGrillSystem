require("dotenv").config();
const mongoose = require("mongoose");

const fs = require("node:fs");
const path = require("node:path");
const {
  Client,
  Collection,
  Events,
  GatewayIntentBits,
  EmbedBuilder,
  Embed,
} = require("discord.js");

const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMembers,
    GatewayIntentBits.GuildModeration,
    GatewayIntentBits.GuildPresences,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.GuildMessageTyping,
    GatewayIntentBits.DirectMessages,
    GatewayIntentBits.DirectMessageTyping,
  ],
});

client.commands = new Collection();
const foldersPath = path.join(__dirname, "commands");
const commandFolders = fs.readdirSync(foldersPath);

for (const folder of commandFolders) {
  const commandsPath = path.join(foldersPath, folder);
  const commandFiles = fs
    .readdirSync(commandsPath)
    .filter((file) => file.endsWith(".js"));
  for (const file of commandFiles) {
    const filePath = path.join(commandsPath, file);
    const command = require(filePath);
    if ("data" in command && "execute" in command) {
      client.commands.set(command.data.name, command);
    } else {
      console.log(
        `[WARNING] The command at ${filePath} is missing a required "data" or "execute" property.`
      );
    }
  }
}

client.once(Events.ClientReady, async (readyClient) => {
  console.log(`Ready! Logged in as ${readyClient.user.tag}`);
  mongoose.connect(process.env.MONGO_URI);
  const messageStore = require("./schemas/importantMessagesSchema");
  const guild = await client.guilds.cache.get(process.env.GUILD_ID);
  const channel = await guild.channels.cache.find(
    (channel) => channel.name === "sessions"
  );
  function sessionMessage(){
    let sessionCount = 0;
    let description = `# Session Information\nBelow here are all of our upcoming sessions.\n\n`;

    const options = {
      method: "GET",
      headers: { Authorization: `Bearer ${process.env.HYRA_KEY}` },
    };
    fetch(
      `https://api.hyra.io/activity/sessions/${process.env.HYRA_WORKSPACE}/upcoming`,
      options
    )
      .then((response) => response.json())
      .then((sessions) => {
        sessions.forEach((session) => {
          if (
            session.host &&
            session.host.exists &&
            session.co_host &&
            session.co_host.exists
          ) {
            sessionCount++;
            let sessionTime = session.start;
            let epochTime = new Date(sessionTime).getTime() / 1000;
            if (sessionCount === 1) {
              description += `## Next Session: \n**${session.schedule.name}**\nHosted by **${session.host.username}** & **${session.co_host.username}** \nTime: <t:${epochTime}:f> (<t:${epochTime}:R>)`;
            } else if (sessionCount === 2) {
              description += `\n\n## Upcoming Sessions: \n**${session.schedule.name}**\nHosted by **${session.host.username}** & **${session.co_host.username}** \nTime: <t:${epochTime}:f> (<t:${epochTime}:R>)`;
            } else {
              description += `\n\n**${session.schedule.name}**\nHosted by **${session.host.username}** & **${session.co_host.username}** \n Time: <t:${epochTime}:f> (<t:${epochTime}:R>)`;
            }
          }
        });
        if (sessionCount === 0) {
          description =
            "No upcoming sessions are scheduled. Please come back to the channel and check again later.";
        }
        description += `\n\n\n*This message is automatically refreshed every 2 minutes.*`;
        const embed = new EmbedBuilder()
          .setDescription(description)
          .setFooter({ text: "Water Grill Sessions" })
          .setColor("#ffe1a2")
          .setTimestamp();
        messageStore
          .findOne({ messageName: "sessions" })
          .then(async (doc) => {
            if (doc) {
              channel.messages
              .fetch(doc.messageId)
              .then(async (message) => {
                if (!message) {
                  let newMessage = await channel.send({ embeds: [embed] });
                  await messageStore.findOneAndUpdate(
                    { messageName: "sessions" },
                    { messageId: newMessage.id }
                  );
                  return;
                }
                await message
                  .edit({ embeds: [embed] })
                  .catch((error) =>
                    console.error(`Error editing message: ${error}`)
                  );
              })
              .catch((error) =>
                console.error(`Error fetching message: ${error}`)
              );
            } else {
              let message = await channel.send({ embeds: [embed] });
            await messageStore.create({
              messageId: message.id,
              messageName: "sessions",
            })
            }
          })
          .catch((err) => console.error(err));
      })
      .catch((err) => console.error(err));
  }
  sessionMessage();
  setInterval(() => {
    sessionMessage();
  }, 120000);
});

client.on(Events.InteractionCreate, async (interaction) => {
  if (!interaction.isChatInputCommand()) return;
  const command = interaction.client.commands.get(interaction.commandName);

  if (!command) {
    console.error(`No command matching ${interaction.commandName} was found.`);
    return;
  }

  try {
    await command.execute(interaction);
  } catch (error) {
    console.error(error);
    if (interaction.replied || interaction.deferred) {
      await interaction.followUp({
        content: "There was an error while executing this command!",
        ephemeral: true,
      });
    } else {
      await interaction.reply({
        content: "There was an error while executing this command!",
        ephemeral: true,
      });
    }
  }
});

mongoose.connection.on("connected", () => {
  console.log("Mongo DB connected");
});

// Listen for connection errors
mongoose.connection.on("error", (err) => {
  console.error("Mongoose connection error:", err);
});

// Listen for disconnection
mongoose.connection.on("disconnected", () => {
  console.log("Mongoose disconnected");
});

client.on("error", (error) => {
  console.error(error);
});

client.login(process.env.DISCORD_TOKEN);
