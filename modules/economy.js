// ══════════════════════════════════════════════════════════
// ECONOMY CORE MODULE — v2.0 Complete Rewrite
// ══════════════════════════════════════════════════════════

const { EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle, PermissionFlagsBits } = require('discord.js');
const { getGuildDb } = require('./database');
const { isAdmin, isBotOwner, hasDiscordPerm } = require('./helpers');
const { success: mkSuccess, error: mkError, info, ok, err, COLORS } = require('../utils/embeds');
const logger = require('../utils/logger');

// ══════════════════════════════════════════════════════════
// DEFAULTS
// ══════════════════════════════════════════════════════════

const DEFAULT_ECONOMY = {
  enabled: false,
  mode: 'guild',
  logChannelId: null,
  currencyName: 'Credits',
  currencySymbol: '💰',
  maxBalance: 999999999,
  dailyAmount: 500,
  workCooldown: 420000,
  crimeCooldown: 0,
  robCooldown: 0,
  users: {},
  jobs: [
    { name: 'Developer', min: 100, max: 500, description: 'Write code and fix bugs' },
    { name: 'Designer', min: 80, max: 400, description: 'Create beautiful graphics' },
    { name: 'Streamer', min: 120, max: 600, description: 'Entertain the masses' },
    { name: 'Trader', min: 150, max: 700, description: 'Buy low, sell high' },
    { name: 'Hacker', min: 200, max: 800, description: 'Break into systems (legally)' },
  ],
  shop: [],
  circulation: 0,
  logs: [],
  activeEvents: {},
  events: { enabled: true, autoInterval: 3600000 },
  eventMultipliers: { work: 2, daily: 2, crime: 2, casino: 2 },
  antiSpamWindow: 10000,
  antiSpamThreshold: 10,
  messageCooldown: 2000,
};

const PRESETS = {
  standard: { dailyAmount: 500, workCooldown: 420000, maxBalance: 999999999 },
  highroller: { dailyAmount: 2000, workCooldown: 300000, maxBalance: 9999999999 },
  casual: { dailyAmount: 300, workCooldown: 600000, maxBalance: 99999999 },
  casino: { dailyAmount: 1000, workCooldown: 180000, maxBalance: 999999999 },
};

// ══════════════════════════════════════════════════════════
// HELPERS
// ══════════════════════════════════════════════════════════

function getEconomy(guildId) {
  const db = getGuildDb(guildId);
  let ec = db.get('economy', null);
  if (!ec) {
    ec = JSON.parse(JSON.stringify(DEFAULT_ECONOMY));
    db.set('economy', ec);
  }
  for (const key of Object.keys(DEFAULT_ECONOMY)) {
    if (ec[key] === undefined) ec[key] = JSON.parse(JSON.stringify(DEFAULT_ECONOMY[key]));
  }
  if (!ec.users) ec.users = {};
  if (!ec.logs) ec.logs = [];
  if (!ec.shop) ec.shop = [];
  if (!ec.jobs) ec.jobs = JSON.parse(JSON.stringify(DEFAULT_ECONOMY.jobs));
  if (!ec.activeEvents) ec.activeEvents = {};
  return ec;
}

function saveEconomy(guildId, ec) {
  const db = getGuildDb(guildId);
  db.set('economy', ec);
}

function getUserEconomy(guildId, userId) {
  const ec = getEconomy(guildId);
  if (!ec.users[userId]) {
    ec.users[userId] = {
      wallet: 0,
      bank: 0,
      totalEarned: 0,
      totalSpent: 0,
      gamesPlayed: 0,
      gamesWon: 0,
      robAttempts: 0,
      robSuccess: 0,
      lastWork: 0,
      lastDaily: 0,
      lastCrime: 0,
      inventory: [],
      equipped: {},
      messageTracker: { lastContent: '', lastTime: 0, messageCount: 0, windowStart: 0 },
      suspiciousFlags: 0,
    };
    saveEconomy(guildId, ec);
  }
  return ec.users[userId];
}

function isEconomyEnabled(guildId) {
  const ec = getEconomy(guildId);
  return ec.enabled === true;
}

function formatNumber(n) {
  return n.toLocaleString('en-US');
}

function formatDuration(ms) {
  const s = Math.ceil(ms / 1000);
  const m = Math.floor(s / 60);
  const h = Math.floor(m / 60);
  const d = Math.floor(h / 24);
  if (d > 0) return `${d}d ${h % 24}h`;
  if (h > 0) return `${h}h ${m % 60}m`;
  if (m > 0) return `${m}m ${s % 60}s`;
  return `${s}s`;
}

