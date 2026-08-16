// ══════════════════════════════════════════════════════════
// ECONOMY GAMES MODULE — v2.0 Complete Rewrite
// ══════════════════════════════════════════════════════════

const { EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle } = require('discord.js');
const { getEconomy, getUserEconomy, isEconomyEnabled, addCredits, removeCredits, formatNumber, parseAmount, makeEmbed } = require('./economy');
const { hasDiscordPerm } = require('./helpers');
const { error: err, success: ok } = require('../utils/embeds');

// ══════════════════════════════════════════════════════════
// GAMES: CRASH
// ══════════════════════════════════════════════════════════

const crashGames = new Map();

async function handleCrash(message, args) {
  if (!isEconomyEnabled(message.guild.id)) return message.reply(err('Economy is not enabled.'));
  const guildId = message.guild.id;
  const userId = message.author.id;
  const user = getUserEconomy(guildId, userId);
  const ec = getEconomy(guildId);

  const amount = parseAmount(args[0], user, 'wallet');
  if (amount === null) return message.reply(err('Usage: `,crash <amount | all | half | quarter>`'));
  if (amount <= 0) return message.reply(err('Amount must be greater than 0.'));
  if (user.wallet < amount) return message.reply(err(`You only have **${formatNumber(user.wallet)}**.`));

  removeCredits(guildId, userId, amount, 'crash_bet');
  saveEconomy(guildId, ec);

  const crashMult = 1 + Math.random() * 4; // crashes between 1.0x and 5.0x
  let current = 1.0;
  const step = 0.1;

  const embed = makeEmbed('Crash Game', `Multiplier: **${current.toFixed(1)}x**\nBet: **${formatNumber(amount)}** ${ec.currencyName}\n\nReact with 💰 to cash out!`, '#5865F2', 'Cash out before it crashes!');
  const msg = await message.reply({ embeds: [embed] });
  await msg.react('💰');

  const filter = (reaction, user) => reaction.emoji.name === '💰' && user.id === userId;
  const collector = msg.createReactionCollector({ filter, time: 15000 });

  let cashed = false;
  let finalMult = 1.0;

  collector.on('collect', () => {
    cashed = true;
    collector.stop();
  });

  const interval = setInterval(async () => {
    current += step;
    if (current >= crashMult || cashed) {
      clearInterval(interval);
      collector.stop();
      finalMult = cashed ? current : 0;

      if (cashed) {
        const win = Math.floor(amount * finalMult);
        addCredits(guildId, userId, win, 'crash_win');
        saveEconomy(guildId, ec);
        const winEmbed = makeEmbed('Crash — Cashed Out!', `Cashed at **${finalMult.toFixed(1)}x**\nWon **${formatNumber(win)}** ${ec.currencyName}\n\n**Profit:** +${formatNumber(win - amount)}`, '#57F287', `Balance: ${formatNumber(user.wallet)}`);
        await msg.edit({ embeds: [winEmbed] });
        await msg.reactions.removeAll();
      } else {
        const loseEmbed = makeEmbed('Crash — Busted!', `Crashed at **${crashMult.toFixed(1)}x**\nYou lost **${formatNumber(amount)}** ${ec.currencyName}.`, '#ED4245', `Balance: ${formatNumber(user.wallet)}`);
        await msg.edit({ embeds: [loseEmbed] });
        await msg.reactions.removeAll();
      }
    } else {
      const updateEmbed = makeEmbed('Crash Game', `Multiplier: **${current.toFixed(1)}x**\nBet: **${formatNumber(amount)}** ${ec.currencyName}\n\nReact with 💰 to cash out!`, '#5865F2', 'Cash out before it crashes!');
      await msg.edit({ embeds: [updateEmbed] }).catch(() => {});
    }
  }, 1000);
}

// ══════════════════════════════════════════════════════════
// GAMES: GAMBLE (50/50 + Random Multiplier)
// ══════════════════════════════════════════════════════════

