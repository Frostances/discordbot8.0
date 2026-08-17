// ══════════════════════════════════════════════════════════
// STATS MODULE
// ══════════════════════════════════════════════════════════

const { EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle } = require('discord.js');
const { getGuildDb } = require('./database');
const { isStaffOrAdmin, formatTimeLeft } = require('./helpers');
const { error: mkError, info: mkInfo, success: mkSuccess, COLORS } = require('../utils/embeds');
const logger = require('../utils/logger');

// ══════════════════════════════════════════════════════════
// MESSAGE TRACKING
// ══════════════════════════════════════════════════════════

function trackMessage(guildId, userId, channelId) {
  const db = getGuildDb(guildId);
  let stats = db.get('messageStats', null);
  if (!stats) { stats = {}; db.set('messageStats', stats); }
  if (!stats[userId]) stats[userId] = { total: 0, channels: {} };
  stats[userId].total++;
  if (!stats[userId].channels[channelId]) stats[userId].channels[channelId] = 0;
  stats[userId].channels[channelId]++;
  db.set('messageStats', stats);
}

function getMessageStats(guildId, userId) {
  const db = getGuildDb(guildId);
  const stats = db.get('messageStats', {});
  return stats[userId] || { total: 0, channels: {} };
}

function getTopMessageUsers(guildId, limit = 10) {
  const db = getGuildDb(guildId);
  const stats = db.get('messageStats', {});
  return Object.entries(stats)
    .map(([id, data]) => ({ id, total: data.total }))
    .sort((a, b) => b.total - a.total)
    .slice(0, limit);
}

// ══════════════════════════════════════════════════════════
// VOICE TRACKING
// ══════════════════════════════════════════════════════════

function trackVoiceJoin(guildId, userId, channelId) {
  const db = getGuildDb(guildId);
  let stats = db.get('voiceStats', null);
  if (!stats) { stats = {}; db.set('voiceStats', stats); }
  if (!stats[userId]) stats[userId] = { total: 0, channels: {} };
  if (!stats[userId].channels[channelId]) stats[userId].channels[channelId] = 0;
  stats[userId].joinTime = Date.now();
  db.set('voiceStats', stats);
}

function trackVoiceLeave(guildId, userId, channelId) {
  const db = getGuildDb(guildId);
  const stats = db.get('voiceStats', {});
  if (!stats[userId]) return;
  const joinTime = stats[userId].joinTime;
  if (!joinTime) return;
  const duration = Date.now() - joinTime;
  stats[userId].total += duration;
  if (!stats[userId].channels[channelId]) stats[userId].channels[channelId] = 0;
  stats[userId].channels[channelId] += duration;
  stats[userId].joinTime = null;
  db.set('voiceStats', stats);
}

function getVoiceStats(guildId, userId) {
  const db = getGuildDb(guildId);
  const stats = db.get('voiceStats', {});
  const userStats = stats[userId] || { total: 0, channels: {} };
  if (userStats.joinTime) {
    userStats.total += Date.now() - userStats.joinTime;
  }
  return userStats;
}

function getTopVoiceUsers(guildId, limit = 10) {
  const db = getGuildDb(guildId);
  const stats = db.get('voiceStats', {});
  return Object.entries(stats)
    .map(([id, data]) => {
      let total = data.total || 0;
      if (data.joinTime) total += Date.now() - data.joinTime;
      return { id, total };
    })
    .sort((a, b) => b.total - a.total)
    .slice(0, limit);
}

// ══════════════════════════════════════════════════════════
// CAMERA / STREAM TRACKING
// ══════════════════════════════════════════════════════════

function trackCameraStart(guildId, userId, channelId) {
  const db = getGuildDb(guildId);
  let stats = db.get('cameraStats', null);
  if (!stats) { stats = {}; db.set('cameraStats', stats); }
  if (!stats[userId]) stats[userId] = { total: 0, channels: {} };
  if (!stats[userId].channels[channelId]) stats[userId].channels[channelId] = 0;
  stats[userId].startTime = Date.now();
  db.set('cameraStats', stats);
}

function trackCameraStop(guildId, userId, channelId) {
  const db = getGuildDb(guildId);
  const stats = db.get('cameraStats', {});
  if (!stats[userId]) return;
  const startTime = stats[userId].startTime;
  if (!startTime) return;
  const duration = Date.now() - startTime;
  stats[userId].total += duration;
  if (!stats[userId].channels[channelId]) stats[userId].channels[channelId] = 0;
  stats[userId].channels[channelId] += duration;
  stats[userId].startTime = null;
  db.set('cameraStats', stats);
}

function getCameraStats(guildId, userId) {
  const db = getGuildDb(guildId);
  const stats = db.get('cameraStats', {});
  const userStats = stats[userId] || { total: 0, channels: {} };
  if (userStats.startTime) {
    userStats.total += Date.now() - userStats.startTime;
  }
  return userStats;
}

