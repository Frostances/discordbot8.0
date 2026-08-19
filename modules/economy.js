// ══════════════════════════════════════════════════════════
// ECONOMY CORE MODULE — v3.0 (Anti-Cheat + Global Mode)
// ══════════════════════════════════════════════════════════

const { EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle, PermissionFlagsBits } = require('discord.js');
const { getGuildDb } = require('./database');
const { isAdmin, isBotOwner, hasDiscordPerm } = require('./helpers');
const { success: mkSuccess, error: mkError, info, ok, err, COLORS } = require('../utils/embeds');
const { isModuleEnabled } = require('./moduleSystem');
const logger = require('../utils/logger');

// ══════════════════════════════════════════════════════════
// HARDCODED SETTINGS — Edit these in the file ONLY
// ══════════════════════════════════════════════════════════

const HARDCODED = {
 DAILY_AMOUNT: 500,
 WORK_COOLDOWN: 7 * 60 * 1000,    // 7 minutes
 CRIME_COOLDOWN: 10 * 60 * 1000,   // 10 minutes
 ROB_COOLDOWN: 15 * 60 * 1000,     // 15 minutes
 OPEN_COOLDOWN: 5 * 60 * 1000,     // 5 minutes
 DAILY_COOLDOWN: 24 * 60 * 60 * 1000, // 24 hours
};

const DEFAULT_JOBS = [
 { name: 'Developer', min: 100, max: 500, description: 'Write code and fix bugs' },
 { name: 'Designer', min: 80, max: 400, description: 'Create beautiful graphics' },
 { name: 'Streamer', min: 120, max: 600, description: 'Entertain the masses' },
 { name: 'Trader', min: 150, max: 700, description: 'Buy low, sell high' },
 { name: 'Hacker', min: 200, max: 800, description: 'Break into systems (legally)' },
];

// ══════════════════════════════════════════════════════════
// DEFAULTS
// ══════════════════════════════════════════════════════════

const DEFAULT_ECONOMY = {
 enabled: false,
 mode: 'guild',
 logChannelId: null,
 currencyName: 'Credits',
 currencySymbol: '💰',
 users: {},
 jobs: JSON.parse(JSON.stringify(DEFAULT_JOBS)),
 shop: [],
 circulation: 0,
 logs: [],
 activeEvents: {},
 events: { enabled: true, autoInterval: 3600000, channelId: null },
 eventMultipliers: { work: 2, daily: 2, crime: 2, casino: 2 },
 antiSpamWindow: 10000,
 antiSpamThreshold: 10,
 messageCooldown: 2000,
 economyAdmins: [],
};

// ══════════════════════════════════════════════════════════
// HELPERS
// ══════════════════════════════════════════════════════════

function getEconomy(guildId) {
 const db = getGuildDb(guildId);
 let ec = db.get('economy', null);
 if (!ec || typeof ec !== 'object' || Array.isArray(ec)) {
 ec = JSON.parse(JSON.stringify(DEFAULT_ECONOMY));
 db.set('economy', ec);
 }
 for (const key of Object.keys(DEFAULT_ECONOMY)) {
 if (ec[key] === undefined) ec[key] = JSON.parse(JSON.stringify(DEFAULT_ECONOMY[key]));
 }
 if (!ec.users || typeof ec.users !== 'object') ec.users = {};
 if (!ec.logs || !Array.isArray(ec.logs)) ec.logs = [];
 if (!ec.shop || !Array.isArray(ec.shop)) ec.shop = [];
 if (!ec.jobs || !Array.isArray(ec.jobs)) ec.jobs = JSON.parse(JSON.stringify(DEFAULT_ECONOMY.jobs));
 if (!ec.activeEvents || typeof ec.activeEvents !== 'object') ec.activeEvents = {};
 if (ec.events && ec.events.channelId === undefined) ec.events.channelId = null;
 if (!Array.isArray(ec.economyAdmins)) ec.economyAdmins = [];
 return ec;
}

function saveEconomy(guildId, ec) {
 const db = getGuildDb(guildId);
 db.set('economy', ec);
}

// ── Global Store ──
function getGlobalStore() {
 const db = getGuildDb('global-economy');
 let store = db.get('economy', null);
 if (!store || typeof store !== 'object' || Array.isArray(store)) {
 store = { users: {}, circulation: 0, logs: [] };
 db.set('economy', store);
 }
 if (!store.users) store.users = {};
 if (typeof store.circulation !== 'number') store.circulation = 0;
 if (!store.logs) store.logs = [];
 return store;
}

function saveGlobalStore(store) {
 const db = getGuildDb('global-economy');
 db.set('economy', store);
}

// ── Unified Store Access ──
function getStore(guildId) {
 const ec = getEconomy(guildId);
 if (ec.mode === 'global') return getGlobalStore();
 return ec;
}

function saveStore(guildId, store) {
 const ec = getEconomy(guildId);
 if (ec.mode === 'global') saveGlobalStore(store);
 else saveEconomy(guildId, store);
}

function isGlobalMode(guildId) {
 return getEconomy(guildId).mode === 'global';
}

// ── User Data ──
function getUserEconomy(guildId, userId) {
 const store = getStore(guildId);
 const defaults = {
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
 lastRob: 0,
 lastOpen: 0,
 inventory: [],
 equipped: {},
 messageTracker: { lastContent: '', lastTime: 0, messageCount: 0, windowStart: 0 },
 suspiciousFlags: 0,
 };

 if (!store.users[userId]) {
 store.users[userId] = JSON.parse(JSON.stringify(defaults));
 saveStore(guildId, store);
 } else {
 let changed = false;
 for (const [key, val] of Object.entries(defaults)) {
 if (store.users[userId][key] === undefined || store.users[userId][key] === null) {
 store.users[userId][key] = JSON.parse(JSON.stringify(val));
 changed = true;
 }
 }
 if (changed) saveStore(guildId, store);
 }
 return store.users[userId];
}

