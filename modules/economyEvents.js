// ══════════════════════════════════════════════════════════
// ECONOMY EVENTS MODULE
// Automatic server-wide economy events
// ══════════════════════════════════════════════════════════

const { EmbedBuilder } = require('discord.js');
const { getEconomy, saveEconomy, getActiveEventNames, canManageEconomy } = require('./economy');
const { COLORS } = require('../utils/embeds');
const logger = require('../utils/logger');

// ══════════════════════════════════════════════════════════
// EVENT TYPES
// ══════════════════════════════════════════════════════════

const EVENT_TYPES = {
 doubleRewards: { name: '⚡ Double Rewards', duration: 30 * 60 * 1000, description: 'Economy activities give 2× Credits!' },
 quizHour: { name: '🧠 Quiz Hour', duration: 30 * 60 * 1000, description: 'Trivia rewards are increased!' },
 payday: { name: '💰 Payday', duration: 30 * 60 * 1000, description: ',work rewards are increased!' },
 questRush: { name: '🎯 Quest Rush', duration: 30 * 60 * 1000, description: 'Quest rewards are temporarily increased!' },
 casinoHour: { name: '🎰 Casino Arcade Hour', duration: 30 * 60 * 1000, description: 'Casino games provide increased rewards!' },
};

// ══════════════════════════════════════════════════════════
// EVENT MANAGEMENT
// ══════════════════════════════════════════════════════════

function getActiveEvents(guildId) {
 const ec = getEconomy(guildId);
 if (!ec.activeEvents) return {};
 const now = Date.now();
 let changed = false;
 for (const [key, val] of Object.entries(ec.activeEvents)) {
 if (val && val.expiresAt && val.expiresAt < now) {
 ec.activeEvents[key] = null;
 changed = true;
 }
 }
 if (changed) saveEconomy(guildId, ec);
 return ec.activeEvents;
}

function startEvent(guildId, eventType, durationMs = null) {
 const ec = getEconomy(guildId);
 if (!ec.activeEvents) ec.activeEvents = {};
 const config = EVENT_TYPES[eventType];
 if (!config) return false;

 ec.activeEvents[eventType] = {
 startedAt: Date.now(),
 expiresAt: Date.now() + (durationMs || config.duration),
 };
 saveEconomy(guildId, ec);
 return true;
}

function stopEvent(guildId, eventType) {
 const ec = getEconomy(guildId);
 if (ec.activeEvents) ec.activeEvents[eventType] = null;
 saveEconomy(guildId, ec);
}

function stopAllEvents(guildId) {
 const ec = getEconomy(guildId);
 ec.activeEvents = {};
 saveEconomy(guildId, ec);
}

function isEventActive(guildId, eventType) {
 const events = getActiveEvents(guildId);
 return events[eventType] && events[eventType].expiresAt > Date.now();
}

// ══════════════════════════════════════════════════════════
// RANDOM EVENT SCHEDULER
// ══════════════════════════════════════════════════════════

const guildTimers = new Map();

function scheduleRandomEvent(guildId, client) {
 const ec = getEconomy(guildId);
 if (!ec.events || !ec.events.enabled) return;

 if (guildTimers.has(guildId)) {
 clearTimeout(guildTimers.get(guildId));
 guildTimers.delete(guildId);
 }

 const interval = (Math.floor(Math.random() * 4) + 2) * 60 * 60 * 1000;

 const timer = setTimeout(async () => {
 const currentEc = getEconomy(guildId);
 if (!currentEc.enabled || !currentEc.events || !currentEc.events.enabled) return;

 const keys = Object.keys(EVENT_TYPES);
 const type = keys[Math.floor(Math.random() * keys.length)];
 startEvent(guildId, type);

 try {
 const guild = client.guilds.cache.get(guildId);
 if (!guild) return;
 const config = EVENT_TYPES[type];
 const embed = new EmbedBuilder()
 .setColor(COLORS.gold)
 .setTitle(config.name)
 .setDescription(`${config.description}\n\n⏰ Duration: **30 minutes**`)
 .setTimestamp();

 const targetChannelId = currentEc.events?.channelId || currentEc.logChannelId;
 if (targetChannelId) {
 const ch = guild.channels.cache.get(targetChannelId);
 if (ch) await ch.send({ embeds: [embed] });
 } else {
 const textCh = guild.channels.cache.find(c => c.isTextBased() && !c.isDMBased() && c.permissionsFor(guild.members.me).has('SendMessages'));
 if (textCh) await textCh.send({ embeds: [embed] });
 }
 } catch (e) {
 logger.error('ECONOMY_EVENT', `Failed to announce event in ${guildId}`, e);
 }

 scheduleRandomEvent(guildId, client);
 }, interval);

 guildTimers.set(guildId, timer);
}