function getTopCameraUsers(guildId, limit = 10) {
  const db = getGuildDb(guildId);
  const stats = db.get('cameraStats', {});
  return Object.entries(stats)
    .map(([id, data]) => {
      let total = data.total || 0;
      if (data.startTime) total += Date.now() - data.startTime;
      return { id, total };
    })
    .sort((a, b) => b.total - a.total)
    .slice(0, limit);
}

function trackStreamStart(guildId, userId, channelId) {
  const db = getGuildDb(guildId);
  let stats = db.get('streamStats', null);
  if (!stats) { stats = {}; db.set('streamStats', stats); }
  if (!stats[userId]) stats[userId] = { total: 0, channels: {} };
  if (!stats[userId].channels[channelId]) stats[userId].channels[channelId] = 0;
  stats[userId].startTime = Date.now();
  db.set('streamStats', stats);
}

function trackStreamStop(guildId, userId, channelId) {
  const db = getGuildDb(guildId);
  const stats = db.get('streamStats', {});
  if (!stats[userId]) return;
  const startTime = stats[userId].startTime;
  if (!startTime) return;
  const duration = Date.now() - startTime;
  stats[userId].total += duration;
  if (!stats[userId].channels[channelId]) stats[userId].channels[channelId] = 0;
  stats[userId].channels[channelId] += duration;
  stats[userId].startTime = null;
  db.set('streamStats', stats);
}

function getStreamStats(guildId, userId) {
  const db = getGuildDb(guildId);
  const stats = db.get('streamStats', {});
  const userStats = stats[userId] || { total: 0, channels: {} };
  if (userStats.startTime) {
    userStats.total += Date.now() - userStats.startTime;
  }
  return userStats;
}

function getTopStreamUsers(guildId, limit = 10) {
  const db = getGuildDb(guildId);
  const stats = db.get('streamStats', {});
  return Object.entries(stats)
    .map(([id, data]) => {
      let total = data.total || 0;
      if (data.startTime) total += Date.now() - data.startTime;
      return { id, total };
    })
    .sort((a, b) => b.total - a.total)
    .slice(0, limit);
}

// ══════════════════════════════════════════════════════════
// FORMATTERS
// ══════════════════════════════════════════════════════════

function formatDuration(ms) {
  const s = Math.floor(ms / 1000);
  const m = Math.floor(s / 60);
  const h = Math.floor(m / 60);
  const d = Math.floor(h / 24);
  const parts = [];
  if (d > 0) parts.push(`${d}d`);
  if (h % 24 > 0) parts.push(`${h % 24}h`);
  if (m % 60 > 0) parts.push(`${m % 60}m`);
  if (s % 60 > 0 || parts.length === 0) parts.push(`${s % 60}s`);
  return parts.join(' ');
}

function formatNumber(n) {
  return n.toLocaleString('en-US');
}

// ══════════════════════════════════════════════════════════
// COMMANDS
// ══════════════════════════════════════════════════════════

async function handleMessageStats(message, args) {
  const target = message.mentions.users.first() || message.author;
  const stats = getMessageStats(message.guild.id, target.id);
  const top = getTopMessageUsers(message.guild.id, 10);
  const rank = top.findIndex(u => u.id === target.id) + 1;

  const embed = new EmbedBuilder()
    .setColor('#5865F2')
    .setTitle(`Message Stats — ${target.username}`)
    .setDescription(`**Total Messages:** ${formatNumber(stats.total)}\n**Server Rank:** ${rank ? `#${rank}` : 'Unranked'}`)
    .setFooter({ text: 'Tracking since bot joined' })
    .setTimestamp();

  if (Object.keys(stats.channels).length > 0) {
    const topChannels = Object.entries(stats.channels)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 5)
      .map(([id, count]) => {
        const ch = message.guild.channels.cache.get(id);
        return `• ${ch ? ch.toString() : 'Unknown'} — ${formatNumber(count)}`;
      })
      .join('\n');
    embed.addFields({ name: 'Top Channels', value: topChannels || 'None', inline: false });
  }

  return message.reply({ embeds: [embed] });
}

async function handleVoiceStats(message, args) {
  const target = message.mentions.users.first() || message.author;
  const stats = getVoiceStats(message.guild.id, target.id);
  const top = getTopVoiceUsers(message.guild.id, 10);
  const rank = top.findIndex(u => u.id === target.id) + 1;

  const embed = new EmbedBuilder()
    .setColor('#57F287')
    .setTitle(`Voice Stats — ${target.username}`)
    .setDescription(`**Total Time:** ${formatDuration(stats.total)}\n**Server Rank:** ${rank ? `#${rank}` : 'Unranked'}`)
    .setFooter({ text: 'Tracking since bot joined' })
    .setTimestamp();

  if (Object.keys(stats.channels).length > 0) {
    const topChannels = Object.entries(stats.channels)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 5)
      .map(([id, count]) => {
        const ch = message.guild.channels.cache.get(id);
        return `• ${ch ? ch.name : 'Unknown'} — ${formatDuration(count)}`;
      })
      .join('\n');
    embed.addFields({ name: 'Top Channels', value: topChannels || 'None', inline: false });
  }

  return message.reply({ embeds: [embed] });
}

