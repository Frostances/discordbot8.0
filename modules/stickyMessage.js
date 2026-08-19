// ══════════════════════════════════════════════════════════
// STICKY MESSAGE MODULE
// Auto-repost a message at the bottom of configured channels
// ══════════════════════════════════════════════════════════

const { EmbedBuilder, PermissionFlagsBits } = require('discord.js');
const { getGuildDb } = require('./database');
const { hasDiscordPerm } = require('./helpers');
const { success, error, info } = require('../utils/embeds');

// In-memory cache: guildId -> Map(channelId -> { messageId, content })
const stickyCache = new Map();

// ══════════════════════════════════════════════════════════
// DATABASE HELPERS
// ══════════════════════════════════════════════════════════

function getStickyConfig(guildId) {
 const db = getGuildDb(guildId);
 let cfg = db.get('stickyMessages', null);
 if (!cfg || typeof cfg !== 'object' || Array.isArray(cfg)) {
 cfg = {};
 db.set('stickyMessages', cfg);
 }
 return cfg;
}

function saveStickyConfig(guildId, cfg) {
 const db = getGuildDb(guildId);
 db.set('stickyMessages', cfg);
}

// ══════════════════════════════════════════════════════════
// CACHE MANAGEMENT
// ══════════════════════════════════════════════════════════

function getGuildCache(guildId) {
 if (!stickyCache.has(guildId)) stickyCache.set(guildId, new Map());
 return stickyCache.get(guildId);
}

function setStickyMessage(guildId, channelId, messageId, content) {
 const cache = getGuildCache(guildId);
 cache.set(channelId, { messageId, content });
}

function removeStickyMessage(guildId, channelId) {
 const cache = getGuildCache(guildId);
 cache.delete(channelId);
}

function getStickyMessage(guildId, channelId) {
 const cache = getGuildCache(guildId);
 return cache.get(channelId) || null;
}

// ══════════════════════════════════════════════════════════
// EVENT HANDLER — Repost sticky when someone talks
// ══════════════════════════════════════════════════════════

async function onMessageCreate(message, client) {
 if (message.author.bot) return;
 if (!message.guild) return;

 const guildId = message.guild.id;
 const channelId = message.channel.id;
 const cache = getGuildCache(guildId);
 const sticky = cache.get(channelId);
 if (!sticky) return;

 // Don't repost if the message IS the sticky message itself
 if (message.id === sticky.messageId) return;

 // Don't repost if a bot posted the sticky (avoid loops)
 if (message.author.id === client.user.id) return;

 try {
 // Delete old sticky
 const channel = message.channel;
 const oldMsg = await channel.messages.fetch(sticky.messageId).catch(() => null);
 if (oldMsg) await oldMsg.delete().catch(() => {});

 // Post new sticky
 const newMsg = await channel.send({ content: sticky.content });
 sticky.messageId = newMsg.id;
 cache.set(channelId, sticky);
 } catch (e) {
 // Silent fail — channel may be missing permissions
 }
}

// ══════════════════════════════════════════════════════════
// COMMANDS
// ══════════════════════════════════════════════════════════