async function handleGamble(message, args) {
  if (!isEconomyEnabled(message.guild.id)) return message.reply(err('Economy is not enabled.'));
  const guildId = message.guild.id;
  const userId = message.author.id;
  const user = getUserEconomy(guildId, userId);
  const ec = getEconomy(guildId);

  const amount = parseAmount(args[0], user, 'wallet');
  const side = args[1]?.toLowerCase();

  if (amount === null) return message.reply(err('Usage: `,gamble <amount | all | half | quarter> [heads | tails]`'));
  if (amount <= 0) return message.reply(err('Amount must be greater than 0.'));
  if (user.wallet < amount) return message.reply(err(`You only have **${formatNumber(user.wallet)}**.`));

  removeCredits(guildId, userId, amount, 'gamble_bet');
  user.gamesPlayed++;

  if (side && ['heads', 'tails', 'h', 't'].includes(side)) {
    // 50/50 mode
    const win = Math.random() < 0.5;
    if (win) {
      const payout = amount * 2;
      addCredits(guildId, userId, payout, 'gamble_win');
      user.gamesWon++;
      saveEconomy(guildId, ec);
      const embed = makeEmbed('Gamble — Winner!', `You chose **${side}** and won!\n**+${formatNumber(payout)}** ${ec.currencyName}\n\n**Profit:** +${formatNumber(amount)}`, '#57F287', `Balance: ${formatNumber(user.wallet)}`);
      return message.reply({ embeds: [embed] });
    } else {
      saveEconomy(guildId, ec);
      const embed = makeEmbed('Gamble — Lost', `You chose **${side}** and lost.\n**-${formatNumber(amount)}** ${ec.currencyName}`, '#ED4245', `Balance: ${formatNumber(user.wallet)}`);
      return message.reply({ embeds: [embed] });
    }
  } else {
    // Random multiplier mode
    const multipliers = [0, 0.5, 1, 1.5, 2, 3, 5];
    const weights = [20, 15, 25, 15, 10, 3, 2];
    const totalWeight = weights.reduce((a, b) => a + b, 0);
    let rand = Math.random() * totalWeight;
    let mult = multipliers[0];
    for (let i = 0; i < multipliers.length; i++) {
      rand -= weights[i];
      if (rand <= 0) { mult = multipliers[i]; break; }
    }

    const payout = Math.floor(amount * mult);
    if (payout > 0) {
      addCredits(guildId, userId, payout, 'gamble_win');
      if (mult >= 1) user.gamesWon++;
    }
    saveEconomy(guildId, ec);

    const profit = payout - amount;
    const color = profit > 0 ? '#57F287' : profit < 0 ? '#ED4245' : '#2F3136';
    const title = profit > 0 ? 'Gamble — Big Win!' : profit < 0 ? 'Gamble — Unlucky' : 'Gamble — Break Even';
    const embed = makeEmbed(title, `Multiplier: **${mult}x**\nPayout: **${formatNumber(payout)}** ${ec.currencyName}\n**Profit:** ${profit >= 0 ? '+' : ''}${formatNumber(profit)}`, color, `Balance: ${formatNumber(user.wallet)}`);
    return message.reply({ embeds: [embed] });
  }
}

// ══════════════════════════════════════════════════════════
// GAMES: BOMBS (MINESWEEPER)
// ══════════════════════════════════════════════════════════

async function handleBombs(message, args) {
  if (!isEconomyEnabled(message.guild.id)) return message.reply(err('Economy is not enabled.'));
  const guildId = message.guild.id;
  const userId = message.author.id;
  const user = getUserEconomy(guildId, userId);
  const ec = getEconomy(guildId);

  const amount = parseAmount(args[0], user, 'wallet');
  if (amount === null) return message.reply(err('Usage: `,bombs <amount | all | half | quarter>`'));
  if (amount <= 0) return message.reply(err('Amount must be greater than 0.'));
  if (user.wallet < amount) return message.reply(err(`You only have **${formatNumber(user.wallet)}**.`));

  removeCredits(guildId, userId, amount, 'bombs_bet');
  user.gamesPlayed++;

  const gridSize = 25; // 5x5
  const bombCount = 5;
  const bombs = new Set();
  while (bombs.size < bombCount) bombs.add(Math.floor(Math.random() * gridSize));

  const revealed = new Set();
  let multiplier = 1.0;
  let alive = true;

  const renderGrid = () => {
    let str = '';
    for (let i = 0; i < gridSize; i++) {
      if (i % 5 === 0 && i > 0) str += '\n';
      if (revealed.has(i)) {
        str += bombs.has(i) ? '💥 ' : '✅ ';
      } else {
        str += `\`${String(i + 1).padStart(2, '0')}\` `;
      }
    }
    return str;
  };

  const embed = makeEmbed('Bombs — Minesweeper', `${renderGrid()}\n\nMultiplier: **${multiplier.toFixed(2)}x**\nPotential: **${formatNumber(Math.floor(amount * multiplier))}** ${ec.currencyName}\n\nType a number (1-25) to reveal. Type ",cashout" to stop.`, '#5865F2', 'Avoid the bombs!');
  const msg = await message.reply({ embeds: [embed] });

  const filter = m => m.author.id === userId && (m.content.toLowerCase() === ',cashout' || (!isNaN(parseInt(m.content)) && parseInt(m.content) >= 1 && parseInt(m.content) <= 25));
  const collector = message.channel.createMessageCollector({ filter, time: 60000 });

  collector.on('collect', async m => {
    if (m.content.toLowerCase() === ',cashout') {
      collector.stop();
      const win = Math.floor(amount * multiplier);
      if (win > 0) addCredits(guildId, userId, win, 'bombs_cashout');
      user.gamesWon++;
      saveEconomy(guildId, ec);
      const cashEmbed = makeEmbed('Bombs — Cashed Out!', `Cashed at **${multiplier.toFixed(2)}x**\nWon **${formatNumber(win)}** ${ec.currencyName}\n**Profit:** +${formatNumber(win - amount)}`, '#57F287', `Balance: ${formatNumber(user.wallet)}`);
      await msg.edit({ embeds: [cashEmbed] });
      return;
    }

    const num = parseInt(m.content) - 1;
    if (revealed.has(num)) return;
    revealed.add(num);

    if (bombs.has(num)) {
      alive = false;
      collector.stop();
      saveEconomy(guildId, ec);
      const loseEmbed = makeEmbed('Bombs — BOOM!', `${renderGrid()}\n\nYou hit a bomb! Lost **${formatNumber(amount)}** ${ec.currencyName}.`, '#ED4245', `Balance: ${formatNumber(user.wallet)}`);
      await msg.edit({ embeds: [loseEmbed] });
      return;
    }

    multiplier += 0.25;
    const potential = Math.floor(amount * multiplier);
    const updateEmbed = makeEmbed('Bombs — Safe!', `${renderGrid()}\n\nMultiplier: **${multiplier.toFixed(2)}x**\nPotential: **${formatNumber(potential)}** ${ec.currencyName}\n\nType a number (1-25) or ",cashout"`, '#57F287', `${revealed.size}/${gridSize - bombCount} safe spots found`);
    await msg.edit({ embeds: [updateEmbed] });
  });

  collector.on('end', () => {
    if (alive && revealed.size > 0) {
      const win = Math.floor(amount * multiplier);
      if (win > 0) addCredits(guildId, userId, win, 'bombs_timeout');
      saveEconomy(guildId, ec);
    }
  });
}

