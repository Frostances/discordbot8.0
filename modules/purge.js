/**
 * purge.js — full-featured message purge system
 * Max: 10,000 messages. Loops in batches of 100 with rate-limit protection.
 */

const BULK_MAX = 100;
const RATE_DELAY = 1100;

function isBulkable(msg) {
    return Date.now() - msg.createdTimestamp < 13.9 * 24 * 60 * 60 * 1000;
}

// ══════════════════════════════════════════════════════════
//  CORE EXECUTOR
// ══════════════════════════════════════════════════════════
async function executePurge(ctx, channel, limit, filterFn) {
    // Try to delete the invoking message silently
    try {
        if (ctx.deletable && ctx.delete) await ctx.delete();
    } catch {}

    const hardMax = Math.min(limit, 10000);
    let totalDeleted = 0;
    let lastId = null;

    while (totalDeleted < hardMax) {
        const remaining = hardMax - totalDeleted;
        const fetchLimit = Math.min(BULK_MAX, remaining + (filterFn ? 50 : 0));
        const opts = { limit: Math.min(fetchLimit, 100) };
        if (lastId) opts.before = lastId;

        let msgs;
        try {
            msgs = await channel.messages.fetch(opts);
        } catch {
            break;
        }
        if (!msgs.size) break;

        lastId = msgs.last().id;

        // Apply filter if provided
        let batch = msgs;
        if (filterFn) {
            batch = msgs.filter(filterFn);
        }

        // Filter out messages older than 14 days (Discord bulk-delete limit)
        const deletable = batch.filter(isBulkable);

        if (deletable.size) {
            // Only delete up to what we still need
            const toDelete = deletable.first(Math.min(BULK_MAX, remaining));
            try {
                const deleted = await channel.bulkDelete(toDelete, true);
                totalDeleted += deleted.size;
            } catch (err) {
                console.error('[Purge] bulkDelete failed:', err.message);
                // Fallback: try deleting one by one
                for (const [, m] of toDelete) {
                    try { await m.delete(); totalDeleted++; } catch {}
                }
            }
        }

        if (msgs.size < opts.limit) break;
        if (totalDeleted < hardMax) await new Promise(r => setTimeout(r, RATE_DELAY));
    }

    return totalDeleted;
}

// ══════════════════════════════════════════════════════════
//  NAMED FILTERS
// ══════════════════════════════════════════════════════════
const NAMED = {
    bots:       m => m.author?.bot,
    humans:     m => !m.author?.bot,
    links:      m => /https?:\/\//i.test(m.content),
    embeds:     m => m.embeds.length > 0,
    files:      m => m.attachments.size > 0,
    images:     m => [...m.attachments.values()].some(a => a.contentType?.startsWith('image/')),
    emoji:      m => /<a?:\w+:\d+>/u.test(m.content) || /\p{Emoji_Presentation}/u.test(m.content),
    emotes:     m => /<a?:\w+:\d+>/u.test(m.content),
    stickers:   m => m.stickers.size > 0,
    mentions:   m => m.mentions.users.size > 0 || m.mentions.roles.size > 0 || m.mentions.everyone,
    activity:   m => m.system || m.type !== 0,
};

