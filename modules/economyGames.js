// ══════════════════════════════════════════════════════════
// ECONOMY GAMES MODULE — v2.1
// All 13 casino games + rob, fully polished premium embeds.
// CHANGELOG v2.1:
//   • NEW: coinflip command (,coinflip <amount> <heads|tails>)
//   • FIX: rob crashed on cooldown (formatDuration was never imported)
//   • FIX: rob cooldown never applied (lastRob was never set)
//   • FIX: crime now respects the configured crimeCooldown
//   • FIX: crash cash-out collector expired at 15s while the round
//          could run ~38s — you can now cash out the whole round
//   • FIX: mines/bombs/ladder timeouts now cash you out properly
//          and the game message shows the result instead of freezing
//   • FIX: blackjack natural 21 pays 2.5x, auto-stands on 21,
//          and timeouts refund nothing but end cleanly
//   • FIX: highlow ties are now a push (bet refunded)
//   • POLISH: every game embed redesigned — author avatar, emoji
//          titles, field layouts, live balance footers
//   • No odds, payouts, or features were removed.
// ══════════════════════════════════════════════════════════

const { EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle } = require('discord.js');
const { getEconomy, getUserEconomy, isEconomyEnabled, addCredits, removeCredits, saveEconomy, formatNumber, formatDuration, parseAmount, makeEmbed } = require('./economy');
const { hasDiscordPerm } = require('./helpers');
const { error: err, success: ok } = require('../utils/embeds');

// ══════════════════════════════════════════════════════════
// PREMIUM EMBED HELPERS
// ══════════════════════════════════════════════════════════

const GAME_COLORS = {
  play:  '#5865F2', // in-progress blurple
  win:   '#57F287', // win green
  lose:  '#ED4245', // loss red
  gold:  '#FFD700', // jackpot gold
  muted: '#2F3136', // push / neutral
};

/**
 * Builds a premium game embed: author avatar header, emoji title,
 * optional inline stat fields and a live balance footer.
 */
function gameEmbed(message, { title, description = null, color = GAME_COLORS.play, fields = [], balance, currencyName }) {
  const embed = new EmbedBuilder()
    .setColor(color)
    .setAuthor({ name: message.author.username, iconURL: message.author.displayAvatarURL({ size: 64 }) })
    .setTitle(title);
  if (description) embed.setDescription(description);
  if (fields.length) embed.addFields(fields);
  if (balance !== undefined) embed.setFooter({ text: `💵 Balance: ${formatNumber(balance)} ${currencyName}` });
  return embed;
}

/** Standard bet validation. Returns the amount, or replies with an error and returns null. */
function validateBet(message, args, user, usage) {
  const amount = parseAmount(args[0], user, 'wallet');
  if (amount === null) { message.reply(err(`Usage: \`${usage}\``)); return null; }
  if (amount <= 0) { message.reply(err('Amount must be greater than 0.')); return null; }
  if (user.wallet < amount) { message.reply(err(`You only have **${formatNumber(user.wallet)}** in your wallet.`)); return null; }
  return amount;
}

/** Inline stat fields used by result embeds. */
function betFields(amount, payout, currencyName, extra = []) {
  const profit = payout - amount;
  return [
    { name: '🎟️ Bet', value: `${formatNumber(amount)} ${currencyName}`, inline: true },
    { name: '💰 Payout', value: `${formatNumber(payout)} ${currencyName}`, inline: true },
    { name: '📈 Profit', value: `${profit >= 0 ? '+' : ''}${formatNumber(profit)}`, inline: true },
    ...extra,
  ];
}

// ══════════════════════════════════════════════════════════
// GAMES: COINFLIP (NEW)
// ══════════════════════════════════════════════════════════

