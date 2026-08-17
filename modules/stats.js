// ══════════════════════════════════════════════════════════
// STATS MODULE — v2.2 Clean Period Tracking
// ══════════════════════════════════════════════════════════

const { EmbedBuilder } = require('discord.js');
const { getGuildDb } = require('./database');
const { isStaffOrAdmin } = require('./helpers');
const { error: mkError, success: mkSuccess, info: mkInfo } = require('../utils/embeds');

// ══════════════════════════════════════════════════════════
// PERIOD HELPERS
// ══════════════════════════════════════════════════════════

function todayKey() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`;
}

function weekStart() {
  const d = new Date();
  const day = d.getDay(); // 0 = Sunday
  d.setDate(d.getDate() - day);
  d.setHours(0, 0, 0, 0);
  return d.getTime();
}

function monthKey() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}`;
}

function freshPeriods() {
  return {
    today: { date: todayKey(), total: 0, channels: {} },
    week:  { start: weekStart(), total: 0, channels: {} },
    month: { month: monthKey(), total: 0, channels: {} },
  };
}

function ensurePeriods(userStats) {
  if (!userStats) userStats = {};
  if (!userStats.periods) userStats.periods = freshPeriods();
  const p = userStats.periods;
  // Reset today if date changed
  if (p.today.date !== todayKey()) {
    p.today = { date: todayKey(), total: 0, channels: {} };
  }
  // Reset week if week start changed
  if (p.week.start !== weekStart()) {
    p.week = { start: weekStart(), total: 0, channels: {} };
  }
  // Reset month if month changed
  if (p.month.month !== monthKey()) {
    p.month = { month: monthKey(), total: 0, channels: {} };
  }
  return userStats;
}

function bump(userStats, channelId, amount) {
  ensurePeriods(userStats);
  // Legacy total (kept for compatibility, not displayed)
  userStats.total = (userStats.total || 0) + amount;
  // Legacy channels (kept for compatibility)
  if (!userStats.channels) userStats.channels = {};
  userStats.channels[channelId] = (userStats.channels[channelId] || 0) + amount;
  // Period buckets
  const p = userStats.periods;
  p.today.total += amount;
  p.today.channels[channelId] = (p.today.channels[channelId] || 0) + amount;
  p.week.total += amount;
  p.week.channels[channelId] = (p.week.channels[channelId] || 0) + amount;
  p.month.total += amount;
  p.month.channels[channelId] = (p.month.channels[channelId] || 0) + amount;
}

// ══════════════════════════════════════════════════════════
// FORMATTERS
// ══════════════════════════════════════════════════════════

