// ══════════════════════════════════════════════════════════
// ECONOMY GAMES MODULE — v2.0
// ══════════════════════════════════════════════════════════

const { EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle } = require('discord.js');
const { getEconomy, getUserEconomy, isEconomyEnabled, addCredits, removeCredits, saveEconomy, formatNumber, parseAmount, setCooldown } = require('./economy');
const { err, ok, info, COLORS } = require('../utils/embeds');

// ══════════════════════════════════════════════════════════
// GAME HELPERS
// ══════════════════════════════════════════════════════════

const GAME_COLORS = {
  play: '#FAA61A',
  win: '#57F287',
  lose: '#ED4245',
  info: '#5865F2',
};

// FIX: validateBet is now async and catches its own reply to prevent unhandled rejections
async function validateBet(message, args, user, usage) {
  const amount = parseAmount(args[0], user, 'wallet');
  if (amount === null) {
    await message.reply(err(`Usage: \`${usage}\``)).catch(() => {});
    return null;
  }
  if (amount <= 0) {
    await message.reply(err('Amount must be greater than 0.')).catch(() => {});
    return null;
  }
  if (user.wallet < amount) {
    await message.reply(err(`You only have **${formatNumber(user.wallet)}** in your wallet.`)).catch(() => {});
    return null;
  }
  return amount;
}

function betFields(amount, payout, currencyName, extra = []) {
  const profit = payout - amount;
  return [
    { name: '🎟️ Bet', value: `${formatNumber(amount)} ${currencyName}`, inline: true },
    { name: '💰 Payout', value: `${formatNumber(payout)} ${currencyName}`, inline: true },
    { name: '📈 Profit', value: `${profit >= 0 ? '+' : ''}${formatNumber(profit)}`, inline: true },
    ...extra,
  ];
}

function gameEmbed(message, { title, description = null, color = GAME_COLORS.play, fields = [], balance, currencyName }) {
  const embed = new EmbedBuilder()
    .setColor(color)
    .setAuthor({ name: message.author?.username || 'Unknown', iconURL: message.author?.displayAvatarURL({ size: 64 }) || undefined })
    .setTitle(title || 'Game');
  if (description) embed.setDescription(description);
  if (fields.length) embed.addFields(fields);
  if (balance !== undefined) embed.setFooter({ text: `💵 Balance: ${formatNumber(balance)} ${currencyName || 'Credits'}` });
  return embed;
}

// ══════════════════════════════════════════════════════════
// SLOTS
// ══════════════════════════════════════════════════════════

async function handleSlots(message, args) {
  if (!isEconomyEnabled(message.guild.id)) return message.reply(err('Economy is not enabled.'));
  const guildId = message.guild.id;
  const userId = message.author.id;
  const user = getUserEconomy(guildId, userId);
  const ec = getEconomy(guildId);

  const amount = await validateBet(message, args, user, ',slots <amount>');
  if (amount === null) return;

  user.gamesPlayed++;
  const symbols = ['🍒','🍋','🍊','🍇','💎','🔔','7️⃣'];
  const weights = [30,25,20,15,5,3,2];
  const payouts = { '🍒': 2, '🍋': 3, '🍊': 4, '🍇': 5, '💎': 10, '🔔': 15, '7️⃣': 50 };

  function spin() {
    const total = weights.reduce((a, b) => a + b, 0);
    let r = Math.random() * total;
    for (let i = 0; i < symbols.length; i++) { r -= weights[i]; if (r <= 0) return symbols[i]; }
    return symbols[0];
  }

  const row = [spin(), spin(), spin()];
  const allSame = row.every(s => s === row[0]);
  const hasDiamond = row.includes('💎');
  const hasSeven = row.includes('7️⃣');

  let multiplier = 0;
  if (allSame) multiplier = payouts[row[0]] || 1;
  else if (hasSeven) multiplier = 2;
  else if (hasDiamond) multiplier = 1.5;

  const payout = Math.floor(amount * multiplier);
  const win = payout > 0;

  if (win) {
    addCredits(guildId, userId, payout, 'slots');
    user.gamesWon++;
  } else {
    removeCredits(guildId, userId, amount, 'slots_loss');
  }
  saveEconomy(guildId, ec);

  const embed = gameEmbed(message, {
    title: '🎰 Slots Result',
    description: `**${row.join(' ')}**\n\n${win ? `**${multiplier}x** payout!` : 'No match — better luck next time.'}`,
    color: win ? GAME_COLORS.win : GAME_COLORS.lose,
    fields: betFields(amount, payout, ec.currencyName),
    balance: user.wallet,
    currencyName: ec.currencyName,
  });
  return message.reply({ embeds: [embed] });
}