function parseAmount(input, user, field = 'wallet') {
  if (!input) return null;
  const lower = input.toLowerCase().trim();
  if (lower === 'all') return user[field];
  if (lower === 'half') return Math.floor(user[field] / 2);
  if (lower === 'quarter') return Math.floor(user[field] / 4);
  const num = parseInt(lower.replace(/,/g, ''));
  if (isNaN(num) || num <= 0) return null;
  return num;
}

function makeEmbed(title, description, color, footer) {
  const embed = new EmbedBuilder()
    .setColor(color || '#5865F2')
    .setTitle(title)
    .setDescription(description);
  if (footer) embed.setFooter({ text: footer });
  return embed;
}

function addCredits(guildId, userId, amount, source) {
  const ec = getEconomy(guildId);
  const user = getUserEconomy(guildId, userId);
  const prev = user.wallet;
  user.wallet = Math.min(ec.maxBalance, Math.max(0, user.wallet + amount));
  const actual = user.wallet - prev;
  if (actual > 0) {
    user.totalEarned += actual;
    ec.circulation += actual;
  }
  saveEconomy(guildId, ec);
  logTransaction(guildId, userId, amount, source, prev, user.wallet);
  return actual;
}

function removeCredits(guildId, userId, amount, source) {
  const ec = getEconomy(guildId);
  const user = getUserEconomy(guildId, userId);
  const prev = user.wallet;
  user.wallet = Math.max(0, user.wallet - amount);
  const actual = prev - user.wallet;
  if (actual > 0) {
    user.totalSpent += actual;
    ec.circulation -= actual;
  }
  saveEconomy(guildId, ec);
  logTransaction(guildId, userId, -actual, source, prev, user.wallet);
  return actual;
}

function setCredits(guildId, userId, amount) {
  const ec = getEconomy(guildId);
  const user = getUserEconomy(guildId, userId);
  const prev = user.wallet;
  user.wallet = Math.max(0, Math.min(ec.maxBalance, amount));
  const diff = user.wallet - prev;
  if (diff > 0) { user.totalEarned += diff; ec.circulation += diff; }
  if (diff < 0) { user.totalSpent += -diff; ec.circulation += diff; }
  saveEconomy(guildId, ec);
  logTransaction(guildId, userId, diff, 'staff_set', prev, user.wallet);
  return user.wallet;
}

function logTransaction(guildId, userId, amount, type, prev, next) {
  const ec = getEconomy(guildId);
  ec.logs.push({ userId, amount, type, prev, next, timestamp: Date.now() });
  if (ec.logs.length > 5000) ec.logs = ec.logs.slice(-2500);
  saveEconomy(guildId, ec);
}

async function sendEconomyLog(client, guildId, embed) {
  const ec = getEconomy(guildId);
  if (!ec.logChannelId) return;
  try {
    const guild = client.guilds.cache.get(guildId);
    if (!guild) return;
    const ch = guild.channels.cache.get(ec.logChannelId);
    if (!ch) return;
    await ch.send({ embeds: [embed] });
  } catch {}
}

function getEventMultiplier(guildId, category) {
  const ec = getEconomy(guildId);
  if (!ec.activeEvents) return 1;
  let mult = 1;
  if (ec.activeEvents.doubleRewards && ['work','daily','crime'].includes(category)) mult = ec.eventMultipliers.work || 2;
  if (ec.activeEvents.payday && category === 'work') mult = ec.eventMultipliers.work || 2;
  if (ec.activeEvents.casinoHour && ['slots','blackjack','mines','crash','gamble','roulette','plinko','ladder','dice','bombs'].includes(category)) mult = ec.eventMultipliers.casino || 2;
  return mult;
}

function getActiveEventNames(guildId) {
  const ec = getEconomy(guildId);
  if (!ec.activeEvents) return [];
  const names = [];
  if (ec.activeEvents.doubleRewards) names.push('⚡ Double Rewards');
  if (ec.activeEvents.payday) names.push('💰 Payday');
  if (ec.activeEvents.casinoHour) names.push('🎰 Casino Hour');
  return names;
}

function trackEconomyMessage(guildId, userId, content, isCommand = false) {
  const ec = getEconomy(guildId);
  const user = getUserEconomy(guildId, userId);
  const now = Date.now();
  const tracker = user.messageTracker;
  if (now - tracker.lastTime < ec.messageCooldown) return { ok: false };
  if (content.trim().toLowerCase() === tracker.lastContent.toLowerCase()) return { ok: false };
  if (now - tracker.windowStart > ec.antiSpamWindow) {
    tracker.windowStart = now;
    tracker.messageCount = 0;
  }
  tracker.messageCount++;
  if (tracker.messageCount > ec.antiSpamThreshold) return { ok: false };
  tracker.lastContent = content;
  tracker.lastTime = now;
  saveEconomy(guildId, ec);
  return { ok: true };
}