// ══════════════════════════════════════════════════════════
//  MAIN PURGE HANDLER
// ══════════════════════════════════════════════════════════
async function handlePurge(ctx, args) {
    const { isStaffOrAdmin, hasDiscordPerm } = require('./helpers');
    if (!isStaffOrAdmin(ctx.member) && !hasDiscordPerm(ctx.member, 'ManageMessages')) {
        return ctx.reply?.({ content: '❌ You need **Manage Messages** or staff/admin permissions.', ephemeral: true })
            || ctx.channel?.send('❌ You need **Manage Messages** or staff/admin permissions.');
    }

    const channel = ctx.channel;
    const sub = args[0]?.toLowerCase();
    const amount = parseInt(args[0]);

    // ── .purge <number> ──
    if (!isNaN(amount) && amount > 0) {
        const deleted = await executePurge(ctx, channel, amount, null);
        if (deleted === 0) {
            return ctx.reply?.({ content: '❌ No messages could be deleted. They may be older than 14 days.', ephemeral: true })
                || channel.send('❌ No messages could be deleted. They may be older than 14 days.');
        }
        return;
    }

    // ── .purge @user [amount] ──
    if (ctx.mentions?.users?.size) {
        const target = ctx.mentions.users.first();
        const n = parseInt(args.find(a => /^\d+$/.test(a))) || 100;
        const deleted = await executePurge(ctx, channel, n, m => m.author?.id === target.id);
        if (deleted === 0) {
            return ctx.reply?.({ content: `❌ No messages from ${target} could be deleted.`, ephemeral: true })
                || channel.send(`❌ No messages from ${target} could be deleted.`);
        }
        return;
    }

    // ── .purge reactions [amount] ──
    if (sub === 'reactions') {
        try { if (ctx.deletable) await ctx.delete(); } catch {}
        const n = parseInt(args[1]) || 50;
        try {
            const msgs = await channel.messages.fetch({ limit: Math.min(n, 100) });
            for (const [, m] of msgs) {
                if (m.reactions.cache.size > 0) await m.reactions.removeAll().catch(() => {});
            }
        } catch (err) {
            return channel.send('❌ Could not remove reactions.').catch(() => {});
        }
        return;
    }

    // ── .purge upto <msgId> ──
    if (sub === 'upto') {
        const msgId = args[1];
        if (!msgId?.match(/^\d+$/)) {
            return ctx.reply?.({ content: '❌ Provide a message ID: `,purge upto <id>`', ephemeral: true })
                || channel.send('❌ Provide a message ID: `,purge upto <id>`');
        }
        try { if (ctx.deletable) await ctx.delete(); } catch {}
        try {
            const msgs = await channel.messages.fetch({ limit: 100 });
            const idx = [...msgs.keys()].indexOf(msgId);
            if (idx === -1) {
                return channel.send('❌ Message ID not found in the last 100 messages.').catch(() => {});
            }
            const toDelete = msgs.filter((m, i) => i < idx && isBulkable(m));
            if (toDelete.size) await channel.bulkDelete(toDelete, true);
        } catch (err) {
            return channel.send(`❌ Failed: ${err.message}`).catch(() => {});
        }
        return;
    }

    // ── .purge before <msgId> [amount] ──
    if (sub === 'before') {
        const msgId = args[1];
        if (!msgId?.match(/^\d+$/)) {
            return ctx.reply?.({ content: '❌ Provide a message ID.', ephemeral: true })
                || channel.send('❌ Provide a message ID.');
        }
        const n = parseInt(args[2]) || 50;
        try { if (ctx.deletable) await ctx.delete(); } catch {}
        try {
            const msgs = await channel.messages.fetch({ limit: Math.min(n, BULK_MAX), before: msgId });
            const bulk = msgs.filter(isBulkable);
            if (bulk.size) await channel.bulkDelete(bulk, true);
        } catch (err) {
            return channel.send(`❌ Failed: ${err.message}`).catch(() => {});
        }
        return;
    }

    // ── .purge after <msgId> [amount] ──
    if (sub === 'after') {
        const msgId = args[1];
        if (!msgId?.match(/^\d+$/)) {
            return ctx.reply?.({ content: '❌ Provide a message ID.', ephemeral: true })
                || channel.send('❌ Provide a message ID.');
        }
        const n = parseInt(args[2]) || 50;
        try { if (ctx.deletable) await ctx.delete(); } catch {}
        try {
            const msgs = await channel.messages.fetch({ limit: Math.min(n, BULK_MAX), after: msgId });
            const bulk = msgs.filter(isBulkable);
            if (bulk.size) await channel.bulkDelete(bulk, true);
        } catch (err) {
            return channel.send(`❌ Failed: ${err.message}`).catch(() => {});
        }
        return;
    }

    // ── .purge between <msgId1> <msgId2> ──
    if (sub === 'between') {
        const id1 = args[1], id2 = args[2];
        if (!id1?.match(/^\d+$/) || !id2?.match(/^\d+$/)) {
            return ctx.reply?.({ content: '❌ Usage: `,purge between <msgId1> <msgId2>`', ephemeral: true })
                || channel.send('❌ Usage: `,purge between <msgId1> <msgId2>`');
        }
        try { if (ctx.deletable) await ctx.delete(); } catch {}
        try {
            const minId = BigInt(id1) < BigInt(id2) ? BigInt(id1) : BigInt(id2);
            const maxId = BigInt(id1) < BigInt(id2) ? BigInt(id2) : BigInt(id1);
            const msgs = await channel.messages.fetch({ limit: BULK_MAX, after: String(minId) });
            const range = msgs.filter((m, id) => {
                const bid = BigInt(id);
                return bid > minId && bid < maxId && isBulkable(m);
            });
            if (range.size) await channel.bulkDelete(range, true);
        } catch (err) {
            return channel.send(`❌ Failed: ${err.message}`).catch(() => {});
        }
        return;
    }

    // ── .purge contains <amount> <text> ──
    if (sub === 'contains') {
        const n = parseInt(args[1]) || 100;
        const text = args.slice(2).join(' ').toLowerCase();
        if (!text) {
            return ctx.reply?.({ content: '❌ Usage: `,purge contains <amount> <text>`', ephemeral: true })
                || channel.send('❌ Usage: `,purge contains <amount> <text>`');
        }
        const deleted = await executePurge(ctx, channel, n, m => m.content.toLowerCase().includes(text));
        if (deleted === 0) {
            return channel.send('❌ No matching messages found or they are too old.').catch(() => {});
        }
        return;
    }

    // ── .purge startswith <amount> <text> ──
    if (sub === 'startswith') {
        const n = parseInt(args[1]) || 100;
        const text = args.slice(2).join(' ').toLowerCase();
        if (!text) {
            return ctx.reply?.({ content: '❌ Usage: `,purge startswith <amount> <text>`', ephemeral: true })
                || channel.send('❌ Usage: `,purge startswith <amount> <text>`');
        }
        const deleted = await executePurge(ctx, channel, n, m => m.content.toLowerCase().startsWith(text));
        if (deleted === 0) {
            return channel.send('❌ No matching messages found or they are too old.').catch(() => {});
        }
        return;
    }

    // ── .purge endswith <amount> <text> ──
    if (sub === 'endswith') {
        const n = parseInt(args[1]) || 100;
        const text = args.slice(2).join(' ').toLowerCase();
        if (!text) {
            return ctx.reply?.({ content: '❌ Usage: `,purge endswith <amount> <text>`', ephemeral: true })
                || channel.send('❌ Usage: `,purge endswith <amount> <text>`');
        }
        const deleted = await executePurge(ctx, channel, n, m => m.content.toLowerCase().endsWith(text));
        if (deleted === 0) {
            return channel.send('❌ No matching messages found or they are too old.').catch(() => {});
        }
        return;
    }

    // ── Named simple filters ──
    if (sub && NAMED[sub]) {
        const n = parseInt(args[1]) || 100;
        const deleted = await executePurge(ctx, channel, n, NAMED[sub]);
        if (deleted === 0) {
            return channel.send(`❌ No ${sub} messages found or they are too old.`).catch(() => {});
        }
        return;
    }

    // ── Usage ──
    const { base, COLORS } = require('../utils/embeds');
    const replyFn = ctx.reply?.bind(ctx) || channel.send.bind(channel);
    return replyFn({ embeds: [base(COLORS.primary).setTitle('🗑️ Purge Commands')
        .setDescription([
            '**Basic:**',
            '`,purge <amount>` — delete last N messages (max 10,000)',
            '`,purge @user [amount]` — delete messages from a user',
            '',
            '**Filters:**',
            '`,purge bots` `,purge humans` `,purge links` `,purge embeds`',
            '`,purge files` `,purge images` `,purge emoji` `,purge emotes`',
            '`,purge stickers` `,purge mentions` `,purge reactions` `,purge activity`',
            '',
            '**Text:**',
            '`,purge contains <n> <text>` `,purge startswith <n> <text>` `,purge endswith <n> <text>`',
            '',
            '**By Position:**',
            '`,purge upto <msgId>` `,purge before <msgId> [n]`',
            '`,purge after <msgId> [n]` `,purge between <id1> <id2>`',
        ].join('\n'))] });
}

module.exports = { handlePurge, executePurge };