// ══════════════════════════════════════════════════════════
// BLACKJACK
// ══════════════════════════════════════════════════════════

async function handleBlackjack(message, args) {
  if (!isEconomyEnabled(message.guild.id)) return message.reply(err('Economy is not enabled.'));
  const guildId = message.guild.id;
  const userId = message.author.id;
  const user = getUserEconomy(guildId, userId);
  const ec = getEconomy(guildId);

  const amount = await validateBet(message, args, user, ',blackjack <amount>');
  if (amount === null) return;

  user.gamesPlayed++;

  const suits = ['♠','♥','♦','♣'];
  const ranks = ['2','3','4','5','6','7','8','9','10','J','Q','K','A'];
  const values = { '2':2,'3':3,'4':4,'5':5,'6':6,'7':7,'8':8,'9':9,'10':10,'J':10,'Q':10,'K':10,'A':11 };
  let deck = [];
  for (const s of suits) for (const r of ranks) deck.push({ suit: s, rank: r, value: values[r] });
  deck = deck.sort(() => Math.random() - 0.5);

  function handValue(hand) {
    let val = 0, aces = 0;
    for (const c of hand) { val += c.value; if (c.rank === 'A') aces++; }
    while (val > 21 && aces > 0) { val -= 10; aces--; }
    return val;
  }

  function formatHand(hand) {
    return hand.map(c => `${c.suit}${c.rank}`).join(' ');
  }

  let player = [deck.pop(), deck.pop()];
  let dealer = [deck.pop(), deck.pop()];

  const embed = gameEmbed(message, {
    title: '🃏 Blackjack',
    description: `**Your hand:** ${formatHand(player)} (**${handValue(player)}**)\n**Dealer shows:** ${dealer[0].suit}${dealer[0].rank} ?`,
    color: GAME_COLORS.play,
    fields: [{ name: '🎟️ Bet', value: `${formatNumber(amount)} ${ec.currencyName}`, inline: true }],
    balance: user.wallet,
    currencyName: ec.currencyName,
  });

  const row = new ActionRowBuilder().addComponents(
    new ButtonBuilder().setCustomId('hit').setLabel('Hit').setStyle(ButtonStyle.Primary),
    new ButtonBuilder().setCustomId('stand').setLabel('Stand').setStyle(ButtonStyle.Secondary),
    new ButtonBuilder().setCustomId('double').setLabel('Double Down').setStyle(ButtonStyle.Danger),
  );

  const msg = await message.reply({ embeds: [embed], components: [row] });

  let doubled = false;
  let done = false;

  const collector = msg.createMessageComponentCollector({
    filter: i => i.user.id === userId,
    time: 60000,
  });

  collector.on('collect', async i => {
    if (i.customId === 'double') {
      if (user.wallet < amount) {
        return i.reply({ embeds: [err('Not enough balance to double down.')], ephemeral: true });
      }
      doubled = true;
      removeCredits(guildId, userId, amount, 'blackjack_double');
    }

    if (i.customId === 'hit' || i.customId === 'double') {
      player.push(deck.pop());
      const pv = handValue(player);
      if (pv > 21) {
        done = true;
        collector.stop();
        const loseEmbed = gameEmbed(message, {
          title: '🃏 Blackjack — Bust!',
          description: `**Your hand:** ${formatHand(player)} (**${pv}**)\n**Dealer:** ${formatHand(dealer)} (**${handValue(dealer)}**)`,
          color: GAME_COLORS.lose,
          fields: betFields(amount, 0, ec.currencyName),
          balance: user.wallet,
          currencyName: ec.currencyName,
        });
        await msg.edit({ embeds: [loseEmbed], components: [] }).catch(() => {});
        await i.deferUpdate().catch(() => {});
        return;
      }
    }

    if (i.customId === 'stand' || i.customId === 'double') {
      done = true;
      collector.stop();
      while (handValue(dealer) < 17) dealer.push(deck.pop());
      const pv = handValue(player);
      const dv = handValue(dealer);
      const bet = doubled ? amount * 2 : amount;
      let payout = 0;
      let result = '';

      if (pv > 21) { payout = 0; result = 'Bust!'; }
      else if (dv > 21) { payout = bet * 2; result = 'Dealer busts — you win!'; user.gamesWon++; }
      else if (pv > dv) { payout = bet * 2; result = 'You win!'; user.gamesWon++; }
      else if (pv === dv) { payout = bet; result = 'Push — tie!'; }
      else { payout = 0; result = 'Dealer wins.'; }

      if (payout > 0) addCredits(guildId, userId, payout, 'blackjack');
      else removeCredits(guildId, userId, bet, 'blackjack_loss');
      saveEconomy(guildId, ec);

      const resultEmbed = gameEmbed(message, {
        title: `🃏 Blackjack — ${result}`,
        description: `**Your hand:** ${formatHand(player)} (**${pv}**)\n**Dealer:** ${formatHand(dealer)} (**${dv}**)`,
        color: payout > bet ? GAME_COLORS.win : payout === bet ? GAME_COLORS.info : GAME_COLORS.lose,
        fields: betFields(bet, payout, ec.currencyName),
        balance: user.wallet,
        currencyName: ec.currencyName,
      });
      await msg.edit({ embeds: [resultEmbed], components: [] }).catch(() => {});
      await i.deferUpdate().catch(() => {});
      return;
    }

    const updateEmbed = gameEmbed(message, {
      title: '🃏 Blackjack',
      description: `**Your hand:** ${formatHand(player)} (**${handValue(player)}**)\n**Dealer shows:** ${dealer[0].suit}${dealer[0].rank} ?`,
      color: GAME_COLORS.play,
      fields: [{ name: '🎟️ Bet', value: `${formatNumber(doubled ? amount * 2 : amount)} ${ec.currencyName}`, inline: true }],
      balance: user.wallet,
      currencyName: ec.currencyName,
    });
    await msg.edit({ embeds: [updateEmbed], components: [row] }).catch(() => {});
    await i.deferUpdate().catch(() => {});
  });

  collector.on('end', async () => {
    if (!done) {
      removeCredits(guildId, userId, amount, 'blackjack_timeout');
      saveEconomy(guildId, ec);
      const timeoutEmbed = gameEmbed(message, {
        title: '🃏 Blackjack — Timeout',
        description: 'You took too long. Bet forfeited.',
        color: GAME_COLORS.lose,
        fields: betFields(amount, 0, ec.currencyName),
        balance: user.wallet,
        currencyName: ec.currencyName,
      });
      await msg.edit({ embeds: [timeoutEmbed], components: [] }).catch(() => {});
    }
  });
}

