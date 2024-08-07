const { alpha, isAdmin, serialize, errorHandler } = require("../lib");
const { WA_DEFAULT_EPHEMERAL } = require("baileys");
const { exec } = require("child_process");
const { PausedChats, WarnDB } = require("../lib/database");
const { loadMessage } = require("../lib/database/Store");
const { WARN_COUNT } = require("../config");
const { saveWarn, resetWarn } = WarnDB;

alpha(
  {
    pattern: "pause",
    fromMe: true,
    desc: "Pause the chat",
    dontAddCommandList: true,
  },
  async (message) => {
    const chatId = message.key.remoteJid;
    try {
      await PausedChats.savePausedChat(chatId);
      message.reply("Chat paused successfully.");
    } catch (error) {
      errorHandler(message, error);
    }
  }
);

alpha(
  {
    pattern: "shutdown",
    fromMe: true,
    desc: "Stop the bot",
    type: "user",
  },
  async (message, match) => {
    try {
      await message.sendMessage(message.jid, "Shutting down...");
      exec("pm2 stop alpha", (error, stdout, stderr) => {
        if (error) {
          return message.sendMessage(message.jid, `Error: ${error}`);
        }
      });
    } catch (error) {
      errorHandler(message, error);
    }
  }
);

alpha(
  {
    pattern: "resume",
    fromMe: true,
    desc: "Resume the paused chat",
    dontAddCommandList: true,
  },
  async (message) => {
    const chatId = message.key.remoteJid;

    try {
      const pausedChat = await PausedChats.findOne({
        where: { chatId },
      });

      if (pausedChat) {
        await pausedChat.destroy();
        message.reply("Chat resumed successfully.");
      } else {
        message.reply("Chat is not paused.");
      }
    } catch (error) {
      errorHandler(message, error);
    }
  }
);

alpha(
  {
    pattern: "setpp",
    fromMe: true,
    desc: "Set profile picture",
    type: "user",
  },
  async (message, match, m) => {
    try {
      if (!message.reply_message.image)
        return await message.reply("Reply to a photo");
      let buff = await m.quoted.download();
      await message.setPP(message.user, buff);
      return await message.reply("Profile Picture Updated");
    } catch (error) {
      errorHandler(message, error);
    }
  }
);

alpha(
  {
    pattern: "setname",
    fromMe: true,
    desc: "Set user name",
    type: "user",
  },
  async (message, match) => {
    try {
      if (!match) return await message.reply("Enter name");
      await message.updateName(match);
      return await message.reply(`Username Updated: ${match}`);
    } catch (error) {
      errorHandler(message, error);
    }
  }
);

alpha(
  {
    pattern: "block",
    fromMe: true,
    desc: "Block a person",
    type: "user",
  },
  async (message, match) => {
    try {
      if (message.isGroup) {
        let jid = message.mention[0] || message.reply_message.jid;
        if (!jid) return await message.reply("Reply to a person or mention");
        await message.block(jid);
        return await message.sendMessage(
          `@${jid.split("@")[0]} Blocked`,
          { mentions: [jid] }
        );
      } else {
        await message.block(message.jid);
        return await message.reply("User blocked");
      }
    } catch (error) {
      errorHandler(message, error);
    }
  }
);

alpha(
  {
    pattern: "unblock",
    fromMe: true,
    desc: "Unblock a person",
    type: "user",
  },
  async (message, match) => {
    try {
      if (message.isGroup) {
        let jid = message.mention[0] || message.reply_message.jid;
        if (!jid) return await message.reply("Reply to a person or mention");
        await message.unblock(jid);
        return await message.sendMessage(
          `@${jid.split("@")[0]} unblocked`,
          { mentions: [jid] }
        );
      } else {
        await message.unblock(message.jid);
        return await message.reply("User unblocked");
      }
    } catch (error) {
      errorHandler(message, error);
    }
  }
);

alpha(
  {
    pattern: "jid",
    fromMe: true,
    desc: "Get JID of chat/user",
    type: "user",
  },
  async (message, match) => {
    try {
      return await message.sendMessage(
        message.jid,
        message.mention[0] || message.reply_message.jid || message.jid
      );
    } catch (error) {
      errorHandler(message, error);
    }
  }
);

alpha(
  {
    pattern: "dlt",
    fromMe: true,
    desc: "Delete a message",
    type: "user",
  },
  async (message, match, m, client) => {
    try {
      if (message.isGroup) {
        client.sendMessage(message.jid, { delete: message.reply_message.key });
        //await message.sendMessage(message.jid, { key: message.reply_message.key }, {}, "delete");
      }
    } catch (error) {
      errorHandler(message, error);
    }
  }
);

