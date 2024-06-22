const got = require("got");
const Heroku = require("heroku-client");
const { alpha, isPrivate, errorHandler } = require("../lib/");
const Config = require("../config");
const heroku = new Heroku({ token: Config.HEROKU_API_KEY });
const baseURI = "/apps/" + Config.HEROKU_APP_NAME;
const { secondsToDHMS } = require("../lib/functions");
const { delay } = require("baileys");


const restartKoyeb = async (message) => {
  const koyebToken = Config.KOYEB_API_KEY;
  const koyebAppName = Config.KOYEB_APP_NAME;
  
  if (!koyebAppName || !koyebToken) {
    return await message.reply("Add `KOYEB_APP_NAME` and `KOYEB_API_KEY` env variables");
  }
  
  const url = `https://api.koyeb.com/v1/apps/${koyebAppName}/restart`;
  const headers = {
    Authorization: `Bearer ${koyebToken}`,
    "Content-Type": "application/json",
  };

  try {
    const response = await got.post(url, { headers, json: {} });
    await message.reply(`_Restarting Koyeb app ${koyebAppName}_`);
  } catch (error) {
    await message.reply(`KOYEB : ${error.response.body.message}`);
  }
};

alpha(
  {
    pattern: "restart",
    fromMe: true,
    type: "heroku",
    desc: "Restart Dyno",
  },
  async (message) => {
    try {
      await message.reply(`_Restarting_`);
      
      if (Config.HEROKU) {
        if (Config.HEROKU_APP_NAME === "") {
          return await message.reply("Add `HEROKU_APP_NAME` env variable");
        }
        if (Config.HEROKU_API_KEY === "") {
          return await message.reply("Add `HEROKU_API_KEY` env variable");
        }
        await heroku.delete(baseURI + "/dynos");
      } else if (Config.KOYEB) {
        await restartKoyeb(message);
      } else {
        require("child_process").exec(
          "pm2 restart " + Config.PROCESSNAME,
          (error, stdout, stderr) => {
            if (error) {
              return message.sendMessage(message.jid, `Error: ${error}`);
            }
            return;
          },
        );
      }
    } catch (error) {
      errorHandler(message, error);
    }
  },
);

alpha(
  {
    pattern: "shutdown",
    fromMe: true,
    type: "heroku",
    desc: "Dyno off",
  },
  async (message) => {
    try {
      if (Config.HEROKU) {
        if (Config.HEROKU_APP_NAME === "") {
          return await message.reply("Add `HEROKU_APP_NAME` env variable");
        }
        if (Config.HEROKU_API_KEY === "") {
          return await message.reply("Add `HEROKU_API_KEY` env variable");
        }
        await message.reply(`_Shutting down._`);
        const formation = await heroku.get(baseURI + "/formation");
        await heroku.patch(baseURI + "/formation/" + formation[0].id, {
          body: { quantity: 0 },
        });
      } else {
        await message.reply(`_Shutting down._`);
        await delay(1000).then(() => process.exit(0));
      }
    } catch (error) {
      errorHandler(message, error);
    }
  },
);

alpha(
  {
    pattern: "dyno",
    fromMe: true,
    desc: "Show Quota info",
    type: "heroku",
  },
  async (message) => {
    try {
      if (!Config.HEROKU) {
        return await message.reply("You are not using Heroku as your server.");
      }

      if (Config.HEROKU_APP_NAME === "") {
        return await message.reply("Add `HEROKU_APP_NAME` env variable");
      }
      if (Config.HEROKU_API_KEY === "") {
        return await message.reply("Add `HEROKU_API_KEY` env variable");
      }

      const account = await heroku.get("/account");
      const url = `https://api.heroku.com/accounts/${account.id}/actions/get-quota`;
      const headers = {
        "User-Agent": "Chrome/80.0.3987.149 Mobile Safari/537.36",
        Authorization: "Bearer " + Config.HEROKU_API_KEY,
        Accept: "application/vnd.heroku+json; version=3.account-quotas",
      };

      const res = await got(url, { headers });
      const resp = JSON.parse(res.body);
      const total_quota = Math.floor(resp.account_quota);
      const quota_used = Math.floor(resp.quota_used);
      const remaining = total_quota - quota_used;
      const quota = `Total Quota : ${secondsToDHMS(total_quota)}
Used  Quota : ${secondsToDHMS(quota_used)}
Remaning    : ${secondsToDHMS(remaining)}`;

      await message.reply("```" + quota + "```");
    } catch (error) {
      errorHandler(message, error);
    }
  },
);