// ══════════════════════════════════════════════════════════
// MINES
// ══════════════════════════════════════════════════════════

async function handleMines(message, args) {
  if (!isEconomyEnabled(message.guild.id)) return message.reply(err('Economy is not enabled.'));
  const guildId = message.guild.id;
  const userId = message.author.id;
  const user = getUserEconomy(guildId, userId);
  const ec = getEconomy(guildId);

  const amount = await validateBet(message, args, user, ',mines <amount>');
  if (amount === null) return;

  user.gamesPlayed++;
  removeCredits(guildId, userId, amount, 'mines_bet');
  saveEconomy(guildId, ec);

  const gridSize = 25;
  const bombCount = 3;
  const bombs = new Set();
  while (bombs.size < bombCount) bombs.add(Math.floor(Math.random() * gridSize));
  const revealed = new Set();
  let alive = true;
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

  const collector = message.channel.createMessageCollector({
    filter: m => m.author.id === userId && (m.content.toLowerCase() === ',cashout' || (!isNaN(parseInt(m.content)) && parseInt(m.content) >= 1 && parseInt(m.content) <= 25)),
    time: 120000,
  });

  collector.on('collect', async m => {
    if (!alive) return;
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
      await msg.edit({ embeds: [cashEmbed] }).catch(() => {});
      return;
    }

    const num = parseInt(m.content) - 1;
    if (revealed.has(num)) return;
    revealed.add(num);

    if (bombs.has(num)) {
      alive = false;
      collector.stop();
      const loseEmbed = gameEmbed(message, {
        title: '💎 Mines — BOOM!',
        description: `${renderGrid()}\n\nTile **${num + 1}** hid a bomb. The mine keeps your bet.`,
        color: GAME_COLORS.lose,
        fields: betFields(amount, 0, ec.currencyName),
        balance: user.wallet,
        currencyName: ec.currencyName,
      });
      await msg.edit({ embeds: [loseEmbed] }).catch(() => {});
      return;
    }

    multiplier += 0.25;
    const updateEmbed = gameEmbed(message, {
      title: '💎 Mines — Gem Found!',
      description: `${renderGrid()}\n\nType a number (**1-25**) or \`,cashout\`.`,
      color: GAME_COLORS.win,
      fields: statusFields(),
      balance: user.wallet,
      currencyName: ec.currencyName,
    });
    await msg.edit({ embeds: [updateEmbed] }).catch(() => {});
  });

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
// CRASH
// ══════════════════════════════════════════════════════════

