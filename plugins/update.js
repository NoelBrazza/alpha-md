const config = require("../config");
const { PROCESSNAME } = require("../config");
const { alpha, errorHandler } = require("../lib/");
const { exec } = require("child_process");
const simplegit = require("simple-git");
const git = simplegit();
const branch = config.BRANCH;

alpha(
  {
    pattern: "update",
    fromMe: true,
    desc: "Update the bot",
    type: "user",
  },
  async (message, match) => {
    try {
      let prefix = message.prefix;
      await git.fetch();

      let commits = await git.log([branch + "..origin/" + branch]);
      if (match === "now") {
        if (commits.total === 0) {
          return await message.sendMessage(
            message.jid,
            "```No changes in the latest commit```",
          );
        }
        await message.sendMessage(message.jid, "*Updating...*");
        await exec(
          "git stash && git pull origin " + config.BRANCH,
          async (err, stdout, stderr) => {
            if (err) {
              errorHandler(message, err);
              return await message.sendMessage(
                message.jid,
                "```" + stderr + "```",
              );
            }
            await message.sendMessage(message.jid, "*Restarting...*");
            let dependencyChanged = await updatedDependencies();
            if (dependencyChanged) {
              await message.reply(
                "*Dependencies changed. Installing new dependencies...*",
              );
              await exec(
                "npm install && pm2 restart " + PROCESSNAME,
                async (err, stdout, stderr) => {
                  if (err) {
                    errorHandler(message, err);
                    return await message.sendMessage(
                      message.jid,
                      "```" + stderr + "```",
                    );
                  }
                },
              );
            } else {
              await message.reply("*Restarting...*");
              exec("pm2 restart " + PROCESSNAME, async (err, stdout, stderr) => {
                if (err) {
                  errorHandler(message, err);
                  return await message.sendMessage(
                    message.jid,
                    "```" + stderr + "```",
                  );
                }
              });
            }
          },
        );
      } else {
        if (commits.total === 0) {
          return await message.sendMessage(
            message.jid,
            "```No changes in the latest commit```",
          );
        } else {
          let changes = "_New update available!_\n\n";
          changes += "*Commits:* ```" + commits.total + "```\n";
          changes += "*Branch:* ```" + branch + "```\n";
          changes += "*Changes:* \n";
          commits.all.forEach((commit, index) => {
            changes += "```" + (index + 1) + ". " + commit.message + "```\n";
          });
          changes += "\n*To update, send* ```" + prefix + "update now```";
          await message.sendMessage(message.jid, changes);
        }
      }
    } catch (error) {
      errorHandler(message, error);
    }
  },
);

async function updatedDependencies() {
  try {
    const diff = await git.diff([`${branch}..origin/${branch}`]);
    const hasDependencyChanges = diff.includes('"dependencies":');
    return hasDependencyChanges;
  } catch (error) {
    console.error("Error occurred while checking package.json:", error);
    return false;
  }
}