async function handleCoinflip(message, args) {
  if (!isEconomyEnabled(message.guild.id)) return message.reply(err('Economy is not enabled.'));
  const guildId = message.guild.id;
  const userId = message.author.id;
  const user = getUserEconomy(guildId, userId);
  const ec = getEconomy(guildId);

  const amount = validateBet(message, args, user, ',coinflip <amount | all | half | quarter> <heads | tails>');
  if (amount === null) return;

  const sideRaw = (args[1] || '').toLowerCase();
  if (!['heads', 'tails', 'h', 't'].includes(sideRaw)) {
    return message.reply(err('Pick a side: `,coinflip <amount> <heads | tails>`'));
  }
  const pick = sideRaw.startsWith('h') ? 'heads' : 'tails';

  removeCredits(guildId, userId, amount, 'coinflip_bet');
  user.gamesPlayed++;

  // Suspenseful flip animation
  const flipping = gameEmbed(message, {
    title: '🪙 Coinflip — Flipping…',
    description: `The coin is spinning in the air…\n\nYou called **${pick === 'heads' ? '🗣️ Heads' : '🪽 Tails'}**`,
    color: GAME_COLORS.play,
    fields: [{ name: '🎟️ Bet', value: `${formatNumber(amount)} ${ec.currencyName}`, inline: true }],
  });
  const msg = await message.reply({ embeds: [flipping] });
  await new Promise(r => setTimeout(r, 1500));

  const result = Math.random() < 0.5 ? 'heads' : 'tails';
  const resultEmoji = result === 'heads' ? '🗣️ Heads' : '🪽 Tails';
  const win = result === pick;

  if (win) {
    const payout = amount * 2;
    addCredits(guildId, userId, payout, 'coinflip_win');
    user.gamesWon++;
    saveEconomy(guildId, ec);
    const winEmbed = gameEmbed(message, {
      title: '🪙 Coinflip — You Win!',
      description: `The coin landed on **${resultEmoji}**\nYou called it — nice flip! 🎉`,
      color: GAME_COLORS.win,
      fields: betFields(amount, payout, ec.currencyName, [{ name: '🪙 Result', value: resultEmoji, inline: true }]),
      balance: user.wallet,
      currencyName: ec.currencyName,
    });
    return msg.edit({ embeds: [winEmbed] });
  }

  saveEconomy(guildId, ec);
  const loseEmbed = gameEmbed(message, {
    title: '🪙 Coinflip — You Lose',
    description: `The coin landed on **${resultEmoji}**\nBetter luck on the next flip.`,
    color: GAME_COLORS.lose,
    fields: betFields(amount, 0, ec.currencyName, [{ name: '🪙 Result', value: resultEmoji, inline: true }]),
    balance: user.wallet,
    currencyName: ec.currencyName,
  });
  return msg.edit({ embeds: [loseEmbed] });
}

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

  const amount = validateBet(message, args, user, ',crash <amount | all | half | quarter>');
  if (amount === null) return;

  removeCredits(guildId, userId, amount, 'crash_bet');
  user.gamesPlayed++;
  saveEconomy(guildId, ec);

  const crashMult = 1.2 + Math.random() * 3.8; // crashes between 1.2x and 5.0x
  let current = 1.0;
  const step = 0.1;

  const render = () => gameEmbed(message, {
    title: '🚀 Crash — Round in Progress',
    description: `**Multiplier:** \`${current.toFixed(1)}x\`\n**Potential:** \`${formatNumber(Math.floor(amount * current))}\` ${ec.currencyName}\n\nReact with 💰 to **cash out** before it crashes!`,
    color: GAME_COLORS.play,
    fields: [{ name: '🎟️ Bet', value: `${formatNumber(amount)} ${ec.currencyName}`, inline: true }],
    balance: user.wallet,
    currencyName: ec.currencyName,
  });

  const msg = await message.reply({ embeds: [render()] });
  await msg.react('💰').catch(() => {});

  const filter = (reaction, u) => reaction.emoji.name === '💰' && u.id === userId;
  // FIX: collector now lives for the entire round (was 15s — high multipliers were uncashable)
  const collector = msg.createReactionCollector({ filter, time: 45000 });

  let cashed = false;
  let cashMult = 0;
  let done = false;

  const finish = async () => {
    if (done) return;
    done = true;
    clearInterval(interval);
    collector.stop();
    await msg.reactions.removeAll().catch(() => {});

    if (cashed) {
      const win = Math.floor(amount * cashMult);
      addCredits(guildId, userId, win, 'crash_win');
      user.gamesWon++;
      saveEconomy(guildId, ec);
      const winEmbed = gameEmbed(message, {
        title: '🚀 Crash — Cashed Out!',
        description: `You ejected at **${cashMult.toFixed(1)}x** — right before impact. 🪂`,
        color: GAME_COLORS.gold,
        fields: betFields(amount, win, ec.currencyName, [{ name: '✈️ Cashed At', value: `${cashMult.toFixed(1)}x`, inline: true }]),
        balance: user.wallet,
        currencyName: ec.currencyName,
      });
      await msg.edit({ embeds: [winEmbed] }).catch(() => {});
    } else {
      saveEconomy(guildId, ec);
      const loseEmbed = gameEmbed(message, {
        title: '💥 Crash — Busted!',
        description: `The rocket exploded at **${crashMult.toFixed(1)}x**.\nYou lost your bet.`,
        color: GAME_COLORS.lose,
        fields: betFields(amount, 0, ec.currencyName, [{ name: '💥 Crashed At', value: `${crashMult.toFixed(1)}x`, inline: true }]),
        balance: user.wallet,
        currencyName: ec.currencyName,
      });
      await msg.edit({ embeds: [loseEmbed] }).catch(() => {});
    }
  };

  collector.on('collect', () => {
    if (done) return;
    cashed = true;
    cashMult = current; // lock the multiplier at the exact moment of cash-out
    finish();
  });

  const interval = setInterval(async () => {
    if (done) return;
    current += step;
    if (current >= crashMult) return finish();
    await msg.edit({ embeds: [render()] }).catch(() => {});
  }, 1000);

  collector.on('end', () => { if (!done) finish(); });
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

  const amount = validateBet(message, args, user, ',gamble <amount | all | half | quarter> [heads | tails]');
  if (amount === null) return;

  const side = args[1]?.toLowerCase();

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
      const embed = gameEmbed(message, {
        title: '🎲 Gamble — Winner!',
        description: `You rode **${side}** all the way to the bank. 🎉`,
        color: GAME_COLORS.win,
        fields: betFields(amount, payout, ec.currencyName),
        balance: user.wallet,
        currencyName: ec.currencyName,
      });
      return message.reply({ embeds: [embed] });
    }
    saveEconomy(guildId, ec);
    const embed = gameEmbed(message, {
      title: '🎲 Gamble — Lost',
      description: `**${side}** let you down this time.`,
      color: GAME_COLORS.lose,
      fields: betFields(amount, 0, ec.currencyName),
      balance: user.wallet,
      currencyName: ec.currencyName,
    });
    return message.reply({ embeds: [embed] });
  }

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
  const color = profit > 0 ? (mult >= 3 ? GAME_COLORS.gold : GAME_COLORS.win) : profit < 0 ? GAME_COLORS.lose : GAME_COLORS.muted;
  const title = profit > 0 ? (mult >= 3 ? '🎲 Gamble — JACKPOT!' : '🎲 Gamble — Big Win!') : profit < 0 ? '🎲 Gamble — Unlucky' : '🎲 Gamble — Break Even';
  const embed = gameEmbed(message, {
    title,
    description: `The wheel stopped at a **${mult}x** multiplier.`,
    color,
    fields: betFields(amount, payout, ec.currencyName, [{ name: '🎡 Multiplier', value: `${mult}x`, inline: true }]),
    balance: user.wallet,
    currencyName: ec.currencyName,
  });
  return message.reply({ embeds: [embed] });
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

  const amount = validateBet(message, args, user, ',bombs <amount | all | half | quarter>');
  if (amount === null) return;

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

  const statusFields = () => [
    { name: '🎟️ Bet', value: `${formatNumber(amount)} ${ec.currencyName}`, inline: true },
    { name: '✖️ Multiplier', value: `${multiplier.toFixed(2)}x`, inline: true },
    { name: '💰 Potential', value: `${formatNumber(Math.floor(amount * multiplier))}`, inline: true },
  ];

  const embed = gameEmbed(message, {
    title: '💣 Bombs — Minesweeper',
    description: `${renderGrid()}\n\nType a number (**1-25**) to reveal a tile.\nType \`,cashout\` to walk away with your winnings.`,
    color: GAME_COLORS.play,
    fields: statusFields(),
    balance: user.wallet,
    currencyName: ec.currencyName,
  });
  const msg = await message.reply({ embeds: [embed] });

  const filter = m => m.author.id === userId && (m.content.toLowerCase() === ',cashout' || (!isNaN(parseInt(m.content)) && parseInt(m.content) >= 1 && parseInt(m.content) <= 25));
  const collector = message.channel.createMessageCollector({ filter, time: 60000 });

  collector.on('collect', async m => {
    if (m.content.toLowerCase() === ',cashout') {
      alive = false;
      collector.stop();
      const win = Math.floor(amount * multiplier);
      if (win > 0) addCredits(guildId, userId, win, 'bombs_cashout');
      user.gamesWon++;
      saveEconomy(guildId, ec);
      const cashEmbed = gameEmbed(message, {
        title: '💣 Bombs — Cashed Out!',
        description: `${renderGrid()}\n\nYou escaped the field at **${multiplier.toFixed(2)}x**. 💨`,
        color: GAME_COLORS.win,
        fields: betFields(amount, win, ec.currencyName),
        balance: user.wallet,
        currencyName: ec.currencyName,
      });
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
      const loseEmbed = gameEmbed(message, {
        title: '💣 Bombs — BOOM!',
        description: `${renderGrid()}\n\nTile **${num + 1}** was a bomb. The field claims your bet.`,
        color: GAME_COLORS.lose,
        fields: betFields(amount, 0, ec.currencyName),
        balance: user.wallet,
        currencyName: ec.currencyName,
      });
      await msg.edit({ embeds: [loseEmbed] });
      return;
    }

    multiplier += 0.25;
    const updateEmbed = gameEmbed(message, {
      title: '💣 Bombs — Safe Tile!',
      description: `${renderGrid()}\n\nType a number (**1-25**) or \`,cashout\`.`,
      color: GAME_COLORS.win,
      fields: statusFields(),
      balance: user.wallet,
      currencyName: ec.currencyName,
    });
    await msg.edit({ embeds: [updateEmbed] });
  });

  // FIX: timeout now cashes you out AND shows the result (previously paid silently)
  collector.on('end', async () => {
    if (alive && revealed.size > 0) {
      const win = Math.floor(amount * multiplier);
      if (win > 0) addCredits(guildId, userId, win, 'bombs_timeout');
      user.gamesWon++;
      saveEconomy(guildId, ec);
      const timeoutEmbed = gameEmbed(message, {
        title: '💣 Bombs — Auto Cash-Out',
        description: `${renderGrid()}\n\n⏰ Time ran out — you were cashed out at **${multiplier.toFixed(2)}x**.`,
        color: GAME_COLORS.win,
        fields: betFields(amount, win, ec.currencyName),
        balance: user.wallet,
        currencyName: ec.currencyName,
      });
      await msg.edit({ embeds: [timeoutEmbed] }).catch(() => {});
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

  const amount = validateBet(message, args, user, ',scratch <amount | all | half | quarter>');
  if (amount === null) return;

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

  const grid = `┃ ${card[0]} ${card[1]} ${card[2]} ┃\n┃ ${card[3]} ${card[4]} ${card[5]} ┃\n┃ ${card[6]} ${card[7]} ${card[8]} ┃`;

  if (winAmount > 0) {
    addCredits(guildId, userId, winAmount, 'scratch_win');
    user.gamesWon++;
    saveEconomy(guildId, ec);
    const embed = gameEmbed(message, {
      title: '🎫 Scratch Card — Winner!',
      description: `\`${'─'.repeat(11)}\`\n${grid}\n\`${'─'.repeat(11)}\`\nWinning lines on your card! 🎉`,
      color: winAmount >= amount * 5 ? GAME_COLORS.gold : GAME_COLORS.win,
      fields: betFields(amount, winAmount, ec.currencyName),
      balance: user.wallet,
      currencyName: ec.currencyName,
    });
    return message.reply({ embeds: [embed] });
  }

  saveEconomy(guildId, ec);
  const embed = gameEmbed(message, {
    title: '🎫 Scratch Card — No Match',
    description: `\`${'─'.repeat(11)}\`\n${grid}\n\`${'─'.repeat(11)}\`\nNo winning lines this time.`,
    color: GAME_COLORS.lose,
    fields: betFields(amount, 0, ec.currencyName),
    balance: user.wallet,
    currencyName: ec.currencyName,
  });
  return message.reply({ embeds: [embed] });
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

  const colorEmoji = isGreen ? '🟢' : isRed ? '🔴' : '⚫';
  const colorName = isGreen ? 'Green' : isRed ? 'Red' : 'Black';

  if (win) {
    const payout = Math.floor(amount * multiplier);
    addCredits(guildId, userId, payout, 'roulette_win');
    user.gamesWon++;
    saveEconomy(guildId, ec);
    const embed = gameEmbed(message, {
      title: betType === 'green' ? '🎡 Roulette — GREEN JACKPOT!' : '🎡 Roulette — Winner!',
      description: `The ball landed on ${colorEmoji} **${number}** (${colorName})\nYour **${betType}** bet paid **${multiplier}x**!`,
      color: betType === 'green' ? GAME_COLORS.gold : GAME_COLORS.win,
      fields: betFields(amount, payout, ec.currencyName),
      balance: user.wallet,
      currencyName: ec.currencyName,
    });
    return message.reply({ embeds: [embed] });
  }

  saveEconomy(guildId, ec);
  const embed = gameEmbed(message, {
    title: '🎡 Roulette — Lost',
    description: `The ball landed on ${colorEmoji} **${number}** (${colorName})\nYour **${betType}** bet didn't hit.`,
    color: GAME_COLORS.lose,
    fields: betFields(amount, 0, ec.currencyName),
    balance: user.wallet,
    currencyName: ec.currencyName,
  });
  return message.reply({ embeds: [embed] });
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

  // FIX: formatDuration is now imported, and lastRob is actually set below,
  // so the configured robCooldown works instead of crashing / never applying.
  const remaining = (user.lastRob || 0) + ec.robCooldown - Date.now();
  if (remaining > 0) {
    return message.reply(err(`You're still laying low. Come back in **${formatDuration(remaining)}**.`));
  }

  const target = message.mentions.users.first();
  if (!target) return message.reply(err('Mention a user: `,rob @user`'));
  if (target.id === userId) return message.reply(err('You cannot rob yourself.'));
  if (target.bot) return message.reply(err('You cannot rob a bot.'));

  const targetUser = getUserEconomy(guildId, target.id);
  if (targetUser.wallet < 100) return message.reply(err(`**${target.username}** doesn't have enough to rob.`));

  user.robAttempts++;
  user.lastRob = Date.now(); // FIX: cooldown now actually applies
  const success = Math.random() < 0.4; // 40% success

  if (success) {
    const steal = Math.floor(Math.min(targetUser.wallet * 0.3, 5000));
    targetUser.wallet -= steal;
    user.wallet += steal;
    user.robSuccess++;
    saveEconomy(guildId, ec);
    const embed = gameEmbed(message, {
      title: '🥷 Robbery — Clean Getaway!',
      description: `You slipped into **${target.username}**'s pockets and escaped with the goods.`,
      color: GAME_COLORS.win,
      fields: [
        { name: '🎯 Target', value: target.username, inline: true },
        { name: '💰 Stolen', value: `${formatNumber(steal)} ${ec.currencyName}`, inline: true },
      ],
      balance: user.wallet,
      currencyName: ec.currencyName,
    });
    return message.reply({ embeds: [embed] });
  }

  const fine = Math.floor(Math.random() * 200) + 50;
  user.wallet = Math.max(0, user.wallet - fine);
  saveEconomy(guildId, ec);
  const embed = gameEmbed(message, {
    title: '🚨 Robbery — Caught Red-Handed!',
    description: `**${target.username}** caught you in the act. The authorities took a cut.`,
    color: GAME_COLORS.lose,
    fields: [
      { name: '🎯 Target', value: target.username, inline: true },
      { name: '💸 Fine', value: `${formatNumber(fine)} ${ec.currencyName}`, inline: true },
    ],
    balance: user.wallet,
    currencyName: ec.currencyName,
  });
  return message.reply({ embeds: [embed] });
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

  const amount = validateBet(message, args, user, ',plinko <amount | all | half | quarter>');
  if (amount === null) return;

  removeCredits(guildId, userId, amount, 'plinko_bet');
  user.gamesPlayed++;

  const slots = [0.2, 0.5, 1, 1.5, 2, 3, 5, 0.2, 0.5];
  const weights = [5, 10, 20, 15, 10, 5, 2, 5, 10];
  const totalWeight = weights.reduce((a, b) => a + b, 0);
  let rand = Math.random() * totalWeight;
  let mult = slots[0];
  let slotIndex = 0;
  for (let i = 0; i < slots.length; i++) {
    rand -= weights[i];
    if (rand <= 0) { mult = slots[i]; slotIndex = i; break; }
  }

  // Fun visual: slot bar with a pointer at the landing slot
  const bar = slots.map((s, i) => i === slotIndex ? `**[${s}x]**` : `\`${s}x\``).join(' ');
  const pointerPad = '　'.repeat(Math.min(slotIndex, slots.length - 1));
  const board = `🔻\n${bar}\n${pointerPad}👈 your chip`;

  const payout = Math.floor(amount * mult);
  if (payout > 0) {
    addCredits(guildId, userId, payout, 'plinko_win');
    if (mult >= 1) user.gamesWon++;
  }
  saveEconomy(guildId, ec);

  const profit = payout - amount;
  const color = profit > 0 ? (mult >= 3 ? GAME_COLORS.gold : GAME_COLORS.win) : profit < 0 ? GAME_COLORS.lose : GAME_COLORS.muted;
  const title = profit > 0 ? (mult >= 3 ? '🎯 Plinko — JACKPOT SLOT!' : '🎯 Plinko — Win!') : profit < 0 ? '🎯 Plinko — Loss' : '🎯 Plinko — Break Even';
  const embed = gameEmbed(message, {
    title,
    description: `${board}\n\nThe chip settled into a **${mult}x** slot.`,
    color,
    fields: betFields(amount, payout, ec.currencyName, [{ name: '✖️ Multiplier', value: `${mult}x`, inline: true }]),
    balance: user.wallet,
    currencyName: ec.currencyName,
  });
  return message.reply({ embeds: [embed] });
}

// ══════════════════════════════════════════════════════════
// GAMES: HIGHLOW
// ══════════════════════════════════════════════════════════

const HL_SUITS = ['♠️', '♥️', '♦️', '♣️'];
function hlCard(n) {
  const ranks = { 1: 'A', 11: 'J', 12: 'Q', 13: 'K' };
  return `\`${ranks[n] || n}${HL_SUITS[Math.floor(Math.random() * HL_SUITS.length)]}\``;
}

async function handleHighlow(message, args) {
  if (!isEconomyEnabled(message.guild.id)) return message.reply(err('Economy is not enabled.'));
  const guildId = message.guild.id;
  const userId = message.author.id;
  const user = getUserEconomy(guildId, userId);
  const ec = getEconomy(guildId);

  const amount = validateBet(message, args, user, ',highlow <amount | all | half | quarter>');
  if (amount === null) return;

  removeCredits(guildId, userId, amount, 'highlow_bet');
  user.gamesPlayed++;

  const current = Math.floor(Math.random() * 13) + 1; // 1-13
  const next = Math.floor(Math.random() * 13) + 1;

  const embed = gameEmbed(message, {
    title: '🃏 High or Low?',
    description: `**Current card:** ${hlCard(current)}\n**Bet:** ${formatNumber(amount)} ${ec.currencyName}\n\nWill the next card be **Higher** ⬆️ or **Lower** ⬇️?\nType \`higher\` or \`lower\`.`,
    color: GAME_COLORS.play,
    balance: user.wallet,
    currencyName: ec.currencyName,
  });
  const msg = await message.reply({ embeds: [embed] });

  const filter = m => m.author.id === userId && ['higher', 'lower', 'h', 'l'].includes(m.content.toLowerCase());
  const collected = await message.channel.awaitMessages({ filter, max: 1, time: 30000 });

  if (!collected.size) {
    saveEconomy(guildId, ec);
    const timeoutEmbed = gameEmbed(message, {
      title: '🃏 HighLow — Timeout',
      description: `The next card was ${hlCard(next)} (**${next}**).\nYou didn't answer in time and lost your bet.`,
      color: GAME_COLORS.lose,
      fields: betFields(amount, 0, ec.currencyName),
      balance: user.wallet,
      currencyName: ec.currencyName,
    });
    return msg.edit({ embeds: [timeoutEmbed] });
  }

  const guess = collected.first().content.toLowerCase();
  const guessLabel = (guess === 'higher' || guess === 'h') ? '⬆️ Higher' : '⬇️ Lower';

  // FIX: a tie is a push — bet refunded instead of silently losing
  if (next === current) {
    addCredits(guildId, userId, amount, 'highlow_push');
    saveEconomy(guildId, ec);
    const pushEmbed = gameEmbed(message, {
      title: '🃏 HighLow — Push',
      description: `**Card:** ${hlCard(current)} → ${hlCard(next)}\nBoth cards were **${current}**. Your bet was refunded.`,
      color: GAME_COLORS.muted,
      fields: betFields(amount, amount, ec.currencyName),
      balance: user.wallet,
      currencyName: ec.currencyName,
    });
    return msg.edit({ embeds: [pushEmbed] });
  }

  const isHigher = next > current;
  const win = (guess === 'higher' || guess === 'h') ? isHigher : !isHigher;

  if (win) {
    const payout = amount * 2;
    addCredits(guildId, userId, payout, 'highlow_win');
    user.gamesWon++;
    saveEconomy(guildId, ec);
    const winEmbed = gameEmbed(message, {
      title: '🃏 HighLow — Correct!',
      description: `**Card:** ${hlCard(current)} → ${hlCard(next)}\nYou called **${guessLabel}** — right on the money.`,
      color: GAME_COLORS.win,
      fields: betFields(amount, payout, ec.currencyName),
      balance: user.wallet,
      currencyName: ec.currencyName,
    });
    return msg.edit({ embeds: [winEmbed] });
  }

  saveEconomy(guildId, ec);
  const loseEmbed = gameEmbed(message, {
    title: '🃏 HighLow — Wrong Call',
    description: `**Card:** ${hlCard(current)} → ${hlCard(next)}\nYou called **${guessLabel}** — the deck disagreed.`,
    color: GAME_COLORS.lose,
    fields: betFields(amount, 0, ec.currencyName),
    balance: user.wallet,
    currencyName: ec.currencyName,
  });
  return msg.edit({ embeds: [loseEmbed] });
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

  const amount = validateBet(message, args, user, ',ladder <amount | all | half | quarter>');
  if (amount === null) return;

  removeCredits(guildId, userId, amount, 'ladder_bet');
  user.gamesPlayed++;

  const rungs = [1.2, 1.5, 2, 2.5, 3, 5, 10];
  let currentRung = 0;
  let alive = true;

  const renderLadder = () => {
    return rungs.map((r, i) => {
      const marker = i === currentRung ? '👉' : i < currentRung ? '✅' : '⬜';
      return `${marker} **${r}x** — ${formatNumber(Math.floor(amount * r))} ${ec.currencyName}`;
    }).join('\n');
  };

  const embed = gameEmbed(message, {
    title: '🪜 Ladder Climb',
    description: `${renderLadder()}\n\nType \`,climb\` to go up or \`,cashout\` to stop.\n⚠️ Every climb has a **35%** chance to fall!`,
    color: GAME_COLORS.play,
    fields: [{ name: '🎟️ Bet', value: `${formatNumber(amount)} ${ec.currencyName}`, inline: true }],
    balance: user.wallet,
    currencyName: ec.currencyName,
  });
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
      const cashEmbed = gameEmbed(message, {
        title: '🪜 Ladder — Cashed Out!',
        description: `${renderLadder()}\n\nSmart move — you stepped off at **${mult}x**.`,
        color: GAME_COLORS.win,
        fields: betFields(amount, win, ec.currencyName),
        balance: user.wallet,
        currencyName: ec.currencyName,
      });
      await msg.edit({ embeds: [cashEmbed] });
      return;
    }

    if (Math.random() < 0.35) {
      alive = false;
      collector.stop();
      saveEconomy(guildId, ec);
      const fallEmbed = gameEmbed(message, {
        title: '🪜 Ladder — You Fell!',
        description: `${renderLadder()}\n\nYou slipped reaching for rung **${rungs[currentRung]}x** and lost your bet.`,
        color: GAME_COLORS.lose,
        fields: betFields(amount, 0, ec.currencyName),
        balance: user.wallet,
        currencyName: ec.currencyName,
      });
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
      const maxEmbed = gameEmbed(message, {
        title: '🪜 Ladder — TOP OF THE WORLD!',
        description: `${renderLadder()}\n\nYou conquered every rung for the max **${rungs[rungs.length - 1]}x**! 👑`,
        color: GAME_COLORS.gold,
        fields: betFields(amount, win, ec.currencyName),
        balance: user.wallet,
        currencyName: ec.currencyName,
      });
      await msg.edit({ embeds: [maxEmbed] });
      return;
    }

    const updateEmbed = gameEmbed(message, {
      title: '🪜 Ladder Climb',
      description: `${renderLadder()}\n\nType \`,climb\` or \`,cashout\`.`,
      color: GAME_COLORS.win,
      fields: [
        { name: '🎟️ Bet', value: `${formatNumber(amount)} ${ec.currencyName}`, inline: true },
        { name: '📍 Current', value: `${rungs[currentRung]}x`, inline: true },
      ],
      balance: user.wallet,
      currencyName: ec.currencyName,
    });
    await msg.edit({ embeds: [updateEmbed] });
  });

  // FIX: timeout now auto-cashes you out at your current rung (previously the bet silently vanished)
  collector.on('end', async () => {
    if (alive && currentRung >= 0) {
      const mult = rungs[currentRung] || 1;
      const win = Math.floor(amount * mult);
      if (win > 0) addCredits(guildId, userId, win, 'ladder_timeout');
      user.gamesWon++;
      saveEconomy(guildId, ec);
      const timeoutEmbed = gameEmbed(message, {
        title: '🪜 Ladder — Auto Cash-Out',
        description: `${renderLadder()}\n\n⏰ Time ran out — you were cashed out at **${mult}x**.`,
        color: GAME_COLORS.win,
        fields: betFields(amount, win, ec.currencyName),
        balance: user.wallet,
        currencyName: ec.currencyName,
      });
      await msg.edit({ embeds: [timeoutEmbed] }).catch(() => {});
    }
  });
}