async function handleCrash(message, args) {
  if (!isEconomyEnabled(message.guild.id)) return message.reply(err('Economy is not enabled.'));
  const guildId = message.guild.id;
  const userId = message.author.id;
  const user = getUserEconomy(guildId, userId);
  const ec = getEconomy(guildId);

  const amount = await validateBet(message, args, user, ',crash <amount>');
  if (amount === null) return;

  user.gamesPlayed++;
  removeCredits(guildId, userId, amount, 'crash_bet');
  saveEconomy(guildId, ec);

  let multiplier = 1.0;
  let done = false;
  const crashAt = 1 + Math.random() * 4;

  const render = () => gameEmbed(message, {
    title: '🚀 Crash',
    description: `Multiplier: **${multiplier.toFixed(2)}x**\n\nReact 💰 to cash out before it crashes!`,
    color: GAME_COLORS.play,
    fields: [{ name: '🎟️ Bet', value: `${formatNumber(amount)} ${ec.currencyName}`, inline: true }],
    balance: user.wallet,
    currencyName: ec.currencyName,
  });

  const msg = await message.reply({ embeds: [render()] });
  await msg.react('💰').catch(() => {});

  const finish = async () => {
    if (done) return;
    done = true;
    clearInterval(interval);
    collector.stop();
    await msg.reactions.removeAll().catch(() => {});

    if (multiplier >= crashAt) {
      const loseEmbed = gameEmbed(message, {
        title: '🚀 Crash — Crashed!',
        description: `Crashed at **${crashAt.toFixed(2)}x**! You lost your bet.`,
        color: GAME_COLORS.lose,
        fields: betFields(amount, 0, ec.currencyName),
        balance: user.wallet,
        currencyName: ec.currencyName,
      });
      await msg.edit({ embeds: [loseEmbed] }).catch(() => {});
      return;
    }

    const win = Math.floor(amount * multiplier);
    addCredits(guildId, userId, win, 'crash');
    user.gamesWon++;
    saveEconomy(guildId, ec);
    const winEmbed = gameEmbed(message, {
      title: '🚀 Crash — Cashed Out!',
      description: `Cashed out at **${multiplier.toFixed(2)}x**!`,
      color: GAME_COLORS.win,
      fields: betFields(amount, win, ec.currencyName),
      balance: user.wallet,
      currencyName: ec.currencyName,
    });
    await msg.edit({ embeds: [winEmbed] }).catch(() => {});
  };

  const interval = setInterval(() => {
    multiplier += 0.1;
    if (multiplier >= crashAt) return finish();
    msg.edit({ embeds: [render()] }).catch(() => {});
  }, 1000);

  const collector = msg.createReactionCollector({
    filter: (reaction, u) => u.id === userId && reaction.emoji.name === '💰',
    time: 30000,
  });

  collector.on('collect', () => finish());
  collector.on('end', () => { if (!done) finish(); });
}

// ══════════════════════════════════════════════════════════
// COINFLIP
// ══════════════════════════════════════════════════════════