async function handleStickyMessage(message, args) {
 if (!hasDiscordPerm(message.member, 'ManageGuild')) {
 return message.reply(error('You need **Manage Server** permission.'));
 }

 const guildId = message.guild.id;
 const cfg = getStickyConfig(guildId);
 const sub = args[0]?.toLowerCase();

 // ── ADD ──
 if (sub === 'add') {
 const channel = message.mentions.channels.first();
 if (!channel) return message.reply(error('Mention a channel: `,stickymessage add #channel <message>`'));

 const msgContent = args.slice(1).join(' ').replace(/<#\d+>/, '').trim();
 if (!msgContent) return message.reply(error('Provide a message: `,stickymessage add #channel <message>`'));

 // Save to DB
 cfg[channel.id] = msgContent;
 saveStickyConfig(guildId, cfg);

 // Post immediately
 try {
 const sent = await channel.send({ content: msgContent });
 setStickyMessage(guildId, channel.id, sent.id, msgContent);
 } catch {
 return message.reply(error('I cannot send messages in that channel. Check my permissions.'));
 }

 return message.reply(success(`Sticky message set in <#${channel.id}>.`));
 }

 // ── REMOVE ──
 if (sub === 'remove') {
 const channel = message.mentions.channels.first() || message.guild.channels.cache.get(args[1]);
 if (!channel) return message.reply(error('Mention a channel: `,stickymessage remove #channel`'));

 // Delete old sticky if cached
 const sticky = getStickyMessage(guildId, channel.id);
 if (sticky) {
 try {
 const oldMsg = await channel.messages.fetch(sticky.messageId).catch(() => null);
 if (oldMsg) await oldMsg.delete().catch(() => {});
 } catch {}
 removeStickyMessage(guildId, channel.id);
 }

 // Remove from DB
 delete cfg[channel.id];
 saveStickyConfig(guildId, cfg);
 return message.reply(success(`Sticky message removed from <#${channel.id}>.`));
 }

 // ── LIST ──
 if (sub === 'list') {
 const entries = Object.entries(cfg);
 if (!entries.length) return message.reply(info('Sticky Messages', 'No sticky messages configured.'));

 const desc = entries.map(([chId, msg]) => {
 const ch = message.guild.channels.cache.get(chId);
 const chName = ch ? ch.name : 'Unknown';
 const preview = msg.length > 40 ? msg.slice(0, 40) + '…' : msg;
 return `• <#${chId}> — "${preview}"`;
 }).join('\n');

 const embed = new EmbedBuilder()
 .setColor('#5865F2')
 .setTitle('📌 Sticky Messages')
 .setDescription(desc)
 .setFooter({ text: `Total: ${entries.length}` });
 return message.reply({ embeds: [embed] });
 }

 // ── VIEW ──
 if (sub === 'view') {
 const channel = message.mentions.channels.first() || message.guild.channels.cache.get(args[1]);
 if (!channel) return message.reply(error('Mention a channel: `,stickymessage view #channel`'));

 const msg = cfg[channel.id];
 if (!msg) return message.reply(error(`No sticky message set for <#${channel.id}>.`));

 const embed = new EmbedBuilder()
 .setColor('#5865F2')
 .setTitle(`📌 Sticky Message — #${channel.name}`)
 .setDescription(msg)
 .setFooter({ text: 'This message is reposted whenever someone sends a message.' });
 return message.reply({ embeds: [embed] });
 }

 // ── DEFAULT HELP ──
 return message.reply({ embeds: [info('Sticky Message', `
\`,stickymessage add #channel <message>\` — Add a sticky message to a channel
\`,stickymessage remove #channel\` — Remove a sticky message
\`,stickymessage list\` — View all sticky messages
\`,stickymessage view #channel\` — View a channel's sticky message
`)] });
}

// ══════════════════════════════════════════════════════════
// INIT — Load sticky messages on bot startup / guild join
// ══════════════════════════════════════════════════════════

async function initStickyMessages(guild, client) {
 const cfg = getStickyConfig(guild.id);
 const cache = getGuildCache(guild.id);
 for (const [channelId, content] of Object.entries(cfg)) {
 const channel = guild.channels.cache.get(channelId);
 if (!channel || !channel.isTextBased()) continue;
 try {
 // Fetch last messages to find existing sticky
 const messages = await channel.messages.fetch({ limit: 10 });
 const existing = messages.find(m => m.author.id === client.user.id && m.content === content);
 if (existing) {
 cache.set(channelId, { messageId: existing.id, content });
 } else {
 // Post fresh sticky
 const sent = await channel.send({ content });
 cache.set(channelId, { messageId: sent.id, content });
 }
 } catch {
 // Channel permissions issue — skip
 }
 }
}

// ══════════════════════════════════════════════════════════
// EXPORTS
// ══════════════════════════════════════════════════════════

module.exports = {
 handleStickyMessage,
 onMessageCreate,
 initStickyMessages,
};