// ══════════════════════════════════════════════════════════
// GAMES: DICE
// ══════════════════════════════════════════════════════════

const DICE_FACES = ['⚀', '⚁', '⚂', '⚃', '⚄', '⚅'];

async function handleDice(message, args) {
  if (!isEconomyEnabled(message.guild.id)) return message.reply(err('Economy is not enabled.'));
  const guildId = message.guild.id;
  const userId = message.author.id;
  const user = getUserEconomy(guildId, userId);
  const ec = getEconomy(guildId);

  const amount = validateBet(message, args, user, ',dice <amount | all | half | quarter>');
  if (amount === null) return;

  removeCredits(guildId, userId, amount, 'dice_bet');
  user.gamesPlayed++;

  const playerRoll = Math.floor(Math.random() * 6) + 1;
  const botRoll = Math.floor(Math.random() * 6) + 1;
  const rollLine = `You ${DICE_FACES[playerRoll - 1]} **${playerRoll}**  vs  Bot ${DICE_FACES[botRoll - 1]} **${botRoll}**`;

  if (playerRoll > botRoll) {
    const payout = amount * 2;
    addCredits(guildId, userId, payout, 'dice_win');
    user.gamesWon++;
    saveEconomy(guildId, ec);
    const embed = gameEmbed(message, {
      title: '🎲 Dice — You Win!',
      description: `${rollLine}\n\nHigher roll takes the pot. 🎉`,
      color: GAME_COLORS.win,
      fields: betFields(amount, payout, ec.currencyName),
      balance: user.wallet,
      currencyName: ec.currencyName,
    });
    return message.reply({ embeds: [embed] });
  }

  if (playerRoll < botRoll) {
    saveEconomy(guildId, ec);
    const embed = gameEmbed(message, {
      title: '🎲 Dice — You Lose',
      description: `${rollLine}\n\nThe bot edged you out.`,
      color: GAME_COLORS.lose,
      fields: betFields(amount, 0, ec.currencyName),
      balance: user.wallet,
      currencyName: ec.currencyName,
    });
    return message.reply({ embeds: [embed] });
  }

  addCredits(guildId, userId, amount, 'dice_tie');
  saveEconomy(guildId, ec);
  const embed = gameEmbed(message, {
    title: '🎲 Dice — Tie!',
    description: `${rollLine}\n\nDead even — your bet was returned.`,
    color: GAME_COLORS.muted,
    fields: betFields(amount, amount, ec.currencyName),
    balance: user.wallet,
    currencyName: ec.currencyName,
  });
  return message.reply({ embeds: [embed] });
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

  const amount = validateBet(message, args, user, ',slots <amount | all | half | quarter>');
  if (amount === null) return;

  removeCredits(guildId, userId, amount, 'slots_bet');
  user.gamesPlayed++;

  const symbols = ['🍒', '🍋', '🔔', '💎', '7️⃣', '⭐'];
  const reel1 = symbols[Math.floor(Math.random() * symbols.length)];
  const reel2 = symbols[Math.floor(Math.random() * symbols.length)];
  const reel3 = symbols[Math.floor(Math.random() * symbols.length)];

  let payout = 0;
  let resultLabel = 'No match';
  if (reel1 === reel2 && reel2 === reel3) {
    const mult = reel1 === '7️⃣' ? 50 : reel1 === '💎' ? 20 : reel1 === '⭐' ? 15 : 10;
    payout = amount * mult;
    resultLabel = `Triple ${reel1} — **${mult}x**!`;
  } else if (reel1 === reel2 || reel2 === reel3 || reel1 === reel3) {
    payout = Math.floor(amount * 1.5);
    resultLabel = 'Pair — **1.5x**';
  }

  const reels = `╔═══╦═══╦═══╗\n  ${reel1} ║ ${reel2} ║ ${reel3}\n╚═══╩═══╩═══╝`;

  if (payout > 0) {
    addCredits(guildId, userId, payout, 'slots_win');
    user.gamesWon++;
    saveEconomy(guildId, ec);
    const jackpot = reel1 === reel2 && reel2 === reel3 && (reel1 === '7️⃣' || reel1 === '💎');
    const embed = gameEmbed(message, {
      title: jackpot ? '🎰 Slots — JACKPOT!!' : '🎰 Slots — Winner!',
      description: `${reels}\n${resultLabel}`,
      color: jackpot ? GAME_COLORS.gold : GAME_COLORS.win,
      fields: betFields(amount, payout, ec.currencyName),
      balance: user.wallet,
      currencyName: ec.currencyName,
    });
    return message.reply({ embeds: [embed] });
  }

  saveEconomy(guildId, ec);
  const embed = gameEmbed(message, {
    title: '🎰 Slots — No Luck',
    description: `${reels}\n${resultLabel}`,
    color: GAME_COLORS.lose,
    fields: betFields(amount, 0, ec.currencyName),
    balance: user.wallet,
    currencyName: ec.currencyName,
  });
  return message.reply({ embeds: [embed] });
}