function setCooldown(guildId, userId, key) {
  const ec = getEconomy(guildId);
  const user = ec.users[userId];
  if (user) user[`last${key.charAt(0).toUpperCase() + key.slice(1)}`] = Date.now();
  saveEconomy(guildId, ec);
}

function getDefaultShopItems() {
  return [];
}

function parseDuration(str) {
  if (!str) return null;
  const match = str.match(/^(\d+)([smhd])$/i);
  if (!match) return null;
  const num = parseInt(match[1]);
  const unit = match[2].toLowerCase();
  const mult = { s: 1000, m: 60000, h: 3600000, d: 86400000 };
  return num * (mult[unit] || 0);
}

// ══════════════════════════════════════════════════════════
// COMMANDS: CORE
// ══════════════════════════════════════════════════════════

async function handleBalance(message, args) {
  if (!isEconomyEnabled(message.guild.id)) return message.reply(err('Economy is not enabled. Staff can use `,economy enable`.'));
  const target = message.mentions.users.first() || message.author;
  const user = getUserEconomy(message.guild.id, target.id);
  const total = user.wallet + user.bank;

  const embed = makeEmbed(
    target.id === message.author.id ? 'Your Balance' : `${target.username}'s Balance`,
    `**Wallet:** ${formatNumber(user.wallet)}\n**Bank:** ${formatNumber(user.bank)}\n**Total:** ${formatNumber(total)}`,
    '#5865F2',
    'Use ,deposit or ,withdraw to move funds'
  );
  return message.reply({ embeds: [embed] });
}

async function handleDaily(message) {
  if (!isEconomyEnabled(message.guild.id)) return message.reply(err('Economy is not enabled.'));
  const guildId = message.guild.id;
  const userId = message.author.id;
  const user = getUserEconomy(guildId, userId);
  const ec = getEconomy(guildId);

  const remaining = (user.lastDaily || 0) + 86400000 - Date.now();
  if (remaining > 0) {
    return message.reply(err(`Daily reward already claimed. Come back in **${formatDuration(remaining)}**.`));
  }

  const mult = getEventMultiplier(guildId, 'daily');
  const reward = Math.round(ec.dailyAmount * mult);
  addCredits(guildId, userId, reward, 'daily');
  user.lastDaily = Date.now();
  saveEconomy(guildId, ec);

  const embed = makeEmbed('Daily Reward', `You received **+${formatNumber(reward)}** ${ec.currencyName}.\n\n**New Balance:** ${formatNumber(user.wallet)}`, '#57F287', mult > 1 ? 'Event Bonus Active' : null);
  return message.reply({ embeds: [embed] });
}

async function handleWork(message, args) {
  if (!isEconomyEnabled(message.guild.id)) return message.reply(err('Economy is not enabled.'));
  const guildId = message.guild.id;
  const userId = message.author.id;
  const user = getUserEconomy(guildId, userId);
  const ec = getEconomy(guildId);

  const remaining = (user.lastWork || 0) + ec.workCooldown - Date.now();
  if (remaining > 0) {
    return message.reply(err(`You're still on the clock. Come back in **${formatDuration(remaining)}**.`));
  }

  const jobName = args[0];
  let job = ec.jobs[Math.floor(Math.random() * ec.jobs.length)];
  if (jobName) {
    const found = ec.jobs.find(j => j.name.toLowerCase() === jobName.toLowerCase());
    if (found) job = found;
  }

  const mult = getEventMultiplier(guildId, 'work');
  const base = Math.floor(Math.random() * (job.max - job.min + 1)) + job.min;
  const reward = Math.round(base * mult);
  addCredits(guildId, userId, reward, 'work');
  user.lastWork = Date.now();
  saveEconomy(guildId, ec);

  const embed = makeEmbed('Work Complete', `**${job.name}** — ${job.description}\n\nYou earned **+${formatNumber(reward)}** ${ec.currencyName}.`, '#57F287', `Balance: ${formatNumber(user.wallet)}${mult > 1 ? ' • Bonus Active' : ''}`);
  return message.reply({ embeds: [embed] });
}