function stopScheduler(guildId) {
 if (guildTimers.has(guildId)) {
 clearTimeout(guildTimers.get(guildId));
 guildTimers.delete(guildId);
 }
}

// ══════════════════════════════════════════════════════════
// MANUAL EVENT COMMAND
// ══════════════════════════════════════════════════════════

async function handleEventCommand(message, args) {
 if (!canManageEconomy(message.member, message.guild.id)) {
 return message.reply({ embeds: [new EmbedBuilder().setColor(COLORS.error).setTitle('❌ Permission Denied').setDescription('You need to be an economy admin, have Manage Server permission, or be the server owner.')] });
 }

 const guildId = message.guild.id;
 const ec = getEconomy(guildId);
 const sub = args[0]?.toLowerCase();

 if (sub === 'start') {
 const type = args[1]?.toLowerCase();
 if (!type || !EVENT_TYPES[type]) {
 return message.reply({ embeds: [new EmbedBuilder().setColor(COLORS.info).setTitle('🎉 Event Types').setDescription(Object.entries(EVENT_TYPES).map(([k, v]) => `\`${k}\` — ${v.name}`).join('\n') + '\n\nUsage: `,event start <type>`')] });
 }
 startEvent(guildId, type);
 const config = EVENT_TYPES[type];
 return message.reply({ embeds: [new EmbedBuilder().setColor(COLORS.success).setTitle(config.name).setDescription(`${config.description}\n\n⏰ Duration: **30 minutes**`)] });
 }

 if (sub === 'stop') {
 const type = args[1]?.toLowerCase();
 if (type && EVENT_TYPES[type]) {
 stopEvent(guildId, type);
 return message.reply({ embeds: [new EmbedBuilder().setColor(COLORS.success).setTitle('Event Stopped').setDescription(`${EVENT_TYPES[type].name} has been stopped.`)] });
 }
 stopAllEvents(guildId);
 return message.reply({ embeds: [new EmbedBuilder().setColor(COLORS.success).setTitle('All Events Stopped').setDescription('All active economy events have been stopped.')] });
 }

 if (sub === 'list' || sub === 'active') {
 const events = getActiveEvents(guildId);
 const active = Object.entries(events).filter(([, v]) => v && v.expiresAt > Date.now());
 if (!active.length) {
 return message.reply({ embeds: [new EmbedBuilder().setColor(COLORS.muted).setTitle('🎉 Active Events').setDescription('No events are currently active.')] });
 }
 const desc = active.map(([k, v]) => {
 const cfg = EVENT_TYPES[k];
 const remaining = Math.ceil((v.expiresAt - Date.now()) / 60000);
 return `${cfg.name} — **${remaining}m** remaining\n${cfg.description}`;
 }).join('\n\n');
 return message.reply({ embeds: [new EmbedBuilder().setColor(COLORS.gold).setTitle('🎉 Active Events').setDescription(desc)] });
 }

 return message.reply({ embeds: [new EmbedBuilder().setColor(COLORS.info).setTitle('🎉 Economy Events').setDescription(`
\`,event start <type>\` — Start an event manually
\`,event stop [type]\` — Stop an event (or all)
\`,event list\` — Show active events

**Event Types:**
${Object.entries(EVENT_TYPES).map(([k, v]) => `\`${k}\` — ${v.name}`).join('\n')}
`)] });
}

// ══════════════════════════════════════════════════════════
// EXPORTS
// ══════════════════════════════════════════════════════════

module.exports = {
 EVENT_TYPES,
 getActiveEvents,
 startEvent,
 stopEvent,
 stopAllEvents,
 isEventActive,
 scheduleRandomEvent,
 stopScheduler,
 handleEventCommand,
};