// ══════════════════════════════════════════════════════════
// GAMES: SCRATCH CARD
// ══════════════════════════════════════════════════════════

async function handleScratch(message, args) {
  if (!isEconomyEnabled(message.guild.id)) return message.reply(err('Economy is not enabled.'));
  const guildId = message.guild.id;
  const userId = message.author.id;
  const user = getUserEconomy(guildId, userId);
  const ec = getEconomy(guildId);

  const amount = parseAmount(args[0], user, 'wallet');
  if (amount === null) return message.reply(err('Usage: `,scratch <amount | all | half | quarter>`'));
  if (amount <= 0) return message.reply(err('Amount must be greater than 0.'));
  if (user.wallet < amount) return message.reply(err(`You only have **${formatNumber(user.wallet)}**.`));

  removeCredits(guildId, userId, amount, 'scratch_bet');
  user.gamesPlayed++;

  const symbols = ['💎', '🔔', '7️⃣', '🍒', '🍋'];
  const card = Array.from({ length: 9 }, () => symbols[Math.floor(Math.random() * symbols.length)]);

  let winAmount = 0;
  // Check rows
  for (let i = 0; i < 9; i += 3) {
    if (card[i] === card[i+1] && card[i] === card[i+2]) {
      winAmount += Math.floor(amount * (card[i] === '💎' ? 10 : card[i] === '7️⃣' ? 5 : 2));
    }
  }
  // Check columns
  for (let i = 0; i < 3; i++) {
    if (card[i] === card[i+3] && card[i] === card[i+6]) {
      winAmount += Math.floor(amount * (card[i] === '💎' ? 10 : card[i] === '7️⃣' ? 5 : 2));
    }
  }

  const grid = `| ${card[0]} ${card[1]} ${card[2]} |\n| ${card[3]} ${card[4]} ${card[5]} |\n| ${card[6]} ${card[7]} ${card[8]} |`;

  if (winAmount > 0) {
    addCredits(guildId, userId, winAmount, 'scratch_win');
    user.gamesWon++;
    saveEconomy(guildId, ec);
    const embed = makeEmbed('Scratch Card — Winner!', `${grid}\n\nYou won **${formatNumber(winAmount)}** ${ec.currencyName}!`, '#57F287', `Balance: ${formatNumber(user.wallet)}`);
    return message.reply({ embeds: [embed] });
  } else {
    saveEconomy(guildId, ec);
    const embed = makeEmbed('Scratch Card — No Match', `${grid}\n\nNo winning lines. Lost **${formatNumber(amount)}** ${ec.currencyName}.`, '#ED4245', `Balance: ${formatNumber(user.wallet)}`);
    return message.reply({ embeds: [embed] });
  }
}

// ══════════════════════════════════════════════════════════
// GAMES: ROULETTE
// ══════════════════════════════════════════════════════════

async function handleRoulette(message, args) {
  if (!isEconomyEnabled(message.guild.id)) return message.reply(err('Economy is not enabled.'));
  const guildId = message.guild.id;
  const userId = message.author.id;
  const user = getUserEconomy(guildId, userId);
  const ec = getEconomy(guildId);

  const betType = args[0]?.toLowerCase();
  const amount = parseAmount(args[1], user, 'wallet');

  const validBets = ['red', 'black', 'green', 'odd', 'even'];
  if (!betType || !validBets.includes(betType)) {
    return message.reply(err('Usage: `,roulette <red | black | green | odd | even> <amount>`'));
  }
  if (amount === null) return message.reply(err('Invalid amount. Use a number, all, half, or quarter.'));
  if (amount <= 0) return message.reply(err('Amount must be greater than 0.'));
  if (user.wallet < amount) return message.reply(err(`You only have **${formatNumber(user.wallet)}**.`));

  removeCredits(guildId, userId, amount, 'roulette_bet');
  user.gamesPlayed++;

  const number = Math.floor(Math.random() * 37); // 0-36
  const isRed = [1,3,5,7,9,12,14,16,18,19,21,23,25,27,30,32,34,36].includes(number);
  const isBlack = number !== 0 && !isRed;
  const isGreen = number === 0;
  const isOdd = number !== 0 && number % 2 === 1;
  const isEven = number !== 0 && number % 2 === 0;

  let win = false;
  let multiplier = 0;

  if (betType === 'red' && isRed) { win = true; multiplier = 2; }
  if (betType === 'black' && isBlack) { win = true; multiplier = 2; }
  if (betType === 'green' && isGreen) { win = true; multiplier = 14; }
  if (betType === 'odd' && isOdd) { win = true; multiplier = 2; }
  if (betType === 'even' && isEven) { win = true; multiplier = 2; }

  if (win) {
    const payout = Math.floor(amount * multiplier);
    addCredits(guildId, userId, payout, 'roulette_win');
    user.gamesWon++;
    saveEconomy(guildId, ec);
    const embed = makeEmbed('Roulette — Winner!', `The ball landed on **${number}** (${isRed ? 'Red' : isBlack ? 'Black' : 'Green'})\nYou bet on **${betType}** and won!\n**+${formatNumber(payout)}** ${ec.currencyName}`, '#57F287', `Balance: ${formatNumber(user.wallet)}`);
    return message.reply({ embeds: [embed] });
  } else {
    saveEconomy(guildId, ec);
    const embed = makeEmbed('Roulette — Lost', `The ball landed on **${number}** (${isRed ? 'Red' : isBlack ? 'Black' : 'Green'})\nYou bet on **${betType}** and lost.`, '#ED4245', `Balance: ${formatNumber(user.wallet)}`);
    return message.reply({ embeds: [embed] });
  }
}