function isEconomyEnabled(guildId) {
 if (!isModuleEnabled(guildId, 'economy')) return false;
 const ec = getEconomy(guildId);
 return ec.enabled === true;
}

function formatNumber(n) {
 if (n === null || n === undefined || Number.isNaN(n)) return '0';
 return Number(n).toLocaleString('en-US');
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

// ── Permissions ──
function isEconomyOwner(member) {
 if (isBotOwner(member.user.id)) return true;
 if (member.guild.ownerId === member.id) return true;
 return false;
}

function canManageEconomy(member, guildId) {
 if (isBotOwner(member.user.id)) return true;
 if (member.guild.ownerId === member.id) return true;
 if (hasDiscordPerm(member, 'ManageGuild')) return true;
 const ec = getEconomy(guildId);
 if (Array.isArray(ec.economyAdmins) && ec.economyAdmins.includes(member.id)) return true;
 return false;
}

// ── Credits ──
function addCredits(guildId, userId, amount, source) {
 const store = getStore(guildId);
 const user = getUserEconomy(guildId, userId);
 const prev = user.wallet;
 user.wallet = Math.max(0, user.wallet + amount);
 const actual = user.wallet - prev;
 if (actual > 0) {
 user.totalEarned += actual;
 store.circulation = (store.circulation || 0) + actual;
 }
 saveStore(guildId, store);
 return actual;
}

function removeCredits(guildId, userId, amount, source) {
 const store = getStore(guildId);
 const user = getUserEconomy(guildId, userId);
 const prev = user.wallet;
 user.wallet = Math.max(0, user.wallet - amount);
 const actual = prev - user.wallet;
 if (actual > 0) {
 user.totalSpent += actual;
 store.circulation = (store.circulation || 0) - actual;
 }
 saveStore(guildId, store);
 return actual;
}

function setCredits(guildId, userId, amount) {
 const store = getStore(guildId);
 const user = getUserEconomy(guildId, userId);
 const prev = user.wallet;
 user.wallet = Math.max(0, amount);
 const diff = user.wallet - prev;
 if (diff > 0) { user.totalEarned += diff; store.circulation = (store.circulation || 0) + diff; }
 if (diff < 0) { user.totalSpent += -diff; store.circulation = (store.circulation || 0) + diff; }
 saveStore(guildId, store);
 return user.wallet;
}

// ── Cooldowns ──
function checkCooldown(user, type) {
 const map = {
 work: HARDCODED.WORK_COOLDOWN,
 crime: HARDCODED.CRIME_COOLDOWN,
 rob: HARDCODED.ROB_COOLDOWN,
 open: HARDCODED.OPEN_COOLDOWN,
 daily: HARDCODED.DAILY_COOLDOWN,
 };
 const cooldownMs = map[type];
 if (!cooldownMs) return { onCooldown: false, remaining: 0 };
 const lastKey = `last${type.charAt(0).toUpperCase() + type.slice(1)}`;
 const remaining = (user[lastKey] || 0) + cooldownMs - Date.now();
 if (remaining > 0) return { onCooldown: true, remaining };
 return { onCooldown: false, remaining: 0 };
}

function setCooldown(guildId, userId, type) {
 const store = getStore(guildId);
 const user = getUserEconomy(guildId, userId);
 const lastKey = `last${type.charAt(0).toUpperCase() + type.slice(1)}`;
 user[lastKey] = Date.now();
 saveStore(guildId, store);
}

// ── Events ──
function getEventMultiplier(guildId, category) {
 const ec = getEconomy(guildId);
 if (!ec.activeEvents) return 1;
 let mult = 1;
 if (ec.activeEvents.doubleRewards && ['work','daily','crime'].includes(category)) mult = ec.eventMultipliers.work || 2;
 if (ec.activeEvents.payday && category === 'work') mult = ec.eventMultipliers.work || 2;
 if (ec.activeEvents.casinoHour && ['slots','blackjack','mines','crash','gamble','roulette','plinko','ladder','dice'].includes(category)) mult = ec.eventMultipliers.casino || 2;
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

// ── Jobs ──
function getJobs(guildId) {
 const ec = getEconomy(guildId);
 if (ec.mode === 'global') return DEFAULT_JOBS;
 return ec.jobs || DEFAULT_JOBS;
}

// ══════════════════════════════════════════════════════════
// TRACKING & LOGGING
// ══════════════════════════════════════════════════════════

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
 const ec = getEconomy(message.guild.id);

 const embed = makeEmbed(
 target.id === message.author.id ? '💼 Your Balance' : `💼 ${target.username}'s Balance`,
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

 const cd = checkCooldown(user, 'daily');
 if (cd.onCooldown) {
 return message.reply(err(`Daily reward already claimed. Come back in **${formatDuration(cd.remaining)}**.`));
 }

 const mult = getEventMultiplier(guildId, 'daily');
 const reward = Math.round(HARDCODED.DAILY_AMOUNT * mult);
 addCredits(guildId, userId, reward, 'daily');
 setCooldown(guildId, userId, 'daily');

 const ec = getEconomy(guildId);
 const embed = makeEmbed('🎁 Daily Reward', `You received **+${formatNumber(reward)}** ${ec.currencyName}.\n\n**New Balance:** ${formatNumber(user.wallet)}`, '#57F287', mult > 1 ? 'Event Bonus Active' : null);
 return message.reply({ embeds: [embed] });
}

async function handleWork(message, args) {
 if (!isEconomyEnabled(message.guild.id)) return message.reply(err('Economy is not enabled.'));
 const guildId = message.guild.id;
 const userId = message.author.id;
 const user = getUserEconomy(guildId, userId);

 const cd = checkCooldown(user, 'work');
 if (cd.onCooldown) {
 return message.reply(err(`You're still on the clock. Come back in **${formatDuration(cd.remaining)}**.`));
 }

 const jobs = getJobs(guildId);
 const jobName = args[0];
 let job = jobs[Math.floor(Math.random() * jobs.length)];
 if (jobName) {
 const found = jobs.find(j => j.name.toLowerCase() === jobName.toLowerCase());
 if (found) job = found;
 }

 const mult = getEventMultiplier(guildId, 'work');
 const base = Math.floor(Math.random() * (job.max - job.min + 1)) + job.min;
 const reward = Math.round(base * mult);
 addCredits(guildId, userId, reward, 'work');
 setCooldown(guildId, userId, 'work');

 const ec = getEconomy(guildId);
 const embed = makeEmbed('💼 Work Complete', `**${job.name}** — ${job.description}\n\nYou earned **+${formatNumber(reward)}** ${ec.currencyName}.`, '#57F287', `Balance: ${formatNumber(user.wallet)}${mult > 1 ? ' • Bonus Active' : ''}`);
 return message.reply({ embeds: [embed] });
}

async function handleCrime(message) {
 if (!isEconomyEnabled(message.guild.id)) return message.reply(err('Economy is not enabled.'));
 const guildId = message.guild.id;
 const userId = message.author.id;
 const user = getUserEconomy(guildId, userId);

 const cd = checkCooldown(user, 'crime');
 if (cd.onCooldown) {
 return message.reply(err(`You're laying low after your last job. Come back in **${formatDuration(cd.remaining)}**.`));
 }
 setCooldown(guildId, userId, 'crime');

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
 const ec = getEconomy(guildId);

 if (outcome.success) {
 const reward = Math.round((Math.floor(Math.random() * (outcome.max - outcome.min + 1)) + outcome.min) * mult);
 addCredits(guildId, userId, reward, 'crime');
 const embed = makeEmbed('🥷 Crime Committed', `${outcome.text} and got away with **+${formatNumber(reward)}** ${ec.currencyName}.`, '#57F287', `Balance: ${formatNumber(user.wallet)}`);
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
 const embed = makeEmbed('🚨 Crime Failed', desc, '#ED4245', `Balance: ${formatNumber(user.wallet)}`);
 return message.reply({ embeds: [embed] });
 }
}

async function handleRob(message, args) {
 if (!isEconomyEnabled(message.guild.id)) return message.reply(err('Economy is not enabled.'));
 const guildId = message.guild.id;
 const userId = message.author.id;
 const user = getUserEconomy(guildId, userId);

 const cd = checkCooldown(user, 'rob');
 if (cd.onCooldown) {
 return message.reply(err(`You're too hot right now. Come back in **${formatDuration(cd.remaining)}**.`));
 }

 const target = message.mentions.users.first();
 if (!target || target.id === userId || target.bot) {
 return message.reply(err('Mention a valid user to rob: `,rob @user`'));
 }

 const targetUser = getUserEconomy(guildId, target.id);
 if (targetUser.wallet <= 0) {
 return message.reply(err(`**${target.username}** has nothing in their wallet to rob.`));
 }

 setCooldown(guildId, userId, 'rob');
 user.robAttempts++;

 const success = Math.random() < 0.4;
 if (success) {
 const stealAmount = Math.floor(Math.random() * Math.min(targetUser.wallet, 500)) + 50;
 const mult = getEventMultiplier(guildId, 'crime');
 const finalSteal = Math.round(stealAmount * mult);
 targetUser.wallet -= finalSteal;
 user.wallet += finalSteal;
 user.robSuccess++;
 user.totalEarned += finalSteal;
 const store = getStore(guildId);
 saveStore(guildId, store);
 const ec = getEconomy(guildId);
 const embed = makeEmbed('🔫 Robbery Successful', `You robbed **${target.username}** and got away with **+${formatNumber(finalSteal)}** ${ec.currencyName}!`, '#57F287', `Balance: ${formatNumber(user.wallet)}`);
 return message.reply({ embeds: [embed] });
 } else {
 const fine = Math.floor(Math.random() * 150) + 50;
 removeCredits(guildId, userId, fine, 'rob_fine');
 const ec = getEconomy(guildId);
 const embed = makeEmbed('👮 Robbery Failed', `You got caught trying to rob **${target.username}** and paid a **${formatNumber(fine)}** ${ec.currencyName} fine.`, '#ED4245', `Balance: ${formatNumber(user.wallet)}`);
 return message.reply({ embeds: [embed] });
 }
}

async function handleOpen(message) {
 if (!isEconomyEnabled(message.guild.id)) return message.reply(err('Economy is not enabled.'));
 const guildId = message.guild.id;
 const userId = message.author.id;
 const user = getUserEconomy(guildId, userId);

 const cd = checkCooldown(user, 'open');
 if (cd.onCooldown) {
 return message.reply(err(`You're out of crates. Come back in **${formatDuration(cd.remaining)}**.`));
 }
 setCooldown(guildId, userId, 'open');

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

 const ec = getEconomy(guildId);
 if (reward.type === 'nothing') {
 return message.reply({ embeds: [makeEmbed('📦 Crate Opened', 'You opened the crate but it was empty.', '#2F3136', 'Better luck next time')] });
 }

 const amount = Math.floor(Math.random() * (reward.max - reward.min + 1)) + reward.min;
 addCredits(guildId, userId, amount, 'crate');
 const embed = makeEmbed('📦 Crate Opened', `You found **+${formatNumber(amount)}** ${ec.currencyName} inside!`, '#57F287', `Balance: ${formatNumber(user.wallet)}`);
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
 const store = getStore(guildId);

 const amount = parseAmount(args[0], user, 'wallet');
 if (amount === null) return message.reply(err('Usage: `,deposit <amount>`'));
 if (amount <= 0) return message.reply(err('Amount must be greater than 0.'));
 if (user.wallet < amount) return message.reply(err(`You only have **${formatNumber(user.wallet)}** in your wallet.`));

 user.wallet -= amount;
 user.bank += amount;
 saveStore(guildId, store);

 const ec = getEconomy(guildId);
 const embed = makeEmbed('🏦 Deposit Successful', `**+${formatNumber(amount)}** ${ec.currencyName} moved to your bank.`, '#57F287', `Wallet: ${formatNumber(user.wallet)} | Bank: ${formatNumber(user.bank)}`);
 return message.reply({ embeds: [embed] });
}

async function handleWithdraw(message, args) {
 if (!isEconomyEnabled(message.guild.id)) return message.reply(err('Economy is not enabled.'));
 const guildId = message.guild.id;
 const userId = message.author.id;
 const user = getUserEconomy(guildId, userId);
 const store = getStore(guildId);

 const amount = parseAmount(args[0], user, 'bank');
 if (amount === null) return message.reply(err('Usage: `,withdraw <amount>`'));
 if (amount <= 0) return message.reply(err('Amount must be greater than 0.'));
 if (user.bank < amount) return message.reply(err(`You only have **${formatNumber(user.bank)}** in your bank.`));

 user.bank -= amount;
 user.wallet += amount;
 saveStore(guildId, store);

 const ec = getEconomy(guildId);
 const embed = makeEmbed('🏦 Withdrawal Successful', `**+${formatNumber(amount)}** ${ec.currencyName} moved to your wallet.`, '#57F287', `Wallet: ${formatNumber(user.wallet)} | Bank: ${formatNumber(user.bank)}`);
 return message.reply({ embeds: [embed] });
}

async function handleTransfer(message, args) {
 if (!isEconomyEnabled(message.guild.id)) return message.reply(err('Economy is not enabled.'));
 const guildId = message.guild.id;
 const userId = message.author.id;
 const user = getUserEconomy(guildId, userId);
 const store = getStore(guildId);

 const target = message.mentions.users.first();
 if (!target) return message.reply(err('Mention a user: `,transfer @user <amount>`'));
 if (target.id === userId) return message.reply(err('You cannot transfer to yourself.'));

 const amount = parseAmount(args[1], user, 'wallet');
 if (amount === null) return message.reply(err('Usage: `,transfer @user <amount>`'));
 if (amount <= 0) return message.reply(err('Amount must be greater than 0.'));
 if (user.wallet < amount) return message.reply(err(`You only have **${formatNumber(user.wallet)}** in your wallet.`));

 const targetUser = getUserEconomy(guildId, target.id);
 user.wallet -= amount;
 targetUser.wallet += amount;
 saveStore(guildId, store);

 const ec = getEconomy(guildId);
 const embed = makeEmbed('💸 Transfer Complete', `You sent **${formatNumber(amount)}** ${ec.currencyName} to **${target.username}**.`, '#57F287', `Wallet: ${formatNumber(user.wallet)}`);
 return message.reply({ embeds: [embed] });
}

// ══════════════════════════════════════════════════════════
// COMMANDS: INFO
// ══════════════════════════════════════════════════════════

async function handleCirculation(message) {
 if (!isEconomyEnabled(message.guild.id)) return message.reply(err('Economy is not enabled.'));
 const store = getStore(message.guild.id);
 const ec = getEconomy(message.guild.id);
 const userCount = Object.keys(store.users).length;
 const totalWallet = Object.values(store.users).reduce((a, u) => a + (u.wallet || 0), 0);
 const totalBank = Object.values(store.users).reduce((a, u) => a + (u.bank || 0), 0);
 const total = totalWallet + totalBank;

 const embed = makeEmbed('📊 Economy Circulation', `**Total Users:** ${formatNumber(userCount)}\n**Wallet Total:** ${formatNumber(totalWallet)}\n**Bank Total:** ${formatNumber(totalBank)}\n**Combined:** ${formatNumber(total)} ${ec.currencyName}`, '#5865F2', 'Real-time statistics');
 return message.reply({ embeds: [embed] });
}

async function handleLeaderboard(message, args, client) {
 if (!isEconomyEnabled(message.guild.id)) return message.reply(err('Economy is not enabled.'));
 const guildId = message.guild.id;
 const store = getStore(guildId);
 const ec = getEconomy(guildId);
 const users = Object.entries(store.users)
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

 const embed = makeEmbed('🏆 Economy Leaderboard', desc || 'No economy data yet.', '#FFD700', `Page ${page}/${totalPages}`);
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

 const embed = makeEmbed(`👤 ${target.username}'s Profile`, `**Wallet:** ${formatNumber(user.wallet)}\n**Bank:** ${formatNumber(user.bank)}\n**Total:** ${formatNumber(total)}\n**Earned:** ${formatNumber(user.totalEarned)}\n**Spent:** ${formatNumber(user.totalSpent)}\n**Games Played:** ${formatNumber(user.gamesPlayed)}\n**Games Won:** ${formatNumber(user.gamesWon)}\n**Robberies:** ${formatNumber(user.robAttempts)} (Success: ${formatNumber(user.robSuccess)})`, '#5865F2', 'Economy Profile');
 return message.reply({ embeds: [embed] });
}

// ══════════════════════════════════════════════════════════
// COMMANDS: JOBS (Guild Mode Only)
// ══════════════════════════════════════════════════════════

async function handleJobAdd(message, args) {
 if (isGlobalMode(message.guild.id)) return message.reply(err('Job management is not available in global economy mode.'));
 if (!canManageEconomy(message.member, message.guild.id)) return message.reply(err('You need to be an economy admin or have Manage Server permission.'));

 const guildId = message.guild.id;
 const ec = getEconomy(guildId);

 const name = args[0];
 const min = parseInt(args[1]);
 const max = parseInt(args[2]);
 const description = args.slice(3).join(' ') || 'No description';

 if (!name || isNaN(min) || isNaN(max)) {
 return message.reply(err('Usage: `,job add <name> <min> <max> [description]`'));
 }

 ec.jobs.push({ name, min, max, description });
 saveEconomy(guildId, ec);
 return message.reply(ok(`Added job **${name}** (${min}-${max} ${ec.currencyName}).`));
}

async function handleJobRemove(message, args) {
 if (isGlobalMode(message.guild.id)) return message.reply(err('Job management is not available in global economy mode.'));
 if (!canManageEconomy(message.member, message.guild.id)) return message.reply(err('You need to be an economy admin or have Manage Server permission.'));

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
// 4-PAGE ECONOMY GUIDE
// ══════════════════════════════════════════════════════════

const ECONOMY_PAGES = [
 {
 emoji: '🎰',
 title: 'Gambling Games',
 color: '#FAA61A',
 commands: [
 { name: 'coinflip', usage: ',coinflip <amount> <heads|tails>', desc: 'Flip a coin and bet on the outcome.' },
 { name: 'mines', usage: ',mines <amount> <bombs>', desc: 'Find gems, avoid bombs. More bombs = higher multipliers!' },
 { name: 'blackjack', usage: ',blackjack <amount>', desc: 'Play blackjack against the dealer.' },
 { name: 'plinko', usage: ',plinko <amount>', desc: 'Drop a ball and hope for a high multiplier (max 10x).' },
 { name: 'crash', usage: ',crash <amount>', desc: 'Cash out before the rocket crashes.' },
 { name: 'slots', usage: ',slots <amount>', desc: 'Spin the slot machine.' },
 { name: 'gamble', usage: ',gamble <amount>', desc: 'Roll for a random multiplier.' },
 { name: 'roulette', usage: ',roulette <amount> <red|black|green|number>', desc: 'Bet on roulette.' },
 { name: 'highlow', usage: ',highlow <amount>', desc: 'Guess if the next number is higher or lower.' },
 { name: 'ladder', usage: ',ladder <amount>', desc: 'Climb the ladder for bigger multipliers.' },
 { name: 'dice', usage: ',dice <amount>', desc: 'Roll dice against the bot.' },
 { name: 'scratch', usage: ',scratch <amount>', desc: 'Play a scratch card.' },
 ],
 },
 {
 emoji: '🏦',
 title: 'Money Management',
 color: '#57F287',
 commands: [
 { name: 'balance', usage: ',balance [@user]', desc: 'Check your or another user\'s balance.' },
 { name: 'deposit', usage: ',deposit <amount|all|half|quarter>', desc: 'Move credits from wallet to bank.' },
 { name: 'withdraw', usage: ',withdraw <amount|all|half|quarter>', desc: 'Move credits from bank to wallet.' },
 { name: 'transfer', usage: ',transfer @user <amount>', desc: 'Send credits to another user.' },
 { name: 'leaderboard', usage: ',leaderboard [page]', desc: 'View the richest users.' },
 { name: 'profile', usage: ',profile [@user]', desc: 'View detailed economy stats.' },
 { name: 'inventory', usage: ',inventory [@user]', desc: 'View your shop inventory.' },
 ],
 },
 {
 emoji: '💼',
 title: 'Making Money',
 color: '#5865F2',
 commands: [
 { name: 'daily', usage: ',daily', desc: 'Claim your daily reward (24h cooldown).' },
 { name: 'work', usage: ',work [job name]', desc: 'Work a job for credits (7m cooldown).' },
 { name: 'crime', usage: ',crime', desc: 'Commit a crime for credits (10m cooldown).' },
 { name: 'rob', usage: ',rob @user', desc: 'Attempt to rob another user (15m cooldown).' },
 { name: 'open', usage: ',open', desc: 'Open a free crate for random rewards (5m cooldown).' },
 { name: 'quests', usage: ',quests', desc: 'View and complete quests for rewards.' },
 { name: 'quest', usage: ',quest', desc: 'Check your current quest progress.' },
 ],
 },
 {
 emoji: '⚙️',
 title: 'Admin Controls',
 color: '#ED4245',
 commands: [
 { name: 'economy enable', usage: ',economy enable', desc: 'Enable the economy system.' },
 { name: 'economy disable', usage: ',economy disable', desc: 'Disable the economy system.' },
 { name: 'economy reset', usage: ',economy reset @user', desc: 'Reset a user\'s economy data (Guild only).' },
 { name: 'economy mode', usage: ',economy mode <guild|global>', desc: 'Switch economy mode (Server Owner only).' },
 { name: 'economy config', usage: ',economy config', desc: 'View economy configuration.' },
 { name: 'economyadmin add', usage: ',economyadmin add @user', desc: 'Add an economy admin (Server Owner only).' },
 { name: 'economyadmin remove', usage: ',economyadmin remove @user', desc: 'Remove an economy admin (Server Owner only).' },
 { name: 'economyadmin list', usage: ',economyadmin list', desc: 'List economy admins.' },
 { name: 'economyevents enable', usage: ',economyevents enable', desc: 'Enable automatic economy events.' },
 { name: 'economyevents disable', usage: ',economyevents disable', desc: 'Disable automatic economy events.' },
 { name: 'economyevents channel', usage: ',economyevents channel #channel', desc: 'Set the events announcement channel.' },
 { name: 'event start', usage: ',event start <type>', desc: 'Manually start an economy event.' },
 { name: 'event stop', usage: ',event stop [type]', desc: 'Stop an active economy event.' },
 { name: 'event list', usage: ',event list', desc: 'View active economy events.' },
 ],
 },
];

async function sendEconomyGuide(message) {
 const prefix = ',';
 let page = 0;

 const buildEmbed = (p) => {
 const data = ECONOMY_PAGES[p];
 let desc = `**Page ${p + 1}/4 — ${data.emoji} ${data.title}**\n\n`;
 for (const cmd of data.commands) {
 desc += `\`${cmd.usage}\`\n↳ ${cmd.desc}\n\n`;
 }
 return new EmbedBuilder()
 .setColor(data.color)
 .setTitle(`${data.emoji} Economy Guide`)
 .setDescription(desc)
 .setFooter({ text: `Use the buttons below to navigate • ${prefix}economy <subcommand> for admin settings` });
 };

 const buildRow = (p) => {
 const row = new ActionRowBuilder();
 row.addComponents(
 new ButtonBuilder().setCustomId('eco_guide_prev').setLabel('◀ Prev').setStyle(ButtonStyle.Primary).setDisabled(p === 0),
 new ButtonBuilder().setCustomId('eco_guide_page').setLabel(`${p + 1}/4`).setStyle(ButtonStyle.Secondary).setDisabled(true),
 new ButtonBuilder().setCustomId('eco_guide_next').setLabel('Next ▶').setStyle(ButtonStyle.Primary).setDisabled(p === 3),
 new ButtonBuilder().setCustomId('eco_guide_close').setLabel('❌ Close').setStyle(ButtonStyle.Danger),
 );
 return row;
 };

 const msg = await message.reply({ embeds: [buildEmbed(page)], components: [buildRow(page)] });

 const collector = msg.createMessageComponentCollector({
 filter: i => i.user.id === message.author.id,
 time: 120000,
 });

 collector.on('collect', async interaction => {
 if (interaction.customId === 'eco_guide_close') {
 collector.stop();
 return interaction.update({ components: [] }).catch(() => {});
 }
 if (interaction.customId === 'eco_guide_prev') page = Math.max(0, page - 1);
 if (interaction.customId === 'eco_guide_next') page = Math.min(3, page + 1);
 await interaction.update({ embeds: [buildEmbed(page)], components: [buildRow(page)] }).catch(() => {});
 });

 collector.on('end', () => {
 msg.edit({ components: [] }).catch(() => {});
 });
}

// ══════════════════════════════════════════════════════════
// COMMANDS: ADMIN
// ══════════════════════════════════════════════════════════

async function handleEconomyConfig(message, args) {
 if (!canManageEconomy(message.member, message.guild.id)) {
 return message.reply(err('You need to be an economy admin, have Manage Server permission, or be the server owner.'));
 }

 const guildId = message.guild.id;
 const ec = getEconomy(guildId);
 const sub = args[0]?.toLowerCase();

 if (!sub) {
 return sendEconomyGuide(message);
 }

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

 if (sub === 'mode') {
 if (!isEconomyOwner(message.member)) {
 return message.reply(err('Only the **server owner** can change the economy mode.'));
 }
 const mode = args[1]?.toLowerCase();
 if (!mode || !['guild', 'global'].includes(mode)) {
 return message.reply(err('Usage: `,economy mode <guild|global>`'));
 }
 ec.mode = mode;
 saveEconomy(guildId, ec);
 return message.reply(ok(`Economy mode set to **${mode}**. ${mode === 'global' ? 'Note: Global data is shared across all servers and completely separate from guild data.' : ''}`));
 }

 if (sub === 'reset') {
 if (isGlobalMode(guildId)) {
 return message.reply(err('User reset is not available in global economy mode.'));
 }
 if (!message.member.permissions.has(PermissionFlagsBits.Administrator)) {
 return message.reply(err('You need **Administrator** permission.'));
 }
 const target = message.mentions.users.first();
 if (!target) return message.reply(err('Usage: `,economy reset @user`'));
 delete ec.users[target.id];
 saveEconomy(guildId, ec);
 return message.reply(ok(`Reset **${target.username}**'s economy data.`));
 }

 if (sub === 'config') {
 const isGlobal = ec.mode === 'global';
 const embed = makeEmbed('⚙️ Economy Configuration',
 `**Status:** ${ec.enabled ? 'Enabled' : 'Disabled'}\n` +
 `**Mode:** ${ec.mode}\n` +
 `**Currency:** ${ec.currencyName} (${ec.currencySymbol})\n` +
 `**Jobs:** ${isGlobal ? 'N/A (Global uses defaults)' : ec.jobs.length}\n` +
 `**Events:** ${ec.events?.enabled ? 'Enabled' : 'Disabled'}\n` +
 `**Events Channel:** ${ec.events?.channelId ? `<#${ec.events.channelId}>` : 'Not set'}\n` +
 `**Log Channel:** ${ec.logChannelId ? `<#${ec.logChannelId}>` : 'Not set'}\n` +
 `**Economy Admins:** ${(ec.economyAdmins || []).length} configured`,
 '#5865F2', `Hardcoded: Daily ${HARDCODED.DAILY_AMOUNT} | Work ${formatDuration(HARDCODED.WORK_COOLDOWN)} | Crime ${formatDuration(HARDCODED.CRIME_COOLDOWN)} | Rob ${formatDuration(HARDCODED.ROB_COOLDOWN)} | Open ${formatDuration(HARDCODED.OPEN_COOLDOWN)} | Max: Unlimited`);
 return message.reply({ embeds: [embed] });
 }

 return message.reply({ embeds: [info('Economy Admin', `
\`,economy\` — Show the economy guide
\`,economy enable\` — Enable economy
\`,economy disable\` — Disable economy
\`,economy config\` — View configuration
\`,economy mode <guild|global>\` — Switch mode (Server Owner only)
\`,economy reset @user\` — Reset user data (Guild only, Admin)
`)] });
}

async function handleEconomyEvents(message, args) {
 if (!canManageEconomy(message.member, message.guild.id)) {
 return message.reply(err('You need to be an economy admin, have Manage Server permission, or be the server owner.'));
 }

 const guildId = message.guild.id;
 const ec = getEconomy(guildId);
 const sub = args[0]?.toLowerCase();

 if (sub === 'enable') {
 ec.events.enabled = true;
 saveEconomy(guildId, ec);
 return message.reply(ok('Economy events are now **enabled**.'));
 }

 if (sub === 'disable') {
 ec.events.enabled = false;
 saveEconomy(guildId, ec);
 return message.reply(ok('Economy events are now **disabled**.'));
 }

 if (sub === 'channel') {
 const channel = message.mentions.channels.first() || message.guild.channels.cache.get(args[1]);
 if (!channel || !channel.isTextBased()) {
 return message.reply(err('Mention a valid text channel: `,economyevents channel #channel`'));
 }
 ec.events.channelId = channel.id;
 saveEconomy(guildId, ec);
 return message.reply(ok(`Economy events will now be announced in <#${channel.id}>.`));
 }

 return message.reply({ embeds: [info('Economy Events', `
\`,economyevents enable\` — Enable automatic economy events
\`,economyevents disable\` — Disable automatic economy events
\`,economyevents channel #channel\` — Set the events announcement channel
`)] });
}

// ══════════════════════════════════════════════════════════
// ECONOMY ADMIN MANAGEMENT (Server Owner Only)
// ══════════════════════════════════════════════════════════

async function handleEconomyAdmin(message, args) {
 const guildId = message.guild.id;
 const ec = getEconomy(guildId);

 if (!isEconomyOwner(message.member)) {
 return message.reply(err('Only the **server owner** can manage economy admins.'));
 }

 const sub = args[0]?.toLowerCase();

 if (sub === 'add') {
 const target = message.mentions.users.first();
 if (!target) return message.reply(err('Mention a user: `,economyadmin add @user`'));
 if (!Array.isArray(ec.economyAdmins)) ec.economyAdmins = [];
 if (!ec.economyAdmins.includes(target.id)) {
 ec.economyAdmins.push(target.id);
 saveEconomy(guildId, ec);
 }
 return message.reply(ok(`**${target.username}** is now an economy admin.`));
 }

 if (sub === 'remove') {
 const target = message.mentions.users.first() || (args[1]?.match(/^\d+$/) ? await message.client.users.fetch(args[1]).catch(() => null) : null);
 if (!target) return message.reply(err('Mention a user or provide ID: `,economyadmin remove @user`'));
 if (!Array.isArray(ec.economyAdmins)) ec.economyAdmins = [];
 ec.economyAdmins = ec.economyAdmins.filter(id => id !== target.id);
 saveEconomy(guildId, ec);
 return message.reply(ok(`Removed economy admin.`));
 }

 if (sub === 'list') {
 if (!Array.isArray(ec.economyAdmins) || !ec.economyAdmins.length) {
 return message.reply(info('Economy Admins', 'No economy admins set.'));
 }
 const list = await Promise.all(ec.economyAdmins.map(async id => {
 const member = await message.guild.members.fetch(id).catch(() => null);
 return member ? `• ${member.user.username} (${id})` : `• Unknown (${id})`;
 }));
 return message.reply(info('Economy Admins', list.join('\n')));
 }

 return message.reply({ embeds: [info('Economy Admin', `
\`,economyadmin add @user\` — Add an economy admin
\`,economyadmin remove @user\` — Remove an economy admin
\`,economyadmin list\` — List economy admins
`)] });
}

// ══════════════════════════════════════════════════════════
// CHEAT COMMANDS (Guild Mode Only, Admin Only)
// ══════════════════════════════════════════════════════════

async function handleGive(message, args) {
 const guildId = message.guild.id;
 if (isGlobalMode(guildId)) return message.reply(err('This command is not available in global economy mode.'));
 if (!message.member.permissions.has(PermissionFlagsBits.Administrator)) return message.reply(err('You need **Administrator** permission.'));

 const target = message.mentions.users.first() || (args[0]?.match(/^\d+$/) ? await message.client.users.fetch(args[0]).catch(() => null) : null);
 const amount = parseInt(args[1]);
 if (!target || isNaN(amount) || amount <= 0) return message.reply(err('Usage: `,give @user <amount>`'));

 if (!isEconomyEnabled(guildId)) return message.reply(err('Economy is not enabled.'));
 addCredits(guildId, target.id, amount, 'admin_give');
 const user = getUserEconomy(guildId, target.id);
 return message.reply(ok(`Gave **+${formatNumber(amount)}** to **${target.username}**. New balance: **${formatNumber(user.wallet)}**`));
}

async function handleTake(message, args) {
 const guildId = message.guild.id;
 if (isGlobalMode(guildId)) return message.reply(err('This command is not available in global economy mode.'));
 if (!message.member.permissions.has(PermissionFlagsBits.Administrator)) return message.reply(err('You need **Administrator** permission.'));

 const target = message.mentions.users.first() || (args[0]?.match(/^\d+$/) ? await message.client.users.fetch(args[0]).catch(() => null) : null);
 const amount = parseInt(args[1]);
 if (!target || isNaN(amount) || amount <= 0) return message.reply(err('Usage: `,take @user <amount>`'));

 if (!isEconomyEnabled(guildId)) return message.reply(err('Economy is not enabled.'));
 removeCredits(guildId, target.id, amount, 'admin_take');
 const user = getUserEconomy(guildId, target.id);
 return message.reply(ok(`Took **-${formatNumber(amount)}** from **${target.username}**. New balance: **${formatNumber(user.wallet)}**`));
}

async function handleSetCredits(message, args) {
 const guildId = message.guild.id;
 if (isGlobalMode(guildId)) return message.reply(err('This command is not available in global economy mode.'));
 if (!message.member.permissions.has(PermissionFlagsBits.Administrator)) return message.reply(err('You need **Administrator** permission.'));

 const target = message.mentions.users.first() || (args[0]?.match(/^\d+$/) ? await message.client.users.fetch(args[0]).catch(() => null) : null);
 const amount = parseInt(args[1]);
 if (!target || isNaN(amount) || amount < 0) return message.reply(err('Usage: `,setcredits @user <amount>`'));

 setCredits(guildId, target.id, amount);
 const user = getUserEconomy(guildId, target.id);
 return message.reply(ok(`Set **${target.username}**'s balance to **${formatNumber(user.wallet)}**`));
}

async function handleReset(message, args) {
 const guildId = message.guild.id;
 if (isGlobalMode(guildId)) return message.reply(err('This command is not available in global economy mode.'));
 if (!message.member.permissions.has(PermissionFlagsBits.Administrator)) return message.reply(err('You need **Administrator** permission.'));

 const target = message.mentions.users.first() || (args[0]?.match(/^\d+$/) ? await message.client.users.fetch(args[0]).catch(() => null) : null);
 if (!target) return message.reply(err('Usage: `,reset @user`'));

 if (!isEconomyEnabled(guildId)) return message.reply(err('Economy is not enabled.'));
 const ec = getEconomy(guildId);
 delete ec.users[target.id];
 saveEconomy(guildId, ec);
 return message.reply(ok(`Reset **${target.username}**'s economy data.`));
}

async function handleDestroy(message, args) {
 const guildId = message.guild.id;
 if (isGlobalMode(guildId)) return message.reply(err('This command is not available in global economy mode.'));
 if (!message.member.permissions.has(PermissionFlagsBits.Administrator)) return message.reply(err('You need **Administrator** permission.'));

 const amount = parseInt(args[0]);
 if (isNaN(amount) || amount <= 0) return message.reply(err('Usage: `,destroy <amount>`'));

 const store = getStore(guildId);
 store.circulation = Math.max(0, (store.circulation || 0) - amount);
 saveStore(guildId, store);
 const ec = getEconomy(guildId);
 return message.reply(ok(`Destroyed **${formatNumber(amount)}** ${ec.currencyName} from circulation.`));
}

// Legacy aliases
async function handleAddCredits(message, args) { return handleGive(message, args); }
async function handleRemoveCredits(message, args) { return handleTake(message, args); }
async function handleResetUser(message, args) { return handleReset(message, args); }

// ══════════════════════════════════════════════════════════
// BUTTON HANDLERS
// ══════════════════════════════════════════════════════════

async function handleEconomyButton(interaction) {
 const id = interaction.customId;
 if (id.startsWith('ecolb_')) {
 const page = parseInt(id.replace('ecolb_', ''));
 const guildId = interaction.guild.id;
 const store = getStore(guildId);
 const ec = getEconomy(guildId);
 const users = Object.entries(store.users)
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

 const embed = makeEmbed('🏆 Economy Leaderboard', desc || 'No data.', '#FFD700', `Page ${page}/${totalPages}`);
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
 COLORS,
 addCredits, removeCredits, setCredits, logTransaction, sendEconomyLog,
 formatNumber, formatDuration, getEventMultiplier, getActiveEventNames,
 trackEconomyMessage, setCooldown, getDefaultShopItems, parseDuration,
 parseAmount, makeEmbed,
 getStore, saveStore, isGlobalMode,
 canManageEconomy, isEconomyOwner,
 // Core
 handleBalance, handleDaily, handleWork, handleCrime, handleRob, handleOpen,
 // Banking
 handleDeposit, handleWithdraw, handleTransfer,
 // Info
 handleCirculation, handleLeaderboard, handleProfile,
 // Jobs
 handleJobAdd, handleJobRemove,
 // Admin
 handleEconomyConfig, handleEconomyEvents, handleEconomyAdmin,
 handleGive, handleTake, handleReset, handleDestroy,
 handleAddCredits, handleRemoveCredits, handleSetCredits, handleResetUser,
 // Buttons
 handleEconomyButton,
};