alpha(
  {
    pattern: "warn",
    fromMe: true,
    desc: "Warn a user",
    type: "group"
  },
  async (message, match) => {
    try {
      if (!message.isGroup) return;
      const userId = message.mention[0] || message.reply_message.jid;
      if (!userId) return message.reply("Mention or reply to someone");
      let reason = message.reply_message?.text || match;
      reason = reason.replace(/@(\d+)/, "");
      reason = reason.length <= 1 ? "Reason not Provided" : reason;
      const warnInfo = await getWarns(userId);
      let userWarnCount = warnInfo ? warnInfo.warnCount : 0;
      userWarnCount += 1;

      if (userWarnCount >= WARN_COUNT) {
        await message.client.sendMessage(message.jid, {
          text: `_Warn limit exceeded. Kicking user @${userId.split("@")[0]}_`,
          mentions: [userId]
        });
        await sleep(500);
        await resetWarn(userId);
        await message.client.groupParticipantsUpdate(message.jid, userId, "remove");
      } else {
        await saveWarn(userId, reason);
        await message.reply(
          `User @${userId.split("@")[0]} warned.\nWarn Count: ${userWarnCount}.\nReason: ${reason}`,
          { mentions: [userId] }
        );
      }
    } catch (error) {
      errorHandler(message, error);
    }
  }
);


alpha(
  {
    pattern: "rstwarn",
    fromMe: true,
    desc: "Reset warnings for a user",
    type: "group"
  },
  async (message) => {
    try {
      if (!message.isGroup) return;
      const userId = message.mention[0] || message.reply_message.jid;
      if (!userId) return message.reply("Mention or reply to someone");
      await resetWarn(userId);
      return await message.reply(`Warnings for @${userId.split("@")[0]} reset`,{ mentions: [userId] });
    } catch (error) {
      errorHandler(message, error);
    }
  }
);

alpha({
  pattern: "pinchat",
  fromMe: true,
  desc: "Pin a chat",
  type: "whatsapp",
}, async (message, match) => {
  try {
    await message.client.chatModify({
      pin: true
    }, message.jid);
    await message.reply("Pinned");
  } catch (error) {
    errorHandler(message, error);
  }
});

alpha({
  pattern: "unpin",
  fromMe: true,
  desc: "Unpin a chat",
  type: "whatsapp",
}, async (message, match) => {
  try {
    await message.client.chatModify({
      pin: false
    }, message.jid);
    await message.reply("Unpinned");
  } catch (error) {
    errorHandler(message, error);
  }
});

alpha({
  pattern: "setbio",
  fromMe: true,
  desc: "Change your profile status",
  type: "whatsapp",
}, async (message, match) => {
  try {
    match = match || message.reply_message.text;
    if (!match) return await message.reply("Need status!\nExample: setbio Hey there! I am using WhatsApp.");
    await message.client.updateProfileStatus(match);
    await message.reply("Profile status updated");
  } catch (error) {
    errorHandler(message, error);
  }
});

alpha({
  pattern: "setname",
  fromMe: true,
  desc: "Change your profile name",
  type: "whatsapp",
}, async (message, match) => {
  try {
    match = match || message.reply_message.text;
    if (!match) return await message.reply("Need name!\nExample: setname Your Name.");
    await message.client.updateProfileName(match);
    await message.reply("Profile name updated");
  } catch (error) {
    errorHandler(message, error);
  }
});

alpha({
  pattern: "disappear",
  fromMe: true,
  desc: "Turn on/off disappearing messages",
  type: "whatsapp",
}, async (message, match) => {
  try {
    if (match === 'off') {
      await message.client.sendMessage(
        message.jid,
        { disappearingMessagesInChat: false }
      );
      await message.reply("Disappearing messages deactivated");
    } else {
      await message.client.sendMessage(
        message.jid,
        { disappearingMessagesInChat: WA_DEFAULT_EPHEMERAL }
      );
      await message.reply("Disappearing messages activated");
    }
  } catch (error) {
    errorHandler(message, error);
  }
});

alpha({
  pattern: "lastseen",
  fromMe: true,
  desc: "Change last seen privacy",
  type: "whatsapp",
}, async (message, match, cmd) => {
  try {
    if (!match) return await message.reply(`Example: ${cmd} all\nChange last seen privacy settings`);
    const available_privacy = ['all', 'contacts', 'contact_blacklist', 'none'];
    if (!available_privacy.includes(match)) return await message.reply(`Privacy setting must be one of: ${available_privacy.join(', ')}`);
    await message.client.updateLastSeenPrivacy(match);
    await message.reply(`Last seen privacy updated to: ${match}`);
  } catch (error) {
    errorHandler(message, error);
  }
});