// ══════════════════════════════════════════════════════════
// GAMES: ROB
// ══════════════════════════════════════════════════════════

async function handleRob(message, args) {
  if (!isEconomyEnabled(message.guild.id)) return message.reply(err('Economy is not enabled.'));
  const guildId = message.guild.id;
  const userId = message.author.id;
  const user = getUserEconomy(guildId, userId);
  const ec = getEconomy(guildId);

  const target = message.mentions.users.first();
  if (!target) return message.reply(err('Mention a user: `,rob @user`'));
  if (target.id === userId) return message.reply(err('You cannot rob yourself.'));

  const targetUser = getUserEconomy(guildId, target.id);
  if (targetUser.wallet < 100) return message.reply(err(`${target.username} doesn't have enough to rob.`));

  user.robAttempts++;
  const success = Math.random() < 0.4; // 40% success

  if (success) {
    const steal = Math.floor(Math.min(targetUser.wallet * 0.3, 5000));
    targetUser.wallet -= steal;
    user.wallet += steal;
    user.robSuccess++;
    saveEconomy(guildId, ec);
    const embed = makeEmbed('Robbery — Success!', `You robbed **${target.username}** and got away with **${formatNumber(steal)}** ${ec.currencyName}!`, '#57F287', `Balance: ${formatNumber(user.wallet)}`);
    return message.reply({ embeds: [embed] });
  } else {
    const fine = Math.floor(Math.random() * 200) + 50;
    user.wallet = Math.max(0, user.wallet - fine);
    saveEconomy(guildId, ec);
    const embed = makeEmbed('Robbery — Caught!', `You got caught and paid a **${formatNumber(fine)}** ${ec.currencyName} fine.`, '#ED4245', `Balance: ${formatNumber(user.wallet)}`);
    return message.reply({ embeds: [embed] });
  }
}

// ══════════════════════════════════════════════════════════
// GAMES: PLINKO
// ══════════════════════════════════════════════════════════

async function handlePlinko(message, args) {
  if (!isEconomyEnabled(message.guild.id)) return message.reply(err('Economy is not enabled.'));
  const guildId = message.guild.id;
  const userId = message.author.id;
  const user = getUserEconomy(guildId, userId);
  const ec = getEconomy(guildId);

  const amount = parseAmount(args[0], user, 'wallet');
  if (amount === null) return message.reply(err('Usage: `,plinko <amount | all | half | quarter>`'));
  if (amount <= 0) return message.reply(err('Amount must be greater than 0.'));
  if (user.wallet < amount) return message.reply(err(`You only have **${formatNumber(user.wallet)}**.`));

  removeCredits(guildId, userId, amount, 'plinko_bet');
  user.gamesPlayed++;

  const slots = [0.2, 0.5, 1, 1.5, 2, 3, 5, 0.2, 0.5];
  const weights = [5, 10, 20, 15, 10, 5, 2, 5, 10];
  const totalWeight = weights.reduce((a, b) => a + b, 0);
  let rand = Math.random() * totalWeight;
  let mult = slots[0];
  for (let i = 0; i < slots.length; i++) {
    rand -= weights[i];
    if (rand <= 0) { mult = slots[i]; break; }
  }

  const payout = Math.floor(amount * mult);
  if (payout > 0) {
    addCredits(guildId, userId, payout, 'plinko_win');
    if (mult >= 1) user.gamesWon++;
  }
  saveEconomy(guildId, ec);

  const profit = payout - amount;
  const color = profit > 0 ? '#57F287' : profit < 0 ? '#ED4245' : '#2F3136';
  const title = profit > 0 ? 'Plinko — Win!' : profit < 0 ? 'Plinko — Loss' : 'Plinko — Break Even';
  const embed = makeEmbed(title, `Multiplier: **${mult}x**\nPayout: **${formatNumber(payout)}** ${ec.currencyName}\n**Profit:** ${profit >= 0 ? '+' : ''}${formatNumber(profit)}`, color, `Balance: ${formatNumber(user.wallet)}`);
  return message.reply({ embeds: [embed] });
}

// ══════════════════════════════════════════════════════════
// GAMES: HIGHLOW
// ══════════════════════════════════════════════════════════

