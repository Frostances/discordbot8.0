// ══════════════════════════════════════════════════════════
// ECONOMY SHOP MODULE — v2.0
// ══════════════════════════════════════════════════════════

const { EmbedBuilder } = require('discord.js');
const { getEconomy, getUserEconomy, isEconomyEnabled, addCredits, removeCredits, saveEconomy, formatNumber, makeEmbed } = require('./economy');
const { hasDiscordPerm } = require('./helpers');
const { error: err, success: ok } = require('../utils/embeds');

// ══════════════════════════════════════════════════════════
// COMMANDS: SHOP
// ══════════════════════════════════════════════════════════

async function handleShop(message, args) {
  if (!isEconomyEnabled(message.guild.id)) return message.reply(err('Economy is not enabled.'));
  const guildId = message.guild.id;
  const ec = getEconomy(guildId);
  const sub = args[0]?.toLowerCase();

  if (sub === 'add') {
    if (!hasDiscordPerm(message.member, 'ManageGuild')) return message.reply(err('You need **Manage Server** permission.'));
    const name = args[1];
    const price = parseInt(args[2]);
    const role = message.mentions.roles.first();
    const description = args.slice(role ? 4 : 3).join(' ') || 'No description';

    if (!name || isNaN(price) || price <= 0) {
      return message.reply(err('Usage: `,shop add <name> <price> [@role] [description]`'));
    }

    ec.shop.push({ name, price, role: role ? role.id : null, description });
    saveEconomy(guildId, ec);
    return message.reply(ok(`Added **${name}** to the shop for **${formatNumber(price)}** ${ec.currencyName}.`));
  }

  if (sub === 'remove') {
    if (!hasDiscordPerm(message.member, 'ManageGuild')) return message.reply(err('You need **Manage Server** permission.'));
    const name = args.slice(1).join(' ');
    if (!name) return message.reply(err('Usage: `,shop remove <name>`'));

    const idx = ec.shop.findIndex(i => i.name.toLowerCase() === name.toLowerCase());
    if (idx === -1) return message.reply(err(`Item **${name}** not found.`));

    ec.shop.splice(idx, 1);
    saveEconomy(guildId, ec);
    return message.reply(ok(`Removed **${name}** from the shop.`));
  }

  if (sub === 'buy') {
    return handleBuy(message, args.slice(1));
  }

  // Default: list shop
  if (!ec.shop.length) {
    return message.reply(err('The shop is empty. Staff can add items with `,shop add`.'));
  }

  let desc = '';
  for (const item of ec.shop) {
    desc += `**${item.name}** — ${formatNumber(item.price)} ${ec.currencyName}\n${item.description}\n`;
    if (item.role) {
      const role = message.guild.roles.cache.get(item.role);
      if (role) desc += `Includes role: ${role.toString()}\n`;
    }
    desc += '\n';
  }

  const embed = makeEmbed('Item Shop', desc, '#5865F2', `Use ,shop buy <item> to purchase`);
  return message.reply({ embeds: [embed] });
}

async function handleBuy(message, args) {
  if (!isEconomyEnabled(message.guild.id)) return message.reply(err('Economy is not enabled.'));
  const guildId = message.guild.id;
  const userId = message.author.id;
  const user = getUserEconomy(guildId, userId);
  const ec = getEconomy(guildId);

  const itemName = args.join(' ');
  if (!itemName) return message.reply(err('Usage: `,shop buy <item name>` or `,buy <item name>`'));

  const item = ec.shop.find(i => i.name.toLowerCase() === itemName.toLowerCase());
  if (!item) return message.reply(err(`Item **${itemName}** not found in the shop.`));
  if (user.wallet < item.price) return message.reply(err(`You need **${formatNumber(item.price)}** ${ec.currencyName}. You have **${formatNumber(user.wallet)}**.`));

  removeCredits(guildId, userId, item.price, 'shop_purchase');
  user.inventory.push({ name: item.name, boughtAt: Date.now() });

  if (item.role) {
    try {
      const member = await message.guild.members.fetch(userId);
      await member.roles.add(item.role);
    } catch {}
  }

  saveEconomy(guildId, ec);
  const embed = makeEmbed('Purchase Complete', `You bought **${item.name}** for **${formatNumber(item.price)}** ${ec.currencyName}.`, '#57F287', `Balance: ${formatNumber(user.wallet)}`);
  return message.reply({ embeds: [embed] });
}

async function handleInventory(message, args) {
  if (!isEconomyEnabled(message.guild.id)) return message.reply(err('Economy is not enabled.'));
  const target = message.mentions.users.first() || message.author;
  const user = getUserEconomy(message.guild.id, target.id);

  if (!user.inventory || !user.inventory.length) {
    return message.reply(err(`${target.id === message.author.id ? 'Your' : target.username + "'s"} inventory is empty.`));
  }

  const items = user.inventory.map(i => `• **${i.name}** — Bought <t:${Math.floor(i.boughtAt / 1000)}:R>`).join('\n');
  const embed = makeEmbed(`${target.username}'s Inventory`, items, '#5865F6', `${user.inventory.length} items`);
  return message.reply({ embeds: [embed] });
}

async function handleUse(message, args) {
  if (!isEconomyEnabled(message.guild.id)) return message.reply(err('Economy is not enabled.'));
  const guildId = message.guild.id;
  const userId = message.author.id;
  const user = getUserEconomy(guildId, userId);
  const ec = getEconomy(guildId);

  const itemName = args.join(' ');
  if (!itemName) return message.reply(err('Usage: `,use <item name>`'));

  const idx = user.inventory.findIndex(i => i.name.toLowerCase() === itemName.toLowerCase());
  if (idx === -1) return message.reply(err(`You don't have **${itemName}** in your inventory.`));

  user.inventory.splice(idx, 1);
  saveEconomy(guildId, ec);
  return message.reply(ok(`You used **${itemName}**.`));
}

module.exports = {
  handleShop, handleBuy, handleInventory, handleUse,
};