async function handleCameraStats(message, args) {
  const target = message.mentions.users.first() || message.author;
  const stats = getCameraStats(message.guild.id, target.id);
  const top = getTopCameraUsers(message.guild.id, 10);
  const rank = top.findIndex(u => u.id === target.id) + 1;

  const embed = new EmbedBuilder()
    .setColor('#FEE75C')
    .setTitle(`Camera Stats — ${target.username}`)
    .setDescription(`**Total Time:** ${formatDuration(stats.total)}\n**Server Rank:** ${rank ? `#${rank}` : 'Unranked'}`)
    .setFooter({ text: 'Tracking since bot joined' })
    .setTimestamp();

  return message.reply({ embeds: [embed] });
}

async function handleStreamStats(message, args) {
  const target = message.mentions.users.first() || message.author;
  const stats = getStreamStats(message.guild.id, target.id);
  const top = getTopStreamUsers(message.guild.id, 10);
  const rank = top.findIndex(u => u.id === target.id) + 1;

  const embed = new EmbedBuilder()
    .setColor('#EB459E')
    .setTitle(`Stream Stats — ${target.username}`)
    .setDescription(`**Total Time:** ${formatDuration(stats.total)}\n**Server Rank:** ${rank ? `#${rank}` : 'Unranked'}`)
    .setFooter({ text: 'Tracking since bot joined' })
    .setTimestamp();

  return message.reply({ embeds: [embed] });
}

async function handleStatsTop(message, args) {
  const type = args[0]?.toLowerCase() || 'messages';
  const limit = Math.min(parseInt(args[1]) || 10, 25);

  let topUsers, title, color;
  if (type === 'voice') {
    topUsers = getTopVoiceUsers(message.guild.id, limit);
    title = 'Top Voice Users';
    color = '#57F287';
  } else if (type === 'camera') {
    topUsers = getTopCameraUsers(message.guild.id, limit);
    title = 'Top Camera Users';
    color = '#FEE75C';
  } else if (type === 'stream') {
    topUsers = getTopStreamUsers(message.guild.id, limit);
    title = 'Top Stream Users';
    color = '#EB459E';
  } else {
    topUsers = getTopMessageUsers(message.guild.id, limit);
    title = 'Top Message Users';
    color = '#5865F2';
  }

  let desc = '';
  for (let i = 0; i < topUsers.length; i++) {
    const u = topUsers[i];
    const member = await message.guild.members.fetch(u.id).catch(() => null);
    const name = member ? member.user.username : 'Unknown';
    const value = type === 'messages' ? formatNumber(u.total) : formatDuration(u.total);
    const medal = i === 0 ? '🥇' : i === 1 ? '🥈' : i === 2 ? '🥉' : `${i + 1}.`;
    desc += `${medal} **${name}** — ${value}\n`;
  }

  const embed = new EmbedBuilder()
    .setColor(color)
    .setTitle(title)
    .setDescription(desc || 'No data yet.')
    .setFooter({ text: `Top ${limit} users` })
    .setTimestamp();

  return message.reply({ embeds: [embed] });
}

async function handleStatsReset(message, args) {
  if (!isStaffOrAdmin(message.member)) {
    return message.reply(mkError('You need staff or admin permissions.'));
  }

  const type = args[0]?.toLowerCase();
  const target = message.mentions.users.first();

  if (!target) {
    return message.reply(mkError('Mention a user to reset stats for.'));
  }

  const db = getGuildDb(message.guild.id);
  const validTypes = ['messages', 'voice', 'camera', 'stream'];

  if (!type || !validTypes.includes(type)) {
    return message.reply(mkInfo('Valid stats types', validTypes.map(t => `• ${t}`).join('\n')));
  }

  const keyMap = {
    messages: 'messageStats',
    voice: 'voiceStats',
    camera: 'cameraStats',
    stream: 'streamStats',
  };

  const key = keyMap[type];
  const stats = db.get(key, {});
  delete stats[target.id];
  db.set(key, stats);

  return message.reply(mkSuccess(`Reset ${type} stats for **${target.username}**.`));
}

// ══════════════════════════════════════════════════════════
// EXPORTS
// ══════════════════════════════════════════════════════════

module.exports = {
  trackMessage, getMessageStats, getTopMessageUsers,
  trackVoiceJoin, trackVoiceLeave, getVoiceStats, getTopVoiceUsers,
  trackCameraStart, trackCameraStop, getCameraStats, getTopCameraUsers,
  trackStreamStart, trackStreamStop, getStreamStats, getTopStreamUsers,
  handleMessageStats, handleVoiceStats, handleCameraStats, handleStreamStats,
  handleStatsTop, handleStatsReset,
  // Aliases for index.js compatibility
  handleVoiceTimeStats: handleVoiceStats,
  handleCameraTimeStats: handleCameraStats,
  handleStreamTimeStats: handleStreamStats,
  handleStatsClear: handleStatsReset,
  handleMessagesStats: handleMessageStats,
};