async function handleHighlow(message, args) {
  if (!isEconomyEnabled(message.guild.id)) return message.reply(err('Economy is not enabled.'));
  const guildId = message.guild.id;
  const userId = message.author.id;
  const user = getUserEconomy(guildId, userId);
  const ec = getEconomy(guildId);

  const amount = parseAmount(args[0], user, 'wallet');
  if (amount === null) return message.reply(err('Usage: `,highlow <amount | all | half | quarter>`'));
  if (amount <= 0) return message.reply(err('Amount must be greater than 0.'));
  if (user.wallet < amount) return message.reply(err(`You only have **${formatNumber(user.wallet)}**.`));

  removeCredits(guildId, userId, amount, 'highlow_bet');
  user.gamesPlayed++;

  const current = Math.floor(Math.random() * 13) + 1; // 1-13
  const next = Math.floor(Math.random() * 13) + 1;

  const embed = makeEmbed('High or Low?', `Current card: **${current}**\nBet: **${formatNumber(amount)}** ${ec.currencyName}\n\nWill the next card be **Higher** or **Lower**?`, '#5865F2', 'Type "higher" or "lower"');
  const msg = await message.reply({ embeds: [embed] });

  const filter = m => m.author.id === userId && ['higher', 'lower', 'h', 'l'].includes(m.content.toLowerCase());
  const collected = await message.channel.awaitMessages({ filter, max: 1, time: 30000 });

  if (!collected.size) {
    saveEconomy(guildId, ec);
    const timeoutEmbed = makeEmbed('HighLow — Timeout', `The next card was **${next}**. You lost **${formatNumber(amount)}** ${ec.currencyName}.`, '#ED4245', `Balance: ${formatNumber(user.wallet)}`);
    return msg.edit({ embeds: [timeoutEmbed] });
  }

  const guess = collected.first().content.toLowerCase();
  const isHigher = next > current;
  const win = (guess === 'higher' || guess === 'h') ? isHigher : !isHigher;

  if (win) {
    const payout = amount * 2;
    addCredits(guildId, userId, payout, 'highlow_win');
    user.gamesWon++;
    saveEconomy(guildId, ec);
    const winEmbed = makeEmbed('HighLow — Correct!', `Card was **${next}** (vs **${current}**)\nYou won **${formatNumber(payout)}** ${ec.currencyName}!`, '#57F287', `Balance: ${formatNumber(user.wallet)}`);
    return msg.edit({ embeds: [winEmbed] });
  } else {
    saveEconomy(guildId, ec);
    const loseEmbed = makeEmbed('HighLow — Wrong', `Card was **${next}** (vs **${current}**)\nYou lost **${formatNumber(amount)}** ${ec.currencyName}.`, '#ED4245', `Balance: ${formatNumber(user.wallet)}`);
    return msg.edit({ embeds: [loseEmbed] });
  }
}

// ══════════════════════════════════════════════════════════
// GAMES: LADDER
// ══════════════════════════════════════════════════════════

async function handleLadder(message, args) {
  if (!isEconomyEnabled(message.guild.id)) return message.reply(err('Economy is not enabled.'));
  const guildId = message.guild.id;
  const userId = message.author.id;
  const user = getUserEconomy(guildId, userId);
  const ec = getEconomy(guildId);

  const amount = parseAmount(args[0], user, 'wallet');
  if (amount === null) return message.reply(err('Usage: `,ladder <amount | all | half | quarter>`'));
  if (amount <= 0) return message.reply(err('Amount must be greater than 0.'));
  if (user.wallet < amount) return message.reply(err(`You only have **${formatNumber(user.wallet)}**.`));

  removeCredits(guildId, userId, amount, 'ladder_bet');
  user.gamesPlayed++;

  const rungs = [1.2, 1.5, 2, 2.5, 3, 5, 10];
  let currentRung = 0;
  let alive = true;

  const renderLadder = () => {
    return rungs.map((r, i) => {
      const marker = i === currentRung ? '👉' : i < currentRung ? '✅' : '⬜';
      return `${marker} **${r}x**`;
    }).join('\n');
  };

  const embed = makeEmbed('Ladder Climb', `${renderLadder()}\n\nBet: **${formatNumber(amount)}** ${ec.currencyName}\n\nType ",climb" to go up or ",cashout" to stop.`, '#5865F2', 'Risk it for the biscuit');
  const msg = await message.reply({ embeds: [embed] });

  const filter = m => m.author.id === userId && [',climb', ',cashout'].includes(m.content.toLowerCase());
  const collector = message.channel.createMessageCollector({ filter, time: 60000 });

  collector.on('collect', async m => {
    if (m.content.toLowerCase() === ',cashout') {
      collector.stop();
      const mult = rungs[currentRung] || 1;
      const win = Math.floor(amount * mult);
      if (win > 0) addCredits(guildId, userId, win, 'ladder_cashout');
      user.gamesWon++;
      saveEconomy(guildId, ec);
      const cashEmbed = makeEmbed('Ladder — Cashed Out!', `Cashed at **${mult}x**\nWon **${formatNumber(win)}** ${ec.currencyName}\n**Profit:** +${formatNumber(win - amount)}`, '#57F287', `Balance: ${formatNumber(user.wallet)}`);
      await msg.edit({ embeds: [cashEmbed] });
      return;
    }

    if (Math.random() < 0.35) {
      alive = false;
      collector.stop();
      saveEconomy(guildId, ec);
      const fallEmbed = makeEmbed('Ladder — You Fell!', `You slipped and fell from rung **${rungs[currentRung]}x**!\nLost **${formatNumber(amount)}** ${ec.currencyName}.`, '#ED4245', `Balance: ${formatNumber(user.wallet)}`);
      await msg.edit({ embeds: [fallEmbed] });
      return;
    }

    currentRung++;
    if (currentRung >= rungs.length) {
      collector.stop();
      const win = Math.floor(amount * rungs[rungs.length - 1]);
      addCredits(guildId, userId, win, 'ladder_max');
      user.gamesWon++;
      saveEconomy(guildId, ec);
      const maxEmbed = makeEmbed('Ladder — MAX WIN!', `You reached the top! **${rungs[rungs.length - 1]}x**\nWon **${formatNumber(win)}** ${ec.currencyName}!`, '#57F287', `Balance: ${formatNumber(user.wallet)}`);
      await msg.edit({ embeds: [maxEmbed] });
      return;
    }

    const updateEmbed = makeEmbed('Ladder Climb', `${renderLadder()}\n\nBet: **${formatNumber(amount)}** ${ec.currencyName}\n\nType ",climb" or ",cashout"`, '#57F287', `Current: ${rungs[currentRung]}x`);
    await msg.edit({ embeds: [updateEmbed] });
  });
}