// ══════════════════════════════════════════════════════════
// GAMES: BLACKJACK
// ══════════════════════════════════════════════════════════

const blackjackGames = new Map();

function drawCard() {
  const values = ['A', '2', '3', '4', '5', '6', '7', '8', '9', '10', 'J', 'Q', 'K'];
  const suits = ['♠️', '♥️', '♦️', '♣️'];
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

  const amount = validateBet(message, args, user, ',blackjack <amount | all | half | quarter>');
  if (amount === null) return;

  removeCredits(guildId, userId, amount, 'blackjack_bet');
  user.gamesPlayed++;
  saveEconomy(guildId, ec);

  const playerHand = [drawCard(), drawCard()];
  const dealerHand = [drawCard(), drawCard()];
  const playerStart = handValue(playerHand);

  const tableEmbed = (title, color, note) => gameEmbed(message, {
    title,
    description: `**Your hand:** ${formatHand(playerHand)} = **${handValue(playerHand)}**\n**Dealer shows:** \`${dealerHand[0].value}${dealerHand[0].suit}\` 🎴\n\n${note}`,
    color,
    fields: [{ name: '🎟️ Bet', value: `${formatNumber(amount)} ${ec.currencyName}`, inline: true }],
    balance: user.wallet,
    currencyName: ec.currencyName,
  });

  // NEW: natural blackjack (21 on the deal) pays 2.5x instantly
  if (playerStart === 21) {
    const payout = Math.floor(amount * 2.5);
    addCredits(guildId, userId, payout, 'blackjack_natural');
    user.gamesWon++;
    saveEconomy(guildId, ec);
    const natEmbed = gameEmbed(message, {
      title: '🂡 Blackjack — NATURAL 21! 👑',
      description: `**Your hand:** ${formatHand(playerHand)} = **21**\n**Dealer:** ${formatHand(dealerHand)} = **${handValue(dealerHand)}**\n\nBlackjack on the deal — pays **2.5x**!`,
      color: GAME_COLORS.gold,
      fields: betFields(amount, payout, ec.currencyName),
      balance: user.wallet,
      currencyName: ec.currencyName,
    });
    return message.reply({ embeds: [natEmbed] });
  }

  const msg = await message.reply({ embeds: [tableEmbed('🂡 Blackjack', GAME_COLORS.play, 'Type `,hit` to draw or `,stand` to hold.')] });

  blackjackGames.set(userId, { guildId, userId, amount, playerHand, dealerHand, msg });

  const filter = m => m.author.id === userId && [',hit', ',stand'].includes(m.content.toLowerCase());
  const collector = message.channel.createMessageCollector({ filter, time: 60000 });

  // NEW: timeout no longer swallows the game silently — bet is lost and the table closes cleanly
  collector.on('end', async () => {
    const game = blackjackGames.get(userId);
    if (!game) return; // game already resolved
    blackjackGames.delete(userId);
    saveEconomy(guildId, ec);
    const timeoutEmbed = gameEmbed(message, {
      title: '🂡 Blackjack — Table Closed',
      description: `**Your hand:** ${formatHand(game.playerHand)} = **${handValue(game.playerHand)}**\n\n⏰ You walked away from the table. Bet lost.`,
      color: GAME_COLORS.lose,
      fields: betFields(game.amount, 0, ec.currencyName),
      balance: user.wallet,
      currencyName: ec.currencyName,
    });
    await game.msg.edit({ embeds: [timeoutEmbed] }).catch(() => {});
  });

  collector.on('collect', async m => {
    const game = blackjackGames.get(userId);
    if (!game) return;

    if (m.content.toLowerCase() === ',hit') {
      game.playerHand.push(drawCard());
      const pv = handValue(game.playerHand);

      if (pv > 21) {
        collector.stop();
        blackjackGames.delete(userId);
        const loseEmbed = gameEmbed(message, {
          title: '🂡 Blackjack — Bust!',
          description: `**Your hand:** ${formatHand(game.playerHand)} = **${pv}** 💥\n**Dealer:** ${formatHand(game.dealerHand)} = **${handValue(game.dealerHand)}**\n\nOver 21 — the house takes it.`,
          color: GAME_COLORS.lose,
          fields: betFields(amount, 0, ec.currencyName),
          balance: user.wallet,
          currencyName: ec.currencyName,
        });
        await game.msg.edit({ embeds: [loseEmbed] });
        return;
      }

      // NEW: hitting to exactly 21 stands automatically
      if (pv === 21) {
        game.autoStand = true; // fall through to the stand logic below
      } else {
        const updateEmbed = gameEmbed(message, {
          title: '🂡 Blackjack',
          description: `**Your hand:** ${formatHand(game.playerHand)} = **${pv}**\n**Dealer shows:** \`${game.dealerHand[0].value}${game.dealerHand[0].suit}\` 🎴\n\nType \`,hit\` or \`,stand\``,
          color: GAME_COLORS.play,
          fields: [{ name: '🎟️ Bet', value: `${formatNumber(amount)} ${ec.currencyName}`, inline: true }],
          balance: user.wallet,
          currencyName: ec.currencyName,
        });
        await game.msg.edit({ embeds: [updateEmbed] });
        return;
      }
    }

    if (m.content.toLowerCase() === ',stand' || game.autoStand) {
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

      const handsLine = `**Your hand:** ${formatHand(game.playerHand)} = **${playerVal}**\n**Dealer:** ${formatHand(game.dealerHand)} = **${dealerVal}**`;

      if (win) {
        const payout = amount * 2;
        addCredits(guildId, userId, payout, 'blackjack_win');
        user.gamesWon++;
        saveEconomy(guildId, ec);
        const winEmbed = gameEmbed(message, {
          title: '🂡 Blackjack — You Win!',
          description: `${handsLine}\n\n${dealerVal > 21 ? 'Dealer busted!' : 'You out-scored the dealer.'} 🎉`,
          color: GAME_COLORS.win,
          fields: betFields(amount, payout, ec.currencyName),
          balance: user.wallet,
          currencyName: ec.currencyName,
        });
        await game.msg.edit({ embeds: [winEmbed] });
      } else if (tie) {
        addCredits(guildId, userId, amount, 'blackjack_tie');
        saveEconomy(guildId, ec);
        const tieEmbed = gameEmbed(message, {
          title: '🂡 Blackjack — Push',
          description: `${handsLine}\n\nDead even — bet returned.`,
          color: GAME_COLORS.muted,
          fields: betFields(amount, amount, ec.currencyName),
          balance: user.wallet,
          currencyName: ec.currencyName,
        });
        await game.msg.edit({ embeds: [tieEmbed] });
      } else {
        saveEconomy(guildId, ec);
        const loseEmbed = gameEmbed(message, {
          title: '🂡 Blackjack — Dealer Wins',
          description: `${handsLine}\n\nThe house takes this one.`,
          color: GAME_COLORS.lose,
          fields: betFields(amount, 0, ec.currencyName),
          balance: user.wallet,
          currencyName: ec.currencyName,
        });
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

  const amount = validateBet(message, args, user, ',mines <amount | all | half | quarter>');
  if (amount === null) return;

  removeCredits(guildId, userId, amount, 'mines_bet');
  user.gamesPlayed++;

  const gridSize = 25;
  const bombCount = 3;
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
        str += bombs.has(i) ? '💥 ' : '💎 ';
      } else {
        str += `\`${String(i + 1).padStart(2, '0')}\` `;
      }
    }
    return str;
  };

  const statusFields = () => [
    { name: '🎟️ Bet', value: `${formatNumber(amount)} ${ec.currencyName}`, inline: true },
    { name: '✖️ Multiplier', value: `${multiplier.toFixed(2)}x`, inline: true },
    { name: '💰 Potential', value: `${formatNumber(Math.floor(amount * multiplier))}`, inline: true },
  ];

  const embed = gameEmbed(message, {
    title: '💎 Mines',
    description: `${renderGrid()}\n\nType a number (**1-25**) to dig for gems.\nType \`,cashout\` to leave the mine.\n⚠️ **${bombCount}** bombs are hidden!`,
    color: GAME_COLORS.play,
    fields: statusFields(),
    balance: user.wallet,
    currencyName: ec.currencyName,
  });
  const msg = await message.reply({ embeds: [embed] });

  const filter = m => m.author.id === userId && (m.content.toLowerCase() === ',cashout' || (!isNaN(parseInt(m.content)) && parseInt(m.content) >= 1 && parseInt(m.content) <= 25));
  const collector = message.channel.createMessageCollector({ filter, time: 60000 });

  collector.on('collect', async m => {
    if (m.content.toLowerCase() === ',cashout') {
      alive = false;
      collector.stop();
      const win = Math.floor(amount * multiplier);
      if (win > 0) addCredits(guildId, userId, win, 'mines_cashout');
      user.gamesWon++;
      saveEconomy(guildId, ec);
      const cashEmbed = gameEmbed(message, {
        title: '💎 Mines — Cashed Out!',
        description: `${renderGrid()}\n\nYou left the mine at **${multiplier.toFixed(2)}x** with pockets full.`,
        color: GAME_COLORS.win,
        fields: betFields(amount, win, ec.currencyName),
        balance: user.wallet,
        currencyName: ec.currencyName,
      });
      await msg.edit({ embeds: [cashEmbed] });
      return;
    }

    const num = parseInt(m.content) - 1;
    if (revealed.has(num)) return;
    revealed.add(num);

    if (bombs.has(num)) {
      collector.stop();
      saveEconomy(guildId, ec);
      const loseEmbed = gameEmbed(message, {
        title: '💎 Mines — BOOM!',
        description: `${renderGrid()}\n\nTile **${num + 1}** hid a bomb. The mine keeps your bet.`,
        color: GAME_COLORS.lose,
        fields: betFields(amount, 0, ec.currencyName),
        balance: user.wallet,
        currencyName: ec.currencyName,
      });
      await msg.edit({ embeds: [loseEmbed] });
      return;
    }

    multiplier += 0.35;
    const updateEmbed = gameEmbed(message, {
      title: '💎 Mines — Gem Found!',
      description: `${renderGrid()}\n\nType a number (**1-25**) or \`,cashout\`.`,
      color: GAME_COLORS.win,
      fields: statusFields(),
      balance: user.wallet,
      currencyName: ec.currencyName,
    });
    await msg.edit({ embeds: [updateEmbed] });
  });

  // FIX: mines timeout now auto-cashes you out like bombs (previously the bet silently vanished)
  collector.on('end', async () => {
    if (alive && revealed.size > 0) {
      const win = Math.floor(amount * multiplier);
      if (win > 0) addCredits(guildId, userId, win, 'mines_timeout');
      user.gamesWon++;
      saveEconomy(guildId, ec);
      const timeoutEmbed = gameEmbed(message, {
        title: '💎 Mines — Auto Cash-Out',
        description: `${renderGrid()}\n\n⏰ Time ran out — you were cashed out at **${multiplier.toFixed(2)}x**.`,
        color: GAME_COLORS.win,
        fields: betFields(amount, win, ec.currencyName),
        balance: user.wallet,
        currencyName: ec.currencyName,
      });
      await msg.edit({ embeds: [timeoutEmbed] }).catch(() => {});
    }
  });
}

// ══════════════════════════════════════════════════════════
// EXPORTS
// ══════════════════════════════════════════════════════════

module.exports = {
  handleCoinflip,
  handleCrash, handleGamble, handleBombs, handleScratch,
  handleRoulette, handlePlinko, handleHighlow, handleLadder,
  handleDice, handleSlots, handleBlackjack, handleMines,
  handleRob,
};