async function handleCoinflip(message, args) {
  if (!isEconomyEnabled(message.guild.id)) return message.reply(err('Economy is not enabled.'));
  const guildId = message.guild.id;
  const userId = message.author.id;
  const user = getUserEconomy(guildId, userId);
  const ec = getEconomy(guildId);

  const amount = await validateBet(message, args, user, ',coinflip <amount> [heads|tails]');
  if (amount === null) return;

  const sideRaw = (args[1] || '').toLowerCase();
  if (!['heads', 'tails', 'h', 't'].includes(sideRaw)) {
    return message.reply(err('Pick a side: \`,coinflip <amount> <heads|tails>\`'));
  }

  const pick = sideRaw === 'h' || sideRaw === 'heads' ? 'heads' : 'tails';
  user.gamesPlayed++;
  removeCredits(guildId, userId, amount, 'coinflip_bet');
  saveEconomy(guildId, ec);

  const flipping = gameEmbed(message, {
    title: '🪙 Coinflip — Flipping…',
    description: `The coin is spinning in the air…\n\nYou called **${pick === 'heads' ? '🗣️ Heads' : '🪽 Tails'}**`,
    color: GAME_COLORS.play,
    fields: [{ name: '🎟️ Bet', value: `${formatNumber(amount)} ${ec.currencyName}`, inline: true }],
    balance: user.wallet,
    currencyName: ec.currencyName,
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
    return msg.edit({ embeds: [winEmbed] }).catch(() => {});
  } else {
    const loseEmbed = gameEmbed(message, {
      title: '🪙 Coinflip — You Lose',
      description: `The coin landed on **${resultEmoji}**\nBetter luck next time.`,
      color: GAME_COLORS.lose,
      fields: betFields(amount, 0, ec.currencyName, [{ name: '🪙 Result', value: resultEmoji, inline: true }]),
      balance: user.wallet,
      currencyName: ec.currencyName,
    });
    return msg.edit({ embeds: [loseEmbed] }).catch(() => {});
  }
}

// ══════════════════════════════════════════════════════════
// GAMBLE
// ══════════════════════════════════════════════════════════

async function handleGamble(message, args) {
  if (!isEconomyEnabled(message.guild.id)) return message.reply(err('Economy is not enabled.'));
  const guildId = message.guild.id;
  const userId = message.author.id;
  const user = getUserEconomy(guildId, userId);
  const ec = getEconomy(guildId);

  const amount = await validateBet(message, args, user, ',gamble <amount>');
  if (amount === null) return;

  user.gamesPlayed++;
  removeCredits(guildId, userId, amount, 'gamble_bet');
  saveEconomy(guildId, ec);

  const roll = Math.floor(Math.random() * 100) + 1;
  let win = false;
  let payout = 0;

  if (roll >= 90) { win = true; payout = amount * 3; }
  else if (roll >= 60) { win = true; payout = amount * 1.5; }
  else if (roll >= 40) { payout = amount; }
  else { payout = 0; }

  if (win) {
    addCredits(guildId, userId, payout, 'gamble');
    user.gamesWon++;
  }
  saveEconomy(guildId, ec);

  const embed = gameEmbed(message, {
    title: `🎲 Gamble — ${win ? 'Win!' : payout === amount ? 'Push' : 'Lose'}`,
    description: `You rolled **${roll}**${win ? ' — jackpot tier!' : payout === amount ? ' — break even.' : ' — unlucky.'}`,
    color: win ? GAME_COLORS.win : payout === amount ? GAME_COLORS.info : GAME_COLORS.lose,
    fields: betFields(amount, payout, ec.currencyName),
    balance: user.wallet,
    currencyName: ec.currencyName,
  });
  return message.reply({ embeds: [embed] });
}

// ══════════════════════════════════════════════════════════
// ROULETTE
// ══════════════════════════════════════════════════════════

async function handleRoulette(message, args) {
  if (!isEconomyEnabled(message.guild.id)) return message.reply(err('Economy is not enabled.'));
  const guildId = message.guild.id;
  const userId = message.author.id;
  const user = getUserEconomy(guildId, userId);
  const ec = getEconomy(guildId);

  const amount = await validateBet(message, args, user, ',roulette <amount> [red|black|green|number]');
  if (amount === null) return;

  const betType = (args[1] || 'red').toLowerCase();
  const number = parseInt(args[1]);
  const validColors = ['red', 'black', 'green'];
  const isNumberBet = !isNaN(number) && number >= 0 && number <= 36;

  if (!validColors.includes(betType) && !isNumberBet) {
    return message.reply(err('Bet on red, black, green, or a number 0-36.'));
  }

  user.gamesPlayed++;
  removeCredits(guildId, userId, amount, 'roulette_bet');
  saveEconomy(guildId, ec);

  const spin = Math.floor(Math.random() * 37);
  const colors = ['green', ...Array(18).fill('red'), ...Array(18).fill('black')];
  const resultColor = colors[spin] || 'black';
  const resultNumber = spin;

  let win = false;
  let payout = 0;

  if (isNumberBet && number === resultNumber) { win = true; payout = amount * 36; }
  else if (betType === resultColor) { win = true; payout = betType === 'green' ? amount * 14 : amount * 2; }
  else { payout = 0; }

  if (win) {
    addCredits(guildId, userId, payout, 'roulette');
    user.gamesWon++;
  }
  saveEconomy(guildId, ec);

  const embed = gameEmbed(message, {
    title: `🎰 Roulette — ${win ? 'Win!' : 'Lose'}`,
    description: `The ball landed on **${resultNumber} ${resultColor.toUpperCase()}**`,
    color: win ? GAME_COLORS.win : GAME_COLORS.lose,
    fields: betFields(amount, payout, ec.currencyName, [{ name: '🎯 Your Bet', value: isNumberBet ? `Number ${number}` : betType, inline: true }]),
    balance: user.wallet,
    currencyName: ec.currencyName,
  });
  return message.reply({ embeds: [embed] });
}

// ══════════════════════════════════════════════════════════
// PLINKO
// ══════════════════════════════════════════════════════════

async function handlePlinko(message, args) {
  if (!isEconomyEnabled(message.guild.id)) return message.reply(err('Economy is not enabled.'));
  const guildId = message.guild.id;
  const userId = message.author.id;
  const user = getUserEconomy(guildId, userId);
  const ec = getEconomy(guildId);

  const amount = await validateBet(message, args, user, ',plinko <amount>');
  if (amount === null) return;

  user.gamesPlayed++;
  removeCredits(guildId, userId, amount, 'plinko_bet');
  saveEconomy(guildId, ec);

  const multipliers = [0.2, 0.5, 1, 1.5, 2, 3, 5, 3, 2, 1.5, 1, 0.5, 0.2];
  let pos = 6;
  let path = '';
  for (let i = 0; i < 8; i++) {
    pos += Math.random() < 0.5 ? -1 : 1;
    pos = Math.max(0, Math.min(12, pos));
    path += pos < 6 ? '⬅️ ' : pos > 6 ? '➡️ ' : '⬇️ ';
  }
  const mult = multipliers[pos];
  const payout = Math.floor(amount * mult);
  const win = payout > amount;

  if (win) {
    addCredits(guildId, userId, payout, 'plinko');
    user.gamesWon++;
  }
  saveEconomy(guildId, ec);

  const embed = gameEmbed(message, {
    title: `🔵 Plinko — ${win ? 'Win!' : 'Lose'}`,
    description: `Path: ${path}\n\nLanded in slot **${pos + 1}** (**${mult}x** multiplier)`,
    color: win ? GAME_COLORS.win : GAME_COLORS.lose,
    fields: betFields(amount, payout, ec.currencyName),
    balance: user.wallet,
    currencyName: ec.currencyName,
  });
  return message.reply({ embeds: [embed] });
}

// ══════════════════════════════════════════════════════════
// LADDER
// ══════════════════════════════════════════════════════════

async function handleLadder(message, args) {
  if (!isEconomyEnabled(message.guild.id)) return message.reply(err('Economy is not enabled.'));
  const guildId = message.guild.id;
  const userId = message.author.id;
  const user = getUserEconomy(guildId, userId);
  const ec = getEconomy(guildId);

  const amount = await validateBet(message, args, user, ',ladder <amount>');
  if (amount === null) return;

  user.gamesPlayed++;
  removeCredits(guildId, userId, amount, 'ladder_bet');
  saveEconomy(guildId, ec);

  const levels = [
    { mult: 1.2, risk: 0.1 },
    { mult: 1.5, risk: 0.2 },
    { mult: 2.0, risk: 0.3 },
    { mult: 3.0, risk: 0.4 },
    { mult: 5.0, risk: 0.5 },
    { mult: 10.0, risk: 0.6 },
  ];

  let current = 0;
  let active = true;

  const render = () => {
    let desc = '';
    for (let i = 0; i < levels.length; i++) {
      const marker = i === current ? '👉' : i < current ? '✅' : '⬜';
      desc += `${marker} Level ${i + 1}: **${levels[i].mult}x** (risk ${Math.round(levels[i].risk * 100)}%)\n`;
    }
    return desc;
  };

  const embed = gameEmbed(message, {
    title: '🪜 Ladder Game',
    description: `${render()}\n\nReact ⬆️ to climb or 💰 to cash out.`,
    color: GAME_COLORS.play,
    fields: [{ name: '🎟️ Bet', value: `${formatNumber(amount)} ${ec.currencyName}`, inline: true }],
    balance: user.wallet,
    currencyName: ec.currencyName,
  });

  const msg = await message.reply({ embeds: [embed] });
  await msg.react('⬆️').catch(() => {});
  await msg.react('💰').catch(() => {});

  const collector = msg.createReactionCollector({
    filter: (reaction, u) => u.id === userId && ['⬆️', '💰'].includes(reaction.emoji.name),
    time: 60000,
  });

  collector.on('collect', async (reaction) => {
    if (!active) return;
    if (reaction.emoji.name === '💰') {
      active = false;
      collector.stop();
      const win = Math.floor(amount * levels[current].mult);
      addCredits(guildId, userId, win, 'ladder');
      user.gamesWon++;
      saveEconomy(guildId, ec);
      const cashEmbed = gameEmbed(message, {
        title: '🪜 Ladder — Cashed Out!',
        description: `${render()}\n\nCashed out at Level ${current + 1} (**${levels[current].mult}x**).`,
        color: GAME_COLORS.win,
        fields: betFields(amount, win, ec.currencyName),
        balance: user.wallet,
        currencyName: ec.currencyName,
      });
      await msg.edit({ embeds: [cashEmbed] }).catch(() => {});
      await msg.reactions.removeAll().catch(() => {});
      return;
    }

    if (Math.random() < levels[current].risk) {
      active = false;
      collector.stop();
      const loseEmbed = gameEmbed(message, {
        title: '🪜 Ladder — Fall!',
        description: `${render()}\n\nYou fell at Level ${current + 1}!`,
        color: GAME_COLORS.lose,
        fields: betFields(amount, 0, ec.currencyName),
        balance: user.wallet,
        currencyName: ec.currencyName,
      });
      await msg.edit({ embeds: [loseEmbed] }).catch(() => {});
      await msg.reactions.removeAll().catch(() => {});
      return;
    }

    current++;
    if (current >= levels.length) {
      active = false;
      collector.stop();
      const win = Math.floor(amount * levels[levels.length - 1].mult);
      addCredits(guildId, userId, win, 'ladder');
      user.gamesWon++;
      saveEconomy(guildId, ec);
      const winEmbed = gameEmbed(message, {
        title: '🪜 Ladder — Top Reached!',
        description: `${render()}\n\nYou reached the top! **${levels[levels.length - 1].mult}x** payout!`,
        color: GAME_COLORS.win,
        fields: betFields(amount, win, ec.currencyName),
        balance: user.wallet,
        currencyName: ec.currencyName,
      });
      await msg.edit({ embeds: [winEmbed] }).catch(() => {});
      await msg.reactions.removeAll().catch(() => {});
      return;
    }

    const updateEmbed = gameEmbed(message, {
      title: '🪜 Ladder Game',
      description: `${render()}\n\nReact ⬆️ to climb or 💰 to cash out.`,
      color: GAME_COLORS.play,
      fields: [{ name: '🎟️ Bet', value: `${formatNumber(amount)} ${ec.currencyName}`, inline: true }],
      balance: user.wallet,
      currencyName: ec.currencyName,
    });
    await msg.edit({ embeds: [updateEmbed] }).catch(() => {});
  });

  collector.on('end', async () => {
    if (active) {
      const win = Math.floor(amount * levels[current].mult);
      addCredits(guildId, userId, win, 'ladder_timeout');
      user.gamesWon++;
      saveEconomy(guildId, ec);
      const timeoutEmbed = gameEmbed(message, {
        title: '🪜 Ladder — Auto Cash-Out',
        description: `${render()}\n\nTime ran out — auto cashed out at Level ${current + 1}.`,
        color: GAME_COLORS.win,
        fields: betFields(amount, win, ec.currencyName),
        balance: user.wallet,
        currencyName: ec.currencyName,
      });
      await msg.edit({ embeds: [timeoutEmbed] }).catch(() => {});
      await msg.reactions.removeAll().catch(() => {});
    }
  });
}

// ══════════════════════════════════════════════════════════
// DICE
// ══════════════════════════════════════════════════════════

async function handleDice(message, args) {
  if (!isEconomyEnabled(message.guild.id)) return message.reply(err('Economy is not enabled.'));
  const guildId = message.guild.id;
  const userId = message.author.id;
  const user = getUserEconomy(guildId, userId);
  const ec = getEconomy(guildId);

  const amount = await validateBet(message, args, user, ',dice <amount>');
  if (amount === null) return;

  user.gamesPlayed++;
  removeCredits(guildId, userId, amount, 'dice_bet');
  saveEconomy(guildId, ec);

  const playerRoll = Math.floor(Math.random() * 6) + 1;
  const botRoll = Math.floor(Math.random() * 6) + 1;
  const win = playerRoll > botRoll;
  const tie = playerRoll === botRoll;
  let payout = 0;

  if (win) { payout = amount * 2; user.gamesWon++; }
  else if (tie) { payout = amount; }

  if (payout > 0) addCredits(guildId, userId, payout, 'dice');
  saveEconomy(guildId, ec);

  const embed = gameEmbed(message, {
    title: `🎲 Dice — ${win ? 'You Win!' : tie ? 'Tie!' : 'You Lose'}`,
    description: `You rolled **${playerRoll}** | Bot rolled **${botRoll}**`,
    color: win ? GAME_COLORS.win : tie ? GAME_COLORS.info : GAME_COLORS.lose,
    fields: betFields(amount, payout, ec.currencyName),
    balance: user.wallet,
    currencyName: ec.currencyName,
  });
  return message.reply({ embeds: [embed] });
}

// ══════════════════════════════════════════════════════════
// BOMBS
// ══════════════════════════════════════════════════════════

async function handleBombs(message, args) {
  if (!isEconomyEnabled(message.guild.id)) return message.reply(err('Economy is not enabled.'));
  const guildId = message.guild.id;
  const userId = message.author.id;
  const user = getUserEconomy(guildId, userId);
  const ec = getEconomy(guildId);

  const amount = await validateBet(message, args, user, ',bombs <amount>');
  if (amount === null) return;

  user.gamesPlayed++;
  removeCredits(guildId, userId, amount, 'bombs_bet');
  saveEconomy(guildId, ec);

  const gridSize = 9;
  const bombCount = 2;
  const bombs = new Set();
  while (bombs.size < bombCount) bombs.add(Math.floor(Math.random() * gridSize));
  const revealed = new Set();
  let alive = true;

  const renderGrid = () => {
    let str = '';
    for (let i = 0; i < gridSize; i++) {
      if (i % 3 === 0 && i > 0) str += '\n';
      if (revealed.has(i)) {
        str += bombs.has(i) ? '💥 ' : '✅ ';
      } else {
        str += `\`${i + 1}\` `;
      }
    }
    return str;
  };

  const embed = gameEmbed(message, {
    title: '💣 Bombs',
    description: `${renderGrid()}\n\nPick a tile (1-9). **${bombCount}** bombs hidden.`,
    color: GAME_COLORS.play,
    fields: [{ name: '🎟️ Bet', value: `${formatNumber(amount)} ${ec.currencyName}`, inline: true }],
    balance: user.wallet,
    currencyName: ec.currencyName,
  });

  const msg = await message.reply({ embeds: [embed] });

  const collector = message.channel.createMessageCollector({
    filter: m => m.author.id === userId && !isNaN(parseInt(m.content)) && parseInt(m.content) >= 1 && parseInt(m.content) <= 9,
    time: 60000,
  });

  collector.on('collect', async m => {
    if (!alive) return;
    const num = parseInt(m.content) - 1;
    if (revealed.has(num)) return;
    revealed.add(num);

    if (bombs.has(num)) {
      alive = false;
      collector.stop();
      const loseEmbed = gameEmbed(message, {
        title: '💣 Bombs — BOOM!',
        description: `${renderGrid()}\n\nTile **${num + 1}** was a bomb!`,
        color: GAME_COLORS.lose,
        fields: betFields(amount, 0, ec.currencyName),
        balance: user.wallet,
        currencyName: ec.currencyName,
      });
      await msg.edit({ embeds: [loseEmbed] }).catch(() => {});
      return;
    }

    if (revealed.size === gridSize - bombCount) {
      alive = false;
      collector.stop();
      const win = amount * 3;
      addCredits(guildId, userId, win, 'bombs');
      user.gamesWon++;
      saveEconomy(guildId, ec);
      const winEmbed = gameEmbed(message, {
        title: '💣 Bombs — Cleared!',
        description: `${renderGrid()}\n\nAll safe tiles cleared! **3x** payout!`,
        color: GAME_COLORS.win,
        fields: betFields(amount, win, ec.currencyName),
        balance: user.wallet,
        currencyName: ec.currencyName,
      });
      await msg.edit({ embeds: [winEmbed] }).catch(() => {});
      return;
    }

    const updateEmbed = gameEmbed(message, {
      title: '💣 Bombs — Safe!',
      description: `${renderGrid()}\n\nPick another tile (1-9).`,
      color: GAME_COLORS.win,
      fields: [{ name: '🎟️ Bet', value: `${formatNumber(amount)} ${ec.currencyName}`, inline: true }],
      balance: user.wallet,
      currencyName: ec.currencyName,
    });
    await msg.edit({ embeds: [updateEmbed] }).catch(() => {});
  });

  collector.on('end', async () => {
    if (alive && revealed.size > 0) {
      const win = amount * 2;
      addCredits(guildId, userId, win, 'bombs_timeout');
      user.gamesWon++;
      saveEconomy(guildId, ec);
      const timeoutEmbed = gameEmbed(message, {
        title: '💣 Bombs — Auto Cash-Out',
        description: `${renderGrid()}\n\nTime ran out — auto cashed out at **2x**.`,
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
  handleSlots,
  handleBlackjack,
  handleMines,
  handleCrash,
  handleCoinflip,
  handleGamble,
  handleRoulette,
  handlePlinko,
  handleLadder,
  handleDice,
  handleBombs,
};