// ══════════════════════════════════════════════════════════
// GAMES: DICE
// ══════════════════════════════════════════════════════════

async function handleDice(message, args) {
  if (!isEconomyEnabled(message.guild.id)) return message.reply(err('Economy is not enabled.'));
  const guildId = message.guild.id;
  const userId = message.author.id;
  const user = getUserEconomy(guildId, userId);
  const ec = getEconomy(guildId);

  const amount = parseAmount(args[0], user, 'wallet');
  if (amount === null) return message.reply(err('Usage: `,dice <amount | all | half | quarter>`'));
  if (amount <= 0) return message.reply(err('Amount must be greater than 0.'));
  if (user.wallet < amount) return message.reply(err(`You only have **${formatNumber(user.wallet)}**.`));

  removeCredits(guildId, userId, amount, 'dice_bet');
  user.gamesPlayed++;

  const playerRoll = Math.floor(Math.random() * 6) + 1;
  const botRoll = Math.floor(Math.random() * 6) + 1;

  if (playerRoll > botRoll) {
    const payout = amount * 2;
    addCredits(guildId, userId, payout, 'dice_win');
    user.gamesWon++;
    saveEconomy(guildId, ec);
    const embed = makeEmbed('Dice — You Win!', `You rolled **${playerRoll}** vs Bot **${botRoll}**\nWon **${formatNumber(payout)}** ${ec.currencyName}!`, '#57F287', `Balance: ${formatNumber(user.wallet)}`);
    return message.reply({ embeds: [embed] });
  } else if (playerRoll < botRoll) {
    saveEconomy(guildId, ec);
    const embed = makeEmbed('Dice — You Lose', `You rolled **${playerRoll}** vs Bot **${botRoll}**\nLost **${formatNumber(amount)}** ${ec.currencyName}.`, '#ED4245', `Balance: ${formatNumber(user.wallet)}`);
    return message.reply({ embeds: [embed] });
  } else {
    addCredits(guildId, userId, amount, 'dice_tie');
    saveEconomy(guildId, ec);
    const embed = makeEmbed('Dice — Tie!', `You both rolled **${playerRoll}**\nYour bet was returned.`, '#2F3136', `Balance: ${formatNumber(user.wallet)}`);
    return message.reply({ embeds: [embed] });
  }
}

// ══════════════════════════════════════════════════════════
// GAMES: SLOTS
// ══════════════════════════════════════════════════════════

async function handleSlots(message, args) {
  if (!isEconomyEnabled(message.guild.id)) return message.reply(err('Economy is not enabled.'));
  const guildId = message.guild.id;
  const userId = message.author.id;
  const user = getUserEconomy(guildId, userId);
  const ec = getEconomy(guildId);

  const amount = parseAmount(args[0], user, 'wallet');
  if (amount === null) return message.reply(err('Usage: `,slots <amount | all | half | quarter>`'));
  if (amount <= 0) return message.reply(err('Amount must be greater than 0.'));
  if (user.wallet < amount) return message.reply(err(`You only have **${formatNumber(user.wallet)}**.`));

  removeCredits(guildId, userId, amount, 'slots_bet');
  user.gamesPlayed++;

  const symbols = ['🍒', '🍋', '🔔', '💎', '7️⃣', '⭐'];
  const reel1 = symbols[Math.floor(Math.random() * symbols.length)];
  const reel2 = symbols[Math.floor(Math.random() * symbols.length)];
  const reel3 = symbols[Math.floor(Math.random() * symbols.length)];

  let payout = 0;
  if (reel1 === reel2 && reel2 === reel3) {
    const mult = reel1 === '7️⃣' ? 50 : reel1 === '💎' ? 20 : reel1 === '⭐' ? 15 : 10;
    payout = amount * mult;
  } else if (reel1 === reel2 || reel2 === reel3 || reel1 === reel3) {
    payout = Math.floor(amount * 1.5);
  }

  if (payout > 0) {
    addCredits(guildId, userId, payout, 'slots_win');
    user.gamesWon++;
    saveEconomy(guildId, ec);
    const embed = makeEmbed('Slots — Jackpot!', `| ${reel1} | ${reel2} | ${reel3} |\n\nYou won **${formatNumber(payout)}** ${ec.currencyName}!`, '#57F287', `Balance: ${formatNumber(user.wallet)}`);
    return message.reply({ embeds: [embed] });
  } else {
    saveEconomy(guildId, ec);
    const embed = makeEmbed('Slots — No Luck', `| ${reel1} | ${reel2} | ${reel3} |\n\nLost **${formatNumber(amount)}** ${ec.currencyName}.`, '#ED4245', `Balance: ${formatNumber(user.wallet)}`);
    return message.reply({ embeds: [embed] });
  }
}

// ══════════════════════════════════════════════════════════
// GAMES: BLACKJACK
// ══════════════════════════════════════════════════════════

const blackjackGames = new Map();

function drawCard() {
  const values = ['A', '2', '3', '4', '5', '6', '7', '8', '9', '10', 'J', 'Q', 'K'];
  const suits = ['♠', '♥', '♦', '♣'];
  return { value: values[Math.floor(Math.random() * values.length)], suit: suits[Math.floor(Math.random() * suits.length)] };
}

function handValue(hand) {
  let total = 0;
  let aces = 0;
  for (const card of hand) {
    if (card.value === 'A') { aces++; total += 11; }
    else if (['J', 'Q', 'K'].includes(card.value)) total += 10;
    else total += parseInt(card.value);
  }
  while (total > 21 && aces > 0) { total -= 10; aces--; }
  return total;
}

function formatHand(hand) {
  return hand.map(c => `\`${c.value}${c.suit}\``).join(' ');
}

async function handleBlackjack(message, args) {
  if (!isEconomyEnabled(message.guild.id)) return message.reply(err('Economy is not enabled.'));
  const guildId = message.guild.id;
  const userId = message.author.id;
  const user = getUserEconomy(guildId, userId);
  const ec = getEconomy(guildId);

  const amount = parseAmount(args[0], user, 'wallet');
  if (amount === null) return message.reply(err('Usage: `,blackjack <amount | all | half | quarter>`'));
  if (amount <= 0) return message.reply(err('Amount must be greater than 0.'));
  if (user.wallet < amount) return message.reply(err(`You only have **${formatNumber(user.wallet)}**.`));

  removeCredits(guildId, userId, amount, 'blackjack_bet');
  user.gamesPlayed++;
  saveEconomy(guildId, ec);

  const playerHand = [drawCard(), drawCard()];
  const dealerHand = [drawCard(), drawCard()];

  const embed = makeEmbed('Blackjack', `Your hand: ${formatHand(playerHand)} = **${handValue(playerHand)}**\nDealer shows: \`${dealerHand[0].value}${dealerHand[0].suit}\` **?**\n\nType ",hit" or ",stand"`, '#5865F2', `Bet: ${formatNumber(amount)} ${ec.currencyName}`);
  const msg = await message.reply({ embeds: [embed] });

  blackjackGames.set(userId, { guildId, userId, amount, playerHand, dealerHand, msg });

  const filter = m => m.author.id === userId && [',hit', ',stand'].includes(m.content.toLowerCase());
  const collector = message.channel.createMessageCollector({ filter, time: 60000 });

  collector.on('collect', async m => {
    const game = blackjackGames.get(userId);
    if (!game) return;

    if (m.content.toLowerCase() === ',hit') {
      game.playerHand.push(drawCard());
      const pv = handValue(game.playerHand);

      if (pv > 21) {
        collector.stop();
        blackjackGames.delete(userId);
        const loseEmbed = makeEmbed('Blackjack — Bust!', `Your hand: ${formatHand(game.playerHand)} = **${pv}** (Bust!)\nDealer: ${formatHand(game.dealerHand)} = **${handValue(game.dealerHand)}**\n\nYou lost **${formatNumber(amount)}** ${ec.currencyName}.`, '#ED4245', `Balance: ${formatNumber(user.wallet)}`);
        await game.msg.edit({ embeds: [loseEmbed] });
        return;
      }

      const updateEmbed = makeEmbed('Blackjack', `Your hand: ${formatHand(game.playerHand)} = **${pv}**\nDealer shows: \`${game.dealerHand[0].value}${game.dealerHand[0].suit}\` **?**\n\nType ",hit" or ",stand"`, '#5865F2', `Bet: ${formatNumber(amount)} ${ec.currencyName}`);
      await game.msg.edit({ embeds: [updateEmbed] });
    }

    if (m.content.toLowerCase() === ',stand') {
      collector.stop();
      blackjackGames.delete(userId);

      let dealerVal = handValue(game.dealerHand);
      while (dealerVal < 17) {
        game.dealerHand.push(drawCard());
        dealerVal = handValue(game.dealerHand);
      }

      const playerVal = handValue(game.playerHand);
      let win = false;
      let tie = false;

      if (dealerVal > 21) win = true;
      else if (playerVal > dealerVal) win = true;
      else if (playerVal === dealerVal) tie = true;

      if (win) {
        const payout = amount * 2;
        addCredits(guildId, userId, payout, 'blackjack_win');
        user.gamesWon++;
        saveEconomy(guildId, ec);
        const winEmbed = makeEmbed('Blackjack — You Win!', `Your hand: ${formatHand(game.playerHand)} = **${playerVal}**\nDealer: ${formatHand(game.dealerHand)} = **${dealerVal}**\n\nWon **${formatNumber(payout)}** ${ec.currencyName}!`, '#57F287', `Balance: ${formatNumber(user.wallet)}`);
        await game.msg.edit({ embeds: [winEmbed] });
      } else if (tie) {
        addCredits(guildId, userId, amount, 'blackjack_tie');
        saveEconomy(guildId, ec);
        const tieEmbed = makeEmbed('Blackjack — Push', `Your hand: ${formatHand(game.playerHand)} = **${playerVal}**\nDealer: ${formatHand(game.dealerHand)} = **${dealerVal}**\n\nIt's a tie. Bet returned.`, '#2F3136', `Balance: ${formatNumber(user.wallet)}`);
        await game.msg.edit({ embeds: [tieEmbed] });
      } else {
        const loseEmbed = makeEmbed('Blackjack — Dealer Wins', `Your hand: ${formatHand(game.playerHand)} = **${playerVal}**\nDealer: ${formatHand(game.dealerHand)} = **${dealerVal}**\n\nYou lost **${formatNumber(amount)}** ${ec.currencyName}.`, '#ED4245', `Balance: ${formatNumber(user.wallet)}`);
        await game.msg.edit({ embeds: [loseEmbed] });
      }
    }
  });
}