alpha({
  pattern: "online",
  fromMe: true,
  desc: "Change online status privacy",
  type: "whatsapp",
}, async (message, match, cmd) => {
  try {
    if (!match) return await message.reply(`Example: ${cmd} all\nChange online status privacy settings`);
    const available_privacy = ['all', 'match_last_seen'];
    if (!available_privacy.includes(match)) return await message.reply(`Privacy setting must be one of: ${available_privacy.join(', ')}`);
    await message.client.updateOnlinePrivacy(match);
    await message.reply(`Online status privacy updated to: ${match}`);
  } catch (error) {
    errorHandler(message, error);
  }
});

alpha({
  pattern: "mypp",
  fromMe: true,
  desc: "Change profile picture privacy",
  type: "whatsapp",
}, async (message, match, cmd) => {
  try {
    if (!match) return await message.reply(`Example: ${cmd} all\nChange profile picture privacy settings`);
    const available_privacy = ['all', 'contacts', 'contact_blacklist', 'none'];
    if (!available_privacy.includes(match)) return await message.reply(`Privacy setting must be one of: ${available_privacy.join(', ')}`);
    await message.client.updateProfilePicturePrivacy(match);
    await message.reply(`Profile picture privacy updated to: ${match}`);
  } catch (error) {
    errorHandler(message, error);
  }
});

alpha({
  pattern: "mystatus",
  fromMe: true,
  desc: "Change my status privacy",
  type: "whatsapp",
}, async (message, match, cmd) => {
  try {
    if (!match) return await message.reply(`Example: ${cmd} all\nChange my status privacy settings`);
    const available_privacy = ['all', 'contacts', 'contact_blacklist', 'none'];
    if (!available_privacy.includes(match)) return await message.reply(`Privacy setting must be one of: ${available_privacy.join(', ')}`);
    await message.client.updateStatusPrivacy(match);
    await message.reply(`My status privacy updated to: ${match}`);
  } catch (error) {
    errorHandler(message, error);
  }
});

alpha({
  pattern: "read",
  fromMe: true,
  desc: "Change read receipts privacy",
  type: "whatsapp",
}, async (message, match, cmd) => {
  try {
    if (!match) return await message.reply(`Example: ${cmd} all\nChange read receipts privacy settings`);
    const available_privacy = ['all', 'none'];
    if (!available_privacy.includes(match)) return await message.reply(`Privacy setting must be one of: ${available_privacy.join(', ')}`);
    await message.client.updateReadReceiptsPrivacy(match);
    await message.reply(`Read receipts privacy updated to: ${match}`);
  } catch (error) {
    errorHandler(message, error);
  }
});

alpha({
  pattern: "groupadd",
  fromMe: true,
  desc: "Change group add privacy",
  type: "whatsapp",
}, async (message, match, cmd) => {
  try {
    if (!match) return await message.reply(`Example: ${cmd} all\nChange group add privacy settings`);
    const available_privacy = ['all', 'contacts', 'contact_blacklist', 'none'];
    if (!available_privacy.includes(match)) return await message.reply(`Privacy setting must be one of: ${available_privacy.join(', ')}`);
    await message.client.updateGroupsAddPrivacy(match);
    await message.reply(`Group add privacy updated to: ${match}`);
  } catch (error) {
    errorHandler(message, error);
  }
});


alpha({
  pattern: 'save',
  fromMe: true,
  desc: 'sends quoted messages to pm',
  type: 'whatsapp'
}, async (message, match, cmd) => {
  try {
    let key = message.reply_message.key;
    let msg = await loadMessage(key.id);
    msg = await serialize(JSON.parse(JSON.stringify(msg.message)),message.client);
    return await message.forward(message.user, msg, {
      quoted: message.data,
      linkPreview: {
                   title: "msg saver"
      }
})
  } catch (error) {
    errorHandler(message, error);
  }
});


alpha({
  pattern: 'caption',
	fromMe: true,
	desc: 'copy or add caption to video or image',
	type: 'whatsapp',
}, async (message, match, m) => {
  try {
    if ((message.reply_message.image || message.reply_message.video) && match)
			return await message.forward(message.jid,
				await m.quoted.download(),
				{ quoted: message.data, caption: match },
			)
		if (message.reply_message.text)
			return await message.forward(message.jid, message.reply_message.text,
				{ quoted: message.data})
  } catch (error) {
    errorHandler(message, error);
  }
});