function fmtDur(ms) {
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

function fmtNum(n) {
  return (n || 0).toLocaleString('en-US');
}

function topCh(channels, guild, limit = 5) {
  return Object.entries(channels || {})
    .sort((a, b) => b[1] - a[1])
    .slice(0, limit)
    .map(([id, count]) => {
      const ch = guild.channels.cache.get(id);
      return { name: ch ? (ch.name || ch.toString()) : 'Unknown', count };
    });
}

// ══════════════════════════════════════════════════════════
// MESSAGE TRACKING
// ══════════════════════════════════════════════════════════

function trackMessage(guildId, userId, channelId) {
  const db = getGuildDb(guildId);
  let stats = db.get('messageStats', null);
  if (!stats) { stats = {}; db.set('messageStats', stats); }
  if (!stats[userId]) stats[userId] = { total: 0, channels: {} };
  bump(stats[userId], channelId, 1);
  db.set('messageStats', stats);
}

function getMessageStats(guildId, userId) {
  const db = getGuildDb(guildId);
  const stats = db.get('messageStats', {});
  const s = stats[userId] ? JSON.parse(JSON.stringify(stats[userId])) : { total: 0, channels: {} };
  ensurePeriods(s);
  return s;
}

function getTopMessageUsers(guildId, limit = 10) {
  const db = getGuildDb(guildId);
  const stats = db.get('messageStats', {});
  return Object.entries(stats)
    .map(([id, data]) => {
      const d = data && data.periods ? JSON.parse(JSON.stringify(data)) : { total: 0, periods: freshPeriods() };
      ensurePeriods(d);
      return { id, total: d.periods.today.total };
    })
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
  stats[userId].joinTime = Date.now();
  stats[userId].currentChannel = channelId;
  db.set('voiceStats', stats);
}

function trackVoiceLeave(guildId, userId, channelId) {
  const db = getGuildDb(guildId);
  const stats = db.get('voiceStats', {});
  if (!stats[userId]) return;
  const joinTime = stats[userId].joinTime;
  if (!joinTime) return;
  const duration = Date.now() - joinTime;
  bump(stats[userId], channelId, duration);
  stats[userId].joinTime = null;
  stats[userId].currentChannel = null;
  db.set('voiceStats', stats);
}

function getVoiceStats(guildId, userId) {
  const db = getGuildDb(guildId);
  const stats = db.get('voiceStats', {});
  const s = stats[userId] ? JSON.parse(JSON.stringify(stats[userId])) : { total: 0, channels: {} };
  ensurePeriods(s);
  // Add ongoing session to display copy only (don't save)
  if (s.joinTime && s.currentChannel) {
    const ongoing = Date.now() - s.joinTime;
    bump(s, s.currentChannel, ongoing);
  }
  return s;
}

function getTopVoiceUsers(guildId, limit = 10) {
  const db = getGuildDb(guildId);
  const stats = db.get('voiceStats', {});
  return Object.entries(stats)
    .map(([id, data]) => {
      const d = data && data.periods ? JSON.parse(JSON.stringify(data)) : { total: 0, periods: freshPeriods() };
      ensurePeriods(d);
      let total = d.periods.today.total;
      if (d.joinTime) total += Date.now() - d.joinTime;
      return { id, total };
    })
    .sort((a, b) => b.total - a.total)
    .slice(0, limit);
}

// ══════════════════════════════════════════════════════════
// CAMERA TRACKING
// ══════════════════════════════════════════════════════════

function trackCameraStart(guildId, userId, channelId) {
  const db = getGuildDb(guildId);
  let stats = db.get('cameraStats', null);
  if (!stats) { stats = {}; db.set('cameraStats', stats); }
  if (!stats[userId]) stats[userId] = { total: 0, channels: {} };
  stats[userId].startTime = Date.now();
  stats[userId].currentChannel = channelId;
  db.set('cameraStats', stats);
}

function trackCameraStop(guildId, userId, channelId) {
  const db = getGuildDb(guildId);
  const stats = db.get('cameraStats', {});
  if (!stats[userId]) return;
  const startTime = stats[userId].startTime;
  if (!startTime) return;
  const duration = Date.now() - startTime;
  bump(stats[userId], channelId, duration);
  stats[userId].startTime = null;
  stats[userId].currentChannel = null;
  db.set('cameraStats', stats);
}

function getCameraStats(guildId, userId) {
  const db = getGuildDb(guildId);
  const stats = db.get('cameraStats', {});
  const s = stats[userId] ? JSON.parse(JSON.stringify(stats[userId])) : { total: 0, channels: {} };
  ensurePeriods(s);
  if (s.startTime && s.currentChannel) {
    const ongoing = Date.now() - s.startTime;
    bump(s, s.currentChannel, ongoing);
  }
  return s;
}

function getTopCameraUsers(guildId, limit = 10) {
  const db = getGuildDb(guildId);
  const stats = db.get('cameraStats', {});
  return Object.entries(stats)
    .map(([id, data]) => {
      const d = data && data.periods ? JSON.parse(JSON.stringify(data)) : { total: 0, periods: freshPeriods() };
      ensurePeriods(d);
      let total = d.periods.today.total;
      if (d.startTime) total += Date.now() - d.startTime;
      return { id, total };
    })
    .sort((a, b) => b.total - a.total)
    .slice(0, limit);
}

// ══════════════════════════════════════════════════════════
// STREAM TRACKING
// ══════════════════════════════════════════════════════════

function trackStreamStart(guildId, userId, channelId) {
  const db = getGuildDb(guildId);
  let stats = db.get('streamStats', null);
  if (!stats) { stats = {}; db.set('streamStats', stats); }
  if (!stats[userId]) stats[userId] = { total: 0, channels: {} };
  stats[userId].startTime = Date.now();
  stats[userId].currentChannel = channelId;
  db.set('streamStats', stats);
}

function trackStreamStop(guildId, userId, channelId) {
  const db = getGuildDb(guildId);
  const stats = db.get('streamStats', {});
  if (!stats[userId]) return;
  const startTime = stats[userId].startTime;
  if (!startTime) return;
  const duration = Date.now() - startTime;
  bump(stats[userId], channelId, duration);
  stats[userId].startTime = null;
  stats[userId].currentChannel = null;
  db.set('streamStats', stats);
}

function getStreamStats(guildId, userId) {
  const db = getGuildDb(guildId);
  const stats = db.get('streamStats', {});
  const s = stats[userId] ? JSON.parse(JSON.stringify(stats[userId])) : { total: 0, channels: {} };
  ensurePeriods(s);
  if (s.startTime && s.currentChannel) {
    const ongoing = Date.now() - s.startTime;
    bump(s, s.currentChannel, ongoing);
  }
  return s;
}

function getTopStreamUsers(guildId, limit = 10) {
  const db = getGuildDb(guildId);
  const stats = db.get('streamStats', {});
  return Object.entries(stats)
    .map(([id, data]) => {
      const d = data && data.periods ? JSON.parse(JSON.stringify(data)) : { total: 0, periods: freshPeriods() };
      ensurePeriods(d);
      let total = d.periods.today.total;
      if (d.startTime) total += Date.now() - d.startTime;
      return { id, total };
    })
    .sort((a, b) => b.total - a.total)
    .slice(0, limit);
}

// ══════════════════════════════════════════════════════════
// EMBED BUILDER — Clean, Today/Week/Month only
// ══════════════════════════════════════════════════════════

function buildEmbed(title, color, stats, guild, isDuration, liveText) {
  const p = stats.periods || freshPeriods();
  const todayVal = isDuration ? fmtDur(p.today.total) : fmtNum(p.today.total);
  const weekVal  = isDuration ? fmtDur(p.week.total)  : fmtNum(p.week.total);
  const monthVal = isDuration ? fmtDur(p.month.total) : fmtNum(p.month.total);

  const fields = [
    { name: '📊 Today',   value: todayVal, inline: true },
    { name: '📅 This Week', value: weekVal,  inline: true },
    { name: '📆 This Month', value: monthVal, inline: true },
  ];

  if (liveText) {
    fields.push({ name: '🔴 Live Session', value: liveText, inline: false });
  }

  // Top channels for TODAY
  const chToday = topCh(p.today.channels, guild, 5);
  if (chToday.length) {
    const chText = chToday.map(c => `• ${c.name} — ${isDuration ? fmtDur(c.count) : fmtNum(c.count)}`).join('\n');
    fields.push({ name: 'Top Channels (Today)', value: chText, inline: false });
  }

  return new EmbedBuilder()
    .setColor(color)
    .setTitle(title)
    .addFields(fields)
    .setFooter({ text: 'Periods reset at midnight / Sunday / month start' })
    .setTimestamp();
}

// ══════════════════════════════════════════════════════════
// COMMANDS
// ══════════════════════════════════════════════════════════

async function handleMessageStats(message, args) {
  try {
    const target = message.mentions.users.first() || message.author;
    const stats = getMessageStats(message.guild.id, target.id);
    const embed = buildEmbed(
      `Message Stats — ${target.username}`,
      '#5865F2',
      stats,
      message.guild,
      false,
      null
    );
    return message.reply({ embeds: [embed] });
  } catch (e) {
    console.error('[stats] handleMessageStats error:', e);
    return message.reply(mkError('Failed to load message stats.'));
  }
}

async function handleVoiceStats(message, args) {
  try {
    const target = message.mentions.users.first() || message.author;
    const stats = getVoiceStats(message.guild.id, target.id);
    const live = (stats.joinTime && stats.currentChannel)
      ? `In **${message.guild.channels.cache.get(stats.currentChannel)?.name || 'Unknown'}** — ${fmtDur(Date.now() - stats.joinTime)} ongoing`
      : null;
    const embed = buildEmbed(
      `Voice Stats — ${target.username}`,
      '#57F287',
      stats,
      message.guild,
      true,
      live
    );
    return message.reply({ embeds: [embed] });
  } catch (e) {
    console.error('[stats] handleVoiceStats error:', e);
    return message.reply(mkError('Failed to load voice stats.'));
  }
}

async function handleCameraStats(message, args) {
  try {
    const target = message.mentions.users.first() || message.author;
    const stats = getCameraStats(message.guild.id, target.id);
    const live = (stats.startTime && stats.currentChannel)
      ? `On camera in **${message.guild.channels.cache.get(stats.currentChannel)?.name || 'Unknown'}** — ${fmtDur(Date.now() - stats.startTime)} ongoing`
      : null;
    const embed = buildEmbed(
      `Camera Stats — ${target.username}`,
      '#FEE75C',
      stats,
      message.guild,
      true,
      live
    );
    return message.reply({ embeds: [embed] });
  } catch (e) {
    console.error('[stats] handleCameraStats error:', e);
    return message.reply(mkError('Failed to load camera stats.'));
  }
}

async function handleStreamStats(message, args) {
  try {
    const target = message.mentions.users.first() || message.author;
    const stats = getStreamStats(message.guild.id, target.id);
    const live = (stats.startTime && stats.currentChannel)
      ? `Streaming in **${message.guild.channels.cache.get(stats.currentChannel)?.name || 'Unknown'}** — ${fmtDur(Date.now() - stats.startTime)} ongoing`
      : null;
    const embed = buildEmbed(
      `Stream Stats — ${target.username}`,
      '#EB459E',
      stats,
      message.guild,
      true,
      live
    );
    return message.reply({ embeds: [embed] });
  } catch (e) {
    console.error('[stats] handleStreamStats error:', e);
    return message.reply(mkError('Failed to load stream stats.'));
  }
}

async function handleStatsTop(message, args) {
  try {
    const type = args[0]?.toLowerCase() || 'messages';
    const limit = Math.min(parseInt(args[1]) || 10, 25);

    let topUsers, title, color, isDuration;
    if (type === 'voice') {
      topUsers = getTopVoiceUsers(message.guild.id, limit);
      title = 'Top Voice Users (Today)';
      color = '#57F287';
      isDuration = true;
    } else if (type === 'camera') {
      topUsers = getTopCameraUsers(message.guild.id, limit);
      title = 'Top Camera Users (Today)';
      color = '#FEE75C';
      isDuration = true;
    } else if (type === 'stream') {
      topUsers = getTopStreamUsers(message.guild.id, limit);
      title = 'Top Stream Users (Today)';
      color = '#EB459E';
      isDuration = true;
    } else {
      topUsers = getTopMessageUsers(message.guild.id, limit);
      title = 'Top Message Users (Today)';
      color = '#5865F2';
      isDuration = false;
    }

    let desc = '';
    for (let i = 0; i < topUsers.length; i++) {
      const u = topUsers[i];
      const member = await message.guild.members.fetch(u.id).catch(() => null);
      const name = member ? member.user.username : 'Unknown';
      const value = isDuration ? fmtDur(u.total) : fmtNum(u.total);
      const medal = i === 0 ? '🥇' : i === 1 ? '🥈' : i === 2 ? '🥉' : `${i + 1}.`;
      desc += `${medal} **${name}** — ${value}\n`;
    }

    const embed = new EmbedBuilder()
      .setColor(color)
      .setTitle(title)
      .setDescription(desc || 'No data yet.')
      .setFooter({ text: `Top ${limit} • Today` })
      .setTimestamp();

    return message.reply({ embeds: [embed] });
  } catch (e) {
    console.error('[stats] handleStatsTop error:', e);
    return message.reply(mkError('Failed to load leaderboard.'));
  }
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