// ══════════════════════════════════════════════════════════
// GAMES: MINES
// ══════════════════════════════════════════════════════════

async function handleMines(message, args) {
  if (!isEconomyEnabled(message.guild.id)) return message.reply(err('Economy is not enabled.'));
  const guildId = message.guild.id;
  const userId = message.author.id;
  const user = getUserEconomy(guildId, userId);
  const ec = getEconomy(guildId);

  const amount = parseAmount(args[0], user, 'wallet');
  if (amount === null) return message.reply(err('Usage: `,mines <amount | all | half | quarter>`'));
  if (amount <= 0) return message.reply(err('Amount must be greater than 0.'));
  if (user.wallet < amount) return message.reply(err(`You only have **${formatNumber(user.wallet)}**.`));

  removeCredits(guildId, userId, amount, 'mines_bet');
  user.gamesPlayed++;

  const gridSize = 25;
  const bombCount = 3;
  const bombs = new Set();
  while (bombs.size < bombCount) bombs.add(Math.floor(Math.random() * gridSize));

  const revealed = new Set();
  let multiplier = 1.0;

  const renderGrid = () => {
    let str = '';
    for (let i = 0; i < gridSize; i++) {
      if (i % 5 === 0 && i > 0) str += '\n';
      if (revealed.has(i)) {
        str += bombs.has(i) ? '💥 ' : '💎 ';
      } else {
        str += `\`${String(i + 1).padStart(2, '0')}\` `;
      }
    }
    return str;
  };

  const embed = makeEmbed('Mines', `${renderGrid()}\n\nMultiplier: **${multiplier.toFixed(2)}x**\nPotential: **${formatNumber(Math.floor(amount * multiplier))}** ${ec.currencyName}\n\nType a number (1-25) or ",cashout"`, '#5865F2', '3 bombs hidden');
  const msg = await message.reply({ embeds: [embed] });

  const filter = m => m.author.id === userId && (m.content.toLowerCase() === ',cashout' || (!isNaN(parseInt(m.content)) && parseInt(m.content) >= 1 && parseInt(m.content) <= 25));
  const collector = message.channel.createMessageCollector({ filter, time: 60000 });

  collector.on('collect', async m => {
    if (m.content.toLowerCase() === ',cashout') {
      collector.stop();
      const win = Math.floor(amount * multiplier);
      if (win > 0) addCredits(guildId, userId, win, 'mines_cashout');
      user.gamesWon++;
      saveEconomy(guildId, ec);
      const cashEmbed = makeEmbed('Mines — Cashed Out!', `Cashed at **${multiplier.toFixed(2)}x**\nWon **${formatNumber(win)}** ${ec.currencyName}\n**Profit:** +${formatNumber(win - amount)}`, '#57F287', `Balance: ${formatNumber(user.wallet)}`);
      await msg.edit({ embeds: [cashEmbed] });
      return;
    }

    const num = parseInt(m.content) - 1;
    if (revealed.has(num)) return;
    revealed.add(num);

    if (bombs.has(num)) {
      collector.stop();
      saveEconomy(guildId, ec);
      const loseEmbed = makeEmbed('Mines — BOOM!', `${renderGrid()}\n\nYou hit a bomb! Lost **${formatNumber(amount)}** ${ec.currencyName}.`, '#ED4245', `Balance: ${formatNumber(user.wallet)}`);
      await msg.edit({ embeds: [loseEmbed] });
      return;
    }

    multiplier += 0.35;
    const potential = Math.floor(amount * multiplier);
    const updateEmbed = makeEmbed('Mines — Safe!', `${renderGrid()}\n\nMultiplier: **${multiplier.toFixed(2)}x**\nPotential: **${formatNumber(potential)}** ${ec.currencyName}\n\nType a number or ",cashout"`, '#57F287', `${revealed.size}/${gridSize - bombCount} safe spots found`);
    await msg.edit({ embeds: [updateEmbed] });
  });
}

// ══════════════════════════════════════════════════════════
// EXPORTS
// ══════════════════════════════════════════════════════════

module.exports = {
  handleCrash, handleGamble, handleBombs, handleScratch,
  handleRoulette, handlePlinko, handleHighlow, handleLadder,
  handleDice, handleSlots, handleBlackjack, handleMines,
  handleRob,
};