async function handleCrime(message) {
  if (!isEconomyEnabled(message.guild.id)) return message.reply(err('Economy is not enabled.'));
  const guildId = message.guild.id;
  const userId = message.author.id;
  const user = getUserEconomy(guildId, userId);
  const ec = getEconomy(guildId);

  const outcomes = [
    { text: 'You robbed a convenience store', min: 100, max: 500, success: true },
    { text: 'You hacked an ATM', min: 200, max: 800, success: true },
    { text: 'You pickpocketed a wealthy tourist', min: 50, max: 300, success: true },
    { text: 'You tried to rob a bank but got caught', min: 50, max: 200, success: false, fine: true },
    { text: 'You attempted fraud but failed', min: 0, max: 0, success: false },
    { text: 'You stole a wallet', min: 75, max: 400, success: true },
  ];

  const outcome = outcomes[Math.floor(Math.random() * outcomes.length)];
  const mult = getEventMultiplier(guildId, 'crime');

  if (outcome.success) {
    const reward = Math.round((Math.floor(Math.random() * (outcome.max - outcome.min + 1)) + outcome.min) * mult);
    addCredits(guildId, userId, reward, 'crime');
    saveEconomy(guildId, ec);
    const embed = makeEmbed('Crime Committed', `${outcome.text} and got away with **+${formatNumber(reward)}** ${ec.currencyName}.`, '#57F287', `Balance: ${formatNumber(user.wallet)}`);
    return message.reply({ embeds: [embed] });
  } else {
    let desc = outcome.text;
    if (outcome.fine) {
      const fine = Math.floor(Math.random() * 100) + 50;
      removeCredits(guildId, userId, fine, 'crime_fine');
      desc += ` and paid a **${formatNumber(fine)}** ${ec.currencyName} fine.`;
    } else {
      desc += ' and earned nothing.';
    }
    saveEconomy(guildId, ec);
    const embed = makeEmbed('Crime Failed', desc, '#ED4245', `Balance: ${formatNumber(user.wallet)}`);
    return message.reply({ embeds: [embed] });
  }
}

async function handleOpen(message) {
  if (!isEconomyEnabled(message.guild.id)) return message.reply(err('Economy is not enabled.'));
  const guildId = message.guild.id;
  const userId = message.author.id;
  const user = getUserEconomy(guildId, userId);
  const ec = getEconomy(guildId);

  const rewards = [
    { type: 'credits', min: 50, max: 300, weight: 50 },
    { type: 'credits', min: 300, max: 800, weight: 20 },
    { type: 'credits', min: 800, max: 2000, weight: 5 },
    { type: 'nothing', weight: 25 },
  ];

  const totalWeight = rewards.reduce((a, b) => a + b.weight, 0);
  let rand = Math.random() * totalWeight;
  let reward = rewards[0];
  for (const r of rewards) {
    rand -= r.weight;
    if (rand <= 0) { reward = r; break; }
  }

  if (reward.type === 'nothing') {
    const embed = makeEmbed('Crate Opened', 'You opened the crate but it was empty.', '#2F3136', 'Better luck next time');
    return message.reply({ embeds: [embed] });
  }

  const amount = Math.floor(Math.random() * (reward.max - reward.min + 1)) + reward.min;
  addCredits(guildId, userId, amount, 'crate');
  saveEconomy(guildId, ec);
  const embed = makeEmbed('Crate Opened', `You found **+${formatNumber(amount)}** ${ec.currencyName} inside!`, '#57F287', `Balance: ${formatNumber(user.wallet)}`);
  return message.reply({ embeds: [embed] });
}

// ══════════════════════════════════════════════════════════
// COMMANDS: BANKING
// ══════════════════════════════════════════════════════════

async function handleDeposit(message, args) {
  if (!isEconomyEnabled(message.guild.id)) return message.reply(err('Economy is not enabled.'));
  const guildId = message.guild.id;
  const userId = message.author.id;
  const user = getUserEconomy(guildId, userId);
  const ec = getEconomy(guildId);

  const amount = parseAmount(args[0], user, 'wallet');
  if (amount === null) return message.reply(err('Usage: `,deposit <amount | all | half | quarter>`'));
  if (amount <= 0) return message.reply(err('Amount must be greater than 0.'));
  if (user.wallet < amount) return message.reply(err(`You only have **${formatNumber(user.wallet)}** in your wallet.`));

  user.wallet -= amount;
  user.bank += amount;
  saveEconomy(guildId, ec);

  const embed = makeEmbed('Deposit Successful', `**+${formatNumber(amount)}** ${ec.currencyName} moved to your bank.`, '#57F287', `Wallet: ${formatNumber(user.wallet)} | Bank: ${formatNumber(user.bank)}`);
  return message.reply({ embeds: [embed] });
}

async function handleWithdraw(message, args) {
  if (!isEconomyEnabled(message.guild.id)) return message.reply(err('Economy is not enabled.'));
  const guildId = message.guild.id;
  const userId = message.author.id;
  const user = getUserEconomy(guildId, userId);
  const ec = getEconomy(guildId);

  const amount = parseAmount(args[0], user, 'bank');
  if (amount === null) return message.reply(err('Usage: `,withdraw <amount | all | half | quarter>`'));
  if (amount <= 0) return message.reply(err('Amount must be greater than 0.'));
  if (user.bank < amount) return message.reply(err(`You only have **${formatNumber(user.bank)}** in your bank.`));

  user.bank -= amount;
  user.wallet += amount;
  saveEconomy(guildId, ec);

  const embed = makeEmbed('Withdrawal Successful', `**+${formatNumber(amount)}** ${ec.currencyName} moved to your wallet.`, '#57F287', `Wallet: ${formatNumber(user.wallet)} | Bank: ${formatNumber(user.bank)}`);
  return message.reply({ embeds: [embed] });
}

async function handleTransfer(message, args) {
  if (!isEconomyEnabled(message.guild.id)) return message.reply(err('Economy is not enabled.'));
  const guildId = message.guild.id;
  const userId = message.author.id;
  const user = getUserEconomy(guildId, userId);
  const ec = getEconomy(guildId);

  const target = message.mentions.users.first();
  if (!target) return message.reply(err('Mention a user: `,transfer @user <amount>`'));
  if (target.id === userId) return message.reply(err('You cannot transfer to yourself.'));

  const amount = parseAmount(args[1], user, 'wallet');
  if (amount === null) return message.reply(err('Usage: `,transfer @user <amount | all | half | quarter>`'));
  if (amount <= 0) return message.reply(err('Amount must be greater than 0.'));
  if (user.wallet < amount) return message.reply(err(`You only have **${formatNumber(user.wallet)}** in your wallet.`));

  const targetUser = getUserEconomy(guildId, target.id);
  user.wallet -= amount;
  targetUser.wallet += amount;
  saveEconomy(guildId, ec);

  const embed = makeEmbed('Transfer Complete', `You sent **${formatNumber(amount)}** ${ec.currencyName} to **${target.username}**.`, '#57F287', `Wallet: ${formatNumber(user.wallet)}`);
  return message.reply({ embeds: [embed] });
}

// ══════════════════════════════════════════════════════════
// COMMANDS: INFO
// ══════════════════════════════════════════════════════════

async function handleCirculation(message) {
  if (!isEconomyEnabled(message.guild.id)) return message.reply(err('Economy is not enabled.'));
  const ec = getEconomy(message.guild.id);
  const userCount = Object.keys(ec.users).length;
  const totalWallet = Object.values(ec.users).reduce((a, u) => a + (u.wallet || 0), 0);
  const totalBank = Object.values(ec.users).reduce((a, u) => a + (u.bank || 0), 0);
  const total = totalWallet + totalBank;

  const embed = makeEmbed('Economy Circulation', `**Total Users:** ${formatNumber(userCount)}\n**Wallet Total:** ${formatNumber(totalWallet)}\n**Bank Total:** ${formatNumber(totalBank)}\n**Combined:** ${formatNumber(total)} ${ec.currencyName}`, '#5865F2', 'Real-time statistics');
  return message.reply({ embeds: [embed] });
}

async function handleLeaderboard(message, args, client) {
  if (!isEconomyEnabled(message.guild.id)) return message.reply(err('Economy is not enabled.'));
  const guildId = message.guild.id;
  const ec = getEconomy(guildId);
  const users = Object.entries(ec.users)
    .map(([id, u]) => ({ id, total: (u.wallet || 0) + (u.bank || 0) }))
    .filter(u => u.total > 0)
    .sort((a, b) => b.total - a.total);

  const pageSize = 10;
  const totalPages = Math.max(1, Math.ceil(users.length / pageSize));
  let page = parseInt(args[0]) || 1;
  if (page < 1) page = 1;
  if (page > totalPages) page = totalPages;

  const start = (page - 1) * pageSize;
  const pageUsers = users.slice(start, start + pageSize);

  let desc = '';
  for (let i = 0; i < pageUsers.length; i++) {
    const u = pageUsers[i];
    const rank = start + i + 1;
    const medal = rank === 1 ? '🥇' : rank === 2 ? '🥈' : rank === 3 ? '🥉' : `${rank}.`;
    const member = await message.guild.members.fetch(u.id).catch(() => null);
    const name = member ? member.user.username : 'Unknown';
    desc += `${medal} **${name}** — ${formatNumber(u.total)} ${ec.currencyName}\n`;
  }

  const embed = makeEmbed('Economy Leaderboard', desc || 'No economy data yet.', '#FFD700', `Page ${page}/${totalPages}`);
  const row = new ActionRowBuilder();
  if (page > 1) row.addComponents(new ButtonBuilder().setCustomId(`ecolb_${page - 1}`).setLabel('◀').setStyle(ButtonStyle.Primary));
  if (page < totalPages) row.addComponents(new ButtonBuilder().setCustomId(`ecolb_${page + 1}`).setLabel('▶').setStyle(ButtonStyle.Primary));
  return message.reply({ embeds: [embed], components: row.components.length ? [row] : [] });
}

async function handleProfile(message, args, client) {
  if (!isEconomyEnabled(message.guild.id)) return message.reply(err('Economy is not enabled.'));
  const target = message.mentions.users.first() || message.author;
  const guildId = message.guild.id;
  const user = getUserEconomy(guildId, target.id);
  const total = user.wallet + user.bank;

  const embed = makeEmbed(`${target.username}'s Profile`, `**Wallet:** ${formatNumber(user.wallet)}\n**Bank:** ${formatNumber(user.bank)}\n**Total:** ${formatNumber(total)}\n**Earned:** ${formatNumber(user.totalEarned)}\n**Spent:** ${formatNumber(user.totalSpent)}\n**Games Played:** ${formatNumber(user.gamesPlayed)}\n**Games Won:** ${formatNumber(user.gamesWon)}`, '#5865F2', 'Economy Profile');
  return message.reply({ embeds: [embed] });
}

// ══════════════════════════════════════════════════════════
// COMMANDS: JOBS
// ══════════════════════════════════════════════════════════

async function handleJobAdd(message, args) {
  if (!hasDiscordPerm(message.member, 'ManageGuild')) return message.reply(err('You need **Manage Server** permission.'));
  const guildId = message.guild.id;
  const ec = getEconomy(guildId);

  const name = args[0];
  const min = parseInt(args[1]);
  const max = parseInt(args[2]);
  const description = args.slice(3).join(' ') || 'No description';

  if (!name || isNaN(min) || isNaN(max)) {
    return message.reply(err('Usage: `,job add <name> <min payout> <max payout> [description]`'));
  }

  ec.jobs.push({ name, min, max, description });
  saveEconomy(guildId, ec);
  return message.reply(ok(`Added job **${name}** (${min}-${max} ${ec.currencyName}).`));
}

async function handleJobRemove(message, args) {
  if (!hasDiscordPerm(message.member, 'ManageGuild')) return message.reply(err('You need **Manage Server** permission.'));
  const guildId = message.guild.id;
  const ec = getEconomy(guildId);
  const name = args.join(' ');
  if (!name) return message.reply(err('Usage: `,job remove <name>`'));

  const idx = ec.jobs.findIndex(j => j.name.toLowerCase() === name.toLowerCase());
  if (idx === -1) return message.reply(err(`Job **${name}** not found.`));

  ec.jobs.splice(idx, 1);
  saveEconomy(guildId, ec);
  return message.reply(ok(`Removed job **${name}**.`));
}

// ══════════════════════════════════════════════════════════
// COMMANDS: ADMIN
// ══════════════════════════════════════════════════════════

async function handleEconomyConfig(message, args) {
  if (!hasDiscordPerm(message.member, 'ManageGuild')) {
    return message.reply(err('You need **Manage Server** permission.'));
  }

  const guildId = message.guild.id;
  const ec = getEconomy(guildId);
  const sub = args[0]?.toLowerCase();

  if (sub === 'enable') {
    ec.enabled = true;
    saveEconomy(guildId, ec);
    return message.reply(ok('Economy system **enabled**.'));
  }

  if (sub === 'disable') {
    ec.enabled = false;
    saveEconomy(guildId, ec);
    return message.reply(ok('Economy system **disabled**.'));
  }

  if (sub === 'preset') {
    const preset = args[1]?.toLowerCase();
    if (!preset || !PRESETS[preset]) {
      return message.reply(err(`Valid presets: ${Object.keys(PRESETS).join(', ')}`));
    }
    Object.assign(ec, PRESETS[preset]);
    saveEconomy(guildId, ec);
    return message.reply(ok(`Applied **${preset}** preset.`));
  }

  if (sub === 'reset') {
    const target = message.mentions.users.first() || (args[1]?.match(/^\d+$/) ? await message.client.users.fetch(args[1]).catch(() => null) : null);
    if (!target) return message.reply(err('Usage: `,economy reset @user`'));
    delete ec.users[target.id];
    saveEconomy(guildId, ec);
    return message.reply(ok(`Reset **${target.username}**'s economy data.`));
  }

  if (sub === 'config') {
    const embed = makeEmbed('Economy Configuration',
      `**Status:** ${ec.enabled ? 'Enabled' : 'Disabled'}\n**Mode:** ${ec.mode}\n**Daily:** ${formatNumber(ec.dailyAmount)}\n**Work Cooldown:** ${formatDuration(ec.workCooldown)}\n**Max Balance:** ${formatNumber(ec.maxBalance)}\n**Jobs:** ${ec.jobs.length}\n**Shop Items:** ${ec.shop.length}`,
      '#5865F2', 'Use ,economy enable/disable to toggle');
    return message.reply({ embeds: [embed] });
  }

  if (sub === 'mode') {
    const mode = args[1]?.toLowerCase();
    if (!mode || !['guild', 'global'].includes(mode)) {
      return message.reply(err('Usage: `,economy mode <guild | global>`'));
    }
    ec.mode = mode;
    saveEconomy(guildId, ec);
    return message.reply(ok(`Economy mode set to **${mode}**.`));
  }

  if (sub === 'leaderboard') {
    return handleLeaderboard(message, args.slice(1), message.client);
  }

  return message.reply(info('Economy Admin', `
\`,economy enable\` — Enable economy
\`,economy disable\` — Disable economy
\`,economy preset <name>\` — Apply preset
\`,economy reset @user\` — Reset user data
\`,economy config\` — View configuration
\`,economy mode <guild | global>\` — Switch mode
\`,economy leaderboard\` — View leaderboard
`));
}

async function handleGive(message, args) {
  if (!hasDiscordPerm(message.member, 'Administrator')) return message.reply(err('You need **Administrator** permission.'));
  const target = message.mentions.users.first() || (args[0]?.match(/^\d+$/) ? await message.client.users.fetch(args[0]).catch(() => null) : null);
  const amount = parseInt(args[1]);
  if (!target || isNaN(amount) || amount <= 0) return message.reply(err('Usage: `,give @user <amount>`'));

  const guildId = message.guild.id;
  if (!isEconomyEnabled(guildId)) return message.reply(err('Economy is not enabled.'));

  addCredits(guildId, target.id, amount, 'admin_give');
  const user = getUserEconomy(guildId, target.id);
  return message.reply(ok(`Gave **+${formatNumber(amount)}** to **${target.username}**. New balance: **${formatNumber(user.wallet)}**`));
}

async function handleTake(message, args) {
  if (!hasDiscordPerm(message.member, 'Administrator')) return message.reply(err('You need **Administrator** permission.'));
  const target = message.mentions.users.first() || (args[0]?.match(/^\d+$/) ? await message.client.users.fetch(args[0]).catch(() => null) : null);
  const amount = parseInt(args[1]);
  if (!target || isNaN(amount) || amount <= 0) return message.reply(err('Usage: `,take @user <amount>`'));

  const guildId = message.guild.id;
  if (!isEconomyEnabled(guildId)) return message.reply(err('Economy is not enabled.'));

  removeCredits(guildId, target.id, amount, 'admin_take');
  const user = getUserEconomy(guildId, target.id);
  return message.reply(ok(`Took **-${formatNumber(amount)}** from **${target.username}**. New balance: **${formatNumber(user.wallet)}**`));
}

async function handleReset(message, args) {
  if (!hasDiscordPerm(message.member, 'Administrator')) return message.reply(err('You need **Administrator** permission.'));
  const target = message.mentions.users.first() || (args[0]?.match(/^\d+$/) ? await message.client.users.fetch(args[0]).catch(() => null) : null);
  if (!target) return message.reply(err('Usage: `,reset @user`'));

  const guildId = message.guild.id;
  if (!isEconomyEnabled(guildId)) return message.reply(err('Economy is not enabled.'));

  const ec = getEconomy(guildId);
  delete ec.users[target.id];
  saveEconomy(guildId, ec);
  return message.reply(ok(`Reset **${target.username}**'s economy data.`));
}

async function handleDestroy(message, args) {
  if (!hasDiscordPerm(message.member, 'Administrator')) return message.reply(err('You need **Administrator** permission.'));
  const amount = parseInt(args[0]);
  if (isNaN(amount) || amount <= 0) return message.reply(err('Usage: `,destroy <amount>`'));

  const guildId = message.guild.id;
  const ec = getEconomy(guildId);
  ec.circulation = Math.max(0, ec.circulation - amount);
  saveEconomy(guildId, ec);
  return message.reply(ok(`Destroyed **${formatNumber(amount)}** ${ec.currencyName} from circulation.`));
}

// Legacy admin commands (for compatibility)
async function handleAddCredits(message, args) {
  return handleGive(message, args);
}
async function handleRemoveCredits(message, args) {
  return handleTake(message, args);
}
async function handleSetCredits(message, args) {
  if (!hasDiscordPerm(message.member, 'Administrator')) return message.reply(err('You need **Administrator** permission.'));
  const target = message.mentions.users.first() || (args[0]?.match(/^\d+$/) ? await message.client.users.fetch(args[0]).catch(() => null) : null);
  const amount = parseInt(args[1]);
  if (!target || isNaN(amount) || amount < 0) return message.reply(err('Usage: `,setcredits @user <amount>`'));

  const guildId = message.guild.id;
  setCredits(guildId, target.id, amount);
  const user = getUserEconomy(guildId, target.id);
  return message.reply(ok(`Set **${target.username}**'s balance to **${formatNumber(user.wallet)}**`));
}
async function handleResetUser(message, args) {
  return handleReset(message, args);
}

// ══════════════════════════════════════════════════════════
// BUTTON HANDLERS
// ══════════════════════════════════════════════════════════

async function handleEconomyButton(interaction) {
  const id = interaction.customId;
  if (id.startsWith('ecolb_')) {
    const page = parseInt(id.replace('ecolb_', ''));
    const guildId = interaction.guild.id;
    const ec = getEconomy(guildId);
    const users = Object.entries(ec.users)
      .map(([uid, u]) => ({ id: uid, total: (u.wallet || 0) + (u.bank || 0) }))
      .filter(u => u.total > 0)
      .sort((a, b) => b.total - a.total);
    const pageSize = 10;
    const totalPages = Math.max(1, Math.ceil(users.length / pageSize));
    const start = (page - 1) * pageSize;
    const pageUsers = users.slice(start, start + pageSize);

    let desc = '';
    for (let i = 0; i < pageUsers.length; i++) {
      const u = pageUsers[i];
      const rank = start + i + 1;
      const medal = rank === 1 ? '🥇' : rank === 2 ? '🥈' : rank === 3 ? '🥉' : `${rank}.`;
      const member = await interaction.guild.members.fetch(u.id).catch(() => null);
      const name = member ? member.user.username : 'Unknown';
      desc += `${medal} **${name}** — ${formatNumber(u.total)} ${ec.currencyName}\n`;
    }

    const embed = makeEmbed('Economy Leaderboard', desc || 'No data.', '#FFD700', `Page ${page}/${totalPages}`);
    const row = new ActionRowBuilder();
    if (page > 1) row.addComponents(new ButtonBuilder().setCustomId(`ecolb_${page - 1}`).setLabel('◀').setStyle(ButtonStyle.Primary));
    if (page < totalPages) row.addComponents(new ButtonBuilder().setCustomId(`ecolb_${page + 1}`).setLabel('▶').setStyle(ButtonStyle.Primary));
    return interaction.update({ embeds: [embed], components: row.components.length ? [row] : [] });
  }
}

// ══════════════════════════════════════════════════════════
// EXPORTS
// ══════════════════════════════════════════════════════════

module.exports = {
  getEconomy, saveEconomy, getUserEconomy, isEconomyEnabled,
  addCredits, removeCredits, setCredits, logTransaction, sendEconomyLog,
  formatNumber, formatDuration, getEventMultiplier, getActiveEventNames,
  trackEconomyMessage, setCooldown, getDefaultShopItems, parseDuration,
  parseAmount, makeEmbed,
  // Core
  handleBalance, handleDaily, handleWork, handleCrime, handleOpen,
  // Banking
  handleDeposit, handleWithdraw, handleTransfer,
  // Info
  handleCirculation, handleLeaderboard, handleProfile,
  // Jobs
  handleJobAdd, handleJobRemove,
  // Admin
  handleEconomyConfig, handleGive, handleTake, handleReset, handleDestroy,
  handleAddCredits, handleRemoveCredits, handleSetCredits, handleResetUser,
  // Buttons
  handleEconomyButton,
};