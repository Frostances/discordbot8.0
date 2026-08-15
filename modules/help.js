/**
 * Interactive command guide.
 */

const { EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle, StringSelectMenuBuilder, ModalBuilder, TextInputBuilder, TextInputStyle } = require('discord.js');
const { getAll } = require('../handlers/commandRegistry');
const { COLORS } = require('../utils/embeds');

const TIMEOUT = 120_000;
const SMALL_CATEGORY_LIMIT = 2;

const CATEGORY_META = {
  moderation:   { emoji: '🔨', label: 'Moderation' },
  security:     { emoji: '🛡️', label: 'Security' },
  staff:        { emoji: '👮', label: 'Staff' },
  leveling:     { emoji: '📊', label: 'Leveling' },
  ticketing:    { emoji: '🎫', label: 'Ticketing' },
  voicemaster:  { emoji: '🎙️', label: 'Voice' },
  configuration:{ emoji: '⚙️', label: 'Configuration' },
  info:         { emoji: '🔍', label: 'Info' },
  fun:          { emoji: '🎮', label: 'Fun' },
  utility:      { emoji: '🔧', label: 'Utility' },
  media:        { emoji: '🖼️', label: 'Media' },
  music:        { emoji: '🎵', label: 'Music' },
  economy:      { emoji: '💰', label: 'Economy' },
  server:       { emoji: '🏠', label: 'Server' },
  reaction:     { emoji: '👍', label: 'Reaction' },
  filter:       { emoji: '🧹', label: 'Filter' },
  roleplay:     { emoji: '🎭', label: 'Roleplay' },
  jail:         { emoji: '⛓️', label: 'Jail' },
  mute:         { emoji: '🔇', label: 'Mute' },
  nicknames:    { emoji: '📝', label: 'Nicknames' },
  giveaways:    { emoji: '🎁', label: 'Giveaways' },
};

const HELP_OVERRIDES = {
  antinuke: {
    helpOnBare: false,
    subcommands: [
      { name: 'setup', description: 'Review the AntiNuke setup and protection options.' },
      { name: 'list', description: 'View enabled protection modules and whitelist entries.' },
      { name: 'config', description: 'View the complete AntiNuke configuration.' },
      { name: 'admins', description: 'View AntiNuke administrators.' },
      { name: 'enable', description: 'Enable AntiNuke protection.' },
      { name: 'disable', description: 'Disable AntiNuke protection.' },
      { name: 'admin <@user>', description: 'Add or remove an AntiNuke administrator.' },
      { name: 'whitelist <@user>', description: 'Toggle a user in the AntiNuke whitelist.' },
      { name: 'log #channel', description: 'Set the AntiNuke log channel.' },
      { name: 'permissions [list|grant|remove|punishment] [permission|action]', description: 'Manage dangerous permission watches.' },
      { name: 'kick <on|off> [--threshold N] [--do ban|kick|strip] [--command on|off]', description: 'Protect against unauthorized kicks.' },
      { name: 'webhook <on|off> [--threshold N] [--do ban|kick|strip] [--command on|off]', description: 'Protect against webhook abuse.' },
      { name: 'emoji <on|off> [--threshold N] [--do ban|kick|strip] [--command on|off]', description: 'Protect against emoji abuse.' },
      { name: 'ban <on|off> [--threshold N] [--do ban|kick|strip] [--command on|off]', description: 'Protect against unauthorized bans.' },
      { name: 'channel <on|off> [--threshold N] [--do ban|kick|strip] [--command on|off]', description: 'Protect against channel abuse.' },
      { name: 'role <on|off> [--threshold N] [--do ban|kick|strip] [--command on|off]', description: 'Protect against role abuse.' },
      { name: 'vanity <on|off> [--do ban|kick|strip]', description: 'Protect the server vanity URL.' },
      { name: 'botadd <on|off>', description: 'Block unauthorized bot additions.' },
      { name: 'reset', description: 'Reset AntiNuke configuration to defaults.' },
      { name: 'restore', description: 'Restore AntiNuke after a disable.' },
    ],
  },
  antiraid: {
    helpOnBare: false,
    subcommands: [
      { name: 'config', description: 'View the current AntiRaid configuration.' },
      { name: 'state', description: 'Turn off the active raid state and unlock channels.' },
      { name: 'enable', description: 'Enable AntiRaid protection.' },
      { name: 'disable', description: 'Disable AntiRaid protection.' },
      { name: 'whitelist <@user>', description: 'Temporarily whitelist a user for their next join.' },
      { name: 'whitelist view', description: 'View current one-time whitelist entries.' },
      { name: 'whitelist clear', description: 'Clear all one-time whitelist entries.' },
      { name: 'lockdown <on|off>', description: 'Toggle server lockdown during a raid.' },
      { name: 'log #channel', description: 'Set the AntiRaid log channel.' },
      { name: 'massjoin <on|off> [--threshold N] [--do ban|kick] [--lock true|false] [--punish true|false]', description: 'Detect mass joins and optionally lock or punish.' },
      { name: 'newaccounts <on|off> [--threshold days] [--do ban|kick]', description: 'Block accounts newer than the configured age.' },
      { name: 'age <on|off> [--threshold days] [--do ban|kick]', description: 'Alias for newaccounts.' },
      { name: 'avatar <on|off> [--do ban|kick]', description: 'Block accounts without a profile avatar.' },
      { name: 'nolinks <on|off> [--do ban|kick]', description: 'Block accounts with no linked socials.' },
      { name: 'nospam <on|off> [--threshold N] [--do ban|kick]', description: 'Block spam-join patterns.' },
      { name: 'reset', description: 'Reset AntiRaid configuration to defaults.' },
    ],
  },
  automod: {
    helpOnBare: false,
    subcommands: [
      { name: 'enable', description: 'Enable AutoMod.' },
      { name: 'disable', description: 'Disable AutoMod.' },
      { name: 'config', description: 'View the complete AutoMod configuration.' },
      { name: 'spam', description: 'Toggle the spam filter.' },
      { name: 'caps', description: 'Toggle the caps filter.' },
      { name: 'invites', description: 'Toggle the invite filter.' },
      { name: 'links', description: 'Toggle the link filter.' },
      { name: 'mentions', description: 'Toggle the mention filter.' },
      { name: 'emoji', description: 'Toggle the emoji filter.' },
      { name: 'attachments', description: 'Toggle the attachment filter.' },
      { name: 'profanity', description: 'Toggle the profanity filter.' },
      { name: 'zalgo', description: 'Toggle the zalgo text filter.' },
      { name: 'repeated', description: 'Toggle the repeated text filter.' },
      { name: 'selfbot', description: 'Toggle the selfbot detection filter.' },
      { name: 'punishment <type> <action>', description: 'Set a punishment for an AutoMod filter type.' },
      { name: 'threshold <type> <number>', description: 'Set the threshold for an AutoMod filter type.' },
      { name: 'whitelist add #channel|@role', description: 'Add an AutoMod exemption.' },
      { name: 'whitelist remove #channel|@role', description: 'Remove an AutoMod exemption.' },
      { name: 'whitelist list', description: 'List all AutoMod exemptions.' },
      { name: 'logchannel #channel', description: 'Set the AutoMod log channel.' },
      { name: 'reset', description: 'Reset AutoMod configuration to defaults.' },
    ],
  },
  security: {
    helpOnBare: false,
    subcommands: [
      { name: 'config', description: 'View the complete Security configuration panel.' },
      { name: 'enable', description: 'Enable all security systems.' },
      { name: 'disable', description: 'Disable all security systems.' },
      { name: 'status', description: 'View security system status overview.' },
      { name: 'log #channel', description: 'Set the unified security log channel.' },
      { name: 'antinuke', description: 'Access AntiNuke subcommands.' },
      { name: 'antiraid', description: 'Access AntiRaid subcommands.' },
      { name: 'automod', description: 'Access AutoMod subcommands.' },
      { name: 'panic', description: 'Enable panic mode (lockdown + max protection).' },
      { name: 'unpanic', description: 'Disable panic mode.' },
    ],
  },
  levels: {
    helpOnBare: false,
    subcommands: [
      { name: '[@user]', description: "View your or a member's level, XP, and progress." },
      { name: 'rank [@user]', description: "View a member's level, XP, and progress." },
      { name: 'leaderboard [page]', description: 'View the XP leaderboard.' },
      { name: 'leaderboard rename <title>', description: 'Set the leaderboard embed title.' },
      { name: 'config', description: 'View server leveling configuration.' },
      { name: 'lock', description: 'Disable the leveling system.' },
      { name: 'unlock', description: 'Enable the leveling system.' },
      { name: 'setrate <multiplier>', description: 'Set the XP gain multiplier.' },
      { name: 'messages [on|off]', description: 'Toggle level-up messages for yourself.' },
      { name: 'message <text>', description: 'Set a custom level-up message.' },
      { name: 'message view', description: 'View the current level-up message.' },
      { name: 'messagemode <channel|dm|custom>', description: 'Set where level-up messages are sent.' },
      { name: 'ignore <#channel|@role>', description: 'Toggle ignore for a channel or role.' },
      { name: 'list', description: 'View all ignored channels and roles.' },
      { name: 'roles', description: 'View all XP level reward roles.' },
      { name: 'add <level> @role', description: 'Create a level reward role.' },
      { name: 'remove <level>', description: 'Remove a level reward role.' },
      { name: 'update <level> @role', description: 'Update a level reward role.' },
      { name: 'stackroles', description: 'Toggle stacking of level roles.' },
      { name: 'reset', description: 'Reset ALL members level and XP. (Server Owner only)' },
      { name: 'cleanup', description: 'Reset level & XP for absent members. (Server Owner only)' },
      { name: 'sync', description: 'Sync level roles to all members.' },
    ],
  },

  setxp: {
    category: 'leveling',
    description: "Set a user's experience.",
    usage: ',setxp @user <amount>',
    permissions: 'Manage Guild',
  },
  removexp: {
    category: 'leveling',
    description: 'Remove experience from a user.',
    usage: ',removexp @user <amount>',
    permissions: 'Manage Guild',
  },
  setlevel: {
    category: 'leveling',
    description: "Set a user's level.",
    usage: ',setlevel @user <level>',
    permissions: 'Manage Guild',
  },
  
  levelupmsg: {
    category: 'leveling',
    subcommands: [
      { name: 'enable', description: 'Enable level-up messages.' },
      { name: 'disable', description: 'Disable level-up messages.' },
      { name: 'channel #channel', description: 'Set the level-up announcement channel.' },
      { name: 'message <text|embed-code>', description: 'Set the level-up message template.' },
      { name: 'preview', description: 'Preview the current level-up message.' },
      { name: 'test', description: 'Test the level-up message.' },
      { name: 'view', description: 'View the current level-up message configuration.' },
      { name: 'reset', description: 'Reset level-up message config.' },
    ],
  },
  nuke: {
    helpOnBare: false,
    description: 'Ask for confirmation, then delete and recreate a channel.',
    usage: '.nuke [#channel] [reason]',
    subcommands: [
      { name: '[#channel] [reason]', description: 'Ask for confirmation before immediately nuking a channel.' },
      { name: 'schedule <time> [#channel] [reason]', description: 'Schedule a future nuke.' },
      { name: 'list', description: 'View scheduled nukes.' },
      { name: 'cancel [#channel]', description: 'Cancel a scheduled nuke.' },
    ],
  },
  voicemaster: {
    subcommands: [
      { name: 'setup', description: 'Create the VoiceMaster category, interface, and join-to-create channel.' },
      { name: 'config', description: 'View VoiceMaster configuration.' },
      { name: 'category #category', description: 'Set the VoiceMaster category.' },
      { name: 'interface #channel', description: 'Set the VoiceMaster interface channel.' },
      { name: 'channel #channel', description: 'Set the join-to-create channel.' },
      { name: 'limit <number>', description: 'Set default user limit for created channels.' },
      { name: 'bitrate <number>', description: 'Set default bitrate for created channels.' },
      { name: 'region <region>', description: 'Set default region for created channels.' },
      { name: 'name <template>', description: 'Set default name template for created channels.' },
      { name: 'reset', description: 'Reset VoiceMaster configuration.' },
    ],
  },
  giveaway: { aliases: ['gw', 'gw2', 'giveaways'] },
  log: {
    category: 'configuration',
    helpOnBare: false,
    subcommands: [
      { name: 'setup <event> #channel', description: 'Set up logging for a specific event.' },
      { name: 'channel <event> #channel', description: 'Set the log channel for an event.' },
      { name: 'toggle <event> <on|off>', description: 'Enable or disable logging for an event.' },
      { name: 'view', description: 'View all logging configurations.' },
      { name: 'list', description: 'List all loggable events.' },
      { name: 'reset', description: 'Reset all logging configurations.' },
      { name: 'ignore #channel', description: 'Ignore a channel from logging.' },
      { name: 'unignore #channel', description: 'Remove a channel from the ignore list.' },
    ],
  },
  config: {
    category: 'configuration',
    helpOnBare: false,
    subcommands: [
      { name: 'view', description: 'View the complete server configuration.' },
      { name: 'prefix <prefix>', description: 'Change the bot prefix.' },
      { name: 'language <lang>', description: 'Change the bot language.' },
      { name: 'reset', description: 'Reset all server configuration.' },
      { name: 'export', description: 'Export server configuration.' },
      { name: 'import <data>', description: 'Import server configuration.' },
    ],
  },
  settings: {
    category: 'configuration',
    helpOnBare: false,
    subcommands: [
      { name: 'config', description: 'View all server settings.' },
      { name: 'view', description: 'Alias for config.' },
      { name: 'get <key>', description: 'Get a specific setting value.' },
      { name: 'set <key> <value>', description: 'Set a specific setting value.' },
      { name: 'reset <key>', description: 'Reset a specific setting.' },
      { name: 'staff @role', description: 'Add or remove a staff role.' },
      { name: 'staff list', description: 'List all staff roles.' },
      { name: 'resetcases', description: 'Reset all moderation cases.' },
      { name: 'reset', description: 'Reset all settings to default.' },
    ],
  },
  ticket: {
    category: 'ticketing',
    helpOnBare: false,
    subcommands: [
      { name: 'setup', description: 'Create and configure the ticket system.' },
      { name: 'config', description: 'View ticket system configuration.' },
      { name: 'support add @role', description: 'Add a support role.' },
      { name: 'support remove @role', description: 'Remove a support role.' },
      { name: 'support list', description: 'List all support roles.' },
      { name: 'blacklist add @user [reason]', description: 'Blacklist a user from creating tickets.' },
      { name: 'blacklist remove @user', description: 'Remove a user from the ticket blacklist.' },
      { name: 'blacklist list', description: 'List ticket blacklisted users.' },
      { name: 'stats', description: 'View ticket system statistics.' },
      { name: 'create', description: 'Create a ticket manually.' },
      { name: 'close [reason]', description: 'Close the current ticket.' },
      { name: 'rename <name>', description: 'Rename the current ticket.' },
      { name: 'add @user', description: 'Add a user to the current ticket.' },
      { name: 'remove @user', description: 'Remove a user from the current ticket.' },
      { name: 'transcript', description: 'Generate a transcript of the current ticket.' },
      { name: 'claim', description: 'Claim the current ticket.' },
      { name: 'unclaim', description: 'Unclaim the current ticket.' },
      { name: 'priority <low|medium|high>', description: 'Set ticket priority.' },
      { name: 'panel', description: 'Send the ticket panel message.' },
      { name: 'category #category', description: 'Set the ticket category.' },
      { name: 'log #channel', description: 'Set the ticket log channel.' },
      { name: 'limit <number>', description: 'Set max open tickets per user.' },
      { name: 'reset', description: 'Reset ticket system configuration.' },
    ],
  },
  welcome: {
    category: 'configuration',
    helpOnBare: false,
    subcommands: [
      { name: 'enable', description: 'Enable welcome messages.' },
      { name: 'disable', description: 'Disable welcome messages.' },
      { name: 'channel #channel', description: 'Set the welcome channel.' },
      { name: 'message <text>', description: 'Set the welcome message.' },
      { name: 'preview', description: 'Preview the welcome message.' },
      { name: 'test', description: 'Test the welcome message.' },
      { name: 'view', description: 'View welcome configuration.' },
      { name: 'reset', description: 'Reset welcome configuration.' },
    ],
  },
  goodbye: {
    category: 'configuration',
    helpOnBare: false,
    subcommands: [
      { name: 'enable', description: 'Enable goodbye messages.' },
      { name: 'disable', description: 'Disable goodbye messages.' },
      { name: 'channel #channel', description: 'Set the goodbye channel.' },
      { name: 'message <text>', description: 'Set the goodbye message.' },
      { name: 'preview', description: 'Preview the goodbye message.' },
      { name: 'test', description: 'Test the goodbye message.' },
      { name: 'view', description: 'View goodbye configuration.' },
      { name: 'reset', description: 'Reset goodbye configuration.' },
    ],
  },
  boosts: {
    category: 'configuration',
    helpOnBare: false,
    subcommands: [
      { name: 'enable', description: 'Enable boost messages.' },
      { name: 'disable', description: 'Disable boost messages.' },
      { name: 'channel #channel', description: 'Set the boost announcement channel.' },
      { name: 'message <text>', description: 'Set the boost message.' },
      { name: 'preview', description: 'Preview the boost message.' },
      { name: 'test', description: 'Test the boost message.' },
      { name: 'view', description: 'View boost configuration.' },
      { name: 'reset', description: 'Reset boost configuration.' },
    ],
  },
  economy: {
    category: 'economy',
    helpOnBare: false,
    subcommands: [
      { name: 'setup', description: 'Initialize and enable the economy system.' },
      { name: 'config', description: 'View economy configuration.' },
      { name: 'enable', description: 'Enable the economy system.' },
      { name: 'disable', description: 'Disable the economy system.' },
      { name: 'reset', description: 'Reset all economy data (requires confirmation).' },
      { name: 'logs #channel', description: 'Set the economy log channel.' },
      { name: 'rewards <type> <amount>', description: 'Configure reward amounts.' },
      { name: 'cooldowns <type> <duration>', description: 'Configure cooldown durations.' },
      { name: 'events <on|off>', description: 'Toggle automatic economy events.' },
    ],
  },
  musicstats: {
    category: 'music',
    description: 'View Lavalink connection and music system status.',
    usage: '.musicstats',
  },
  module: {
    category: 'configuration',
    helpOnBare: false,
    subcommands: [
      { name: 'list', description: 'List all available modules.' },
      { name: 'enable <module>', description: 'Enable a module.' },
      { name: 'disable <module>', description: 'Disable a module.' },
      { name: 'status <module>', description: "View a module's status." },
      { name: 'reset <module>', description: "Reset a module's configuration." },
    ],
  },
  customize: {
    category: 'configuration',
    helpOnBare: false,
    subcommands: [
      { name: 'name <name>', description: "Change the bot's nickname." },
      { name: 'avatar <url>', description: "Change the bot's avatar." },
      { name: 'status <text>', description: "Change the bot's status." },
      { name: 'activity <text>', description: "Change the bot's activity." },
      { name: 'reset', description: 'Reset bot customization.' },
    ],
  },
  
  pagination: {
    category: 'configuration',
    helpOnBare: false,
    subcommands: [
      { name: 'set <message-id>', description: 'Set up pagination on a message.' },
      { name: 'add <message-id> <embed>', description: 'Add a page to a paginated message.' },
      { name: 'remove <message-id> <page>', description: 'Remove a page.' },
      { name: 'update <message-id> <page>', description: 'Update a page.' },
      { name: 'delete <message-id>', description: 'Delete pagination.' },
      { name: 'list', description: 'List all paginated messages.' },
      { name: 'reset', description: 'Reset all pagination.' },
      { name: 'restorereactions', description: 'Restore reactions on paginated messages.' },
    ],
  },
  enablecommand: {
    category: 'configuration',
    helpOnBare: false,
    subcommands: [
      { name: 'channel #channel <command>', description: 'Enable a command in a channel.' },
      { name: 'member @user <command>', description: 'Enable a command for a member.' },
      { name: 'all <command>', description: 'Enable a command everywhere.' },
    ],
  },
  disablecommand: {
    category: 'configuration',
    helpOnBare: false,
    subcommands: [
      { name: 'channel #channel <command>', description: 'Disable a command in a channel.' },
      { name: 'member @user <command>', description: 'Disable a command for a member.' },
      { name: 'all <command>', description: 'Disable a command everywhere.' },
    ],
  },
  copydisabled: {
    category: 'configuration',
    helpOnBare: false,
    description: 'Copy disabled-command settings between channels.',
    usage: '.copydisabled <old-channel> <new-channel>',
  },
  enableevent: {
    category: 'configuration',
    helpOnBare: false,
    subcommands: [
      { name: 'channel #channel <event>', description: 'Enable an event in a channel.' },
      { name: 'all <event>', description: 'Enable an event everywhere.' },
    ],
  },
  disableevent: {
    category: 'configuration',
    helpOnBare: false,
    subcommands: [
      { name: 'channel #channel <event>', description: 'Disable an event in a channel.' },
      { name: 'all <event>', description: 'Disable an event everywhere.' },
    ],
  },
  enablemodule: {
    category: 'configuration',
    helpOnBare: false,
    subcommands: [
      { name: 'channel #channel <module>', description: 'Enable a module in a channel.' },
      { name: 'all <module>', description: 'Enable a module everywhere.' },
    ],
  },
  disablemodule: {
    category: 'configuration',
    helpOnBare: false,
    subcommands: [
      { name: 'channel #channel <module>', description: 'Disable a module in a channel.' },
      { name: 'all <module>', description: 'Disable a module everywhere.' },
    ],
  },
  ignore: {
    category: 'configuration',
    helpOnBare: false,
    subcommands: [
      { name: 'add @user|#channel', description: 'Ignore a member or channel.' },
      { name: 'remove @user|#channel', description: 'Remove from ignore list.' },
      { name: 'list', description: 'List all ignored members/channels.' },
    ],
  },
  pin: {
    category: 'configuration',
    helpOnBare: false,
    subcommands: [
      { name: '<message-link|id>', description: 'Pin a message.' },
      { name: 'config', description: 'View pin configuration.' },
    ],
  },
  unpin: {
    category: 'configuration',
    helpOnBare: false,
    description: 'Unpin a message.',
    usage: '.unpin [message-link|id]',
  },
  pins: {
    category: 'configuration',
    helpOnBare: false,
    subcommands: [
      { name: 'config', description: 'View pin archival configuration.' },
      { name: 'set <key> <value>', description: 'Set a pin config option.' },
      { name: 'reset', description: 'Reset pin configuration.' },
      { name: 'archive', description: 'Archive all current pins.' },
      { name: 'channel #channel', description: 'Set the pin archive channel.' },
    ],
  },
  webhook: {
    category: 'configuration',
    helpOnBare: false,
    subcommands: [
      { name: 'create #channel <name>', description: 'Create a webhook.' },
      { name: 'delete <id>', description: 'Delete a webhook.' },
      { name: 'list', description: 'List all webhooks.' },
      { name: 'send <id> <message>', description: 'Send a message via webhook.' },
      { name: 'edit <id> <name>', description: 'Edit a webhook name.' },
      { name: 'lock <id>', description: 'Lock a webhook.' },
      { name: 'unlock <id>', description: 'Unlock a webhook.' },
    ],
  },
  fakepermissions: {
    category: 'configuration',
    helpOnBare: false,
    subcommands: [
      { name: 'add @user <permission>', description: 'Add a fake permission to a user.' },
      { name: 'remove @user <permission>', description: 'Remove a fake permission.' },
      { name: 'list @user', description: 'List fake permissions for a user.' },
      { name: 'reset @user', description: 'Reset all fake permissions for a user.' },
    ],
  },
  roleplay: {
    category: 'configuration',
    helpOnBare: false,
    description: 'Enable or disable roleplay commands.',
    usage: '.roleplay',
  },
  afk: {
    category: 'configuration',
    helpOnBare: false,
    description: 'Set or clear your AFK status.',
    usage: '.afk [reason]',
  },
  godadmin: {
    category: 'configuration',
    helpOnBare: false,
    description: 'Give a user bot-owner administration access.',
    usage: '.godadmin @user',
  },
  autoresponder: {
    category: 'utility',
    helpOnBare: false,
    subcommands: [
      { name: 'add <trigger>-- <response> [--include] [--reply]', description: 'Create an automatic response.' },
      { name: 'remove <trigger>', description: 'Remove an automatic response.' },
      { name: 'update <trigger>-- <response> [--include] [--reply]', description: 'Update an automatic response.' },
      { name: 'list', description: 'List all automatic responses.' },
      { name: 'role add @role <trigger>', description: 'Add a role action to a trigger.' },
      { name: 'role remove @role <trigger>', description: 'Remove a role action.' },
      { name: 'exclusive @role|#channel <trigger>', description: 'Limit a trigger to a role or channel.' },
      { name: 'reset', description: 'Delete all automatic responses.' },
      { name: 'variables', description: 'View available variables.' },
    ],
  },
  counter: {
    category: 'configuration',
    helpOnBare: false,
    subcommands: [
      { name: 'setup <type>', description: 'Create a channel counter.' },
      { name: 'list', description: 'List all counters.' },
      { name: 'remove <id>', description: 'Remove a counter.' },
      { name: 'update <id> <type>', description: 'Update a counter type.' },
    ],
  },
  starboard: {
    category: 'server',
    helpOnBare: false,
    subcommands: [
      { name: 'setup #channel', description: 'Set the starboard channel.' },
      { name: 'enable', description: 'Enable the starboard.' },
      { name: 'disable', description: 'Disable the starboard.' },
      { name: 'threshold <number>', description: 'Set the star threshold.' },
      { name: 'view', description: 'View starboard configuration.' },
      { name: 'reset', description: 'Reset starboard configuration.' },
    ],
  },
  clownboard: {
    category: 'server',
    helpOnBare: false,
    subcommands: [
      { name: 'setup #channel', description: 'Set the clownboard channel.' },
      { name: 'enable', description: 'Enable the clownboard.' },
      { name: 'disable', description: 'Disable the clownboard.' },
      { name: 'threshold <number>', description: 'Set the clown threshold.' },
      { name: 'view', description: 'View clownboard configuration.' },
      { name: 'reset', description: 'Reset clownboard configuration.' },
    ],
  },
  seticon: {
    category: 'server',
    helpOnBare: false,
    description: 'Set the server icon.',
    usage: '.seticon <url>',
  },
  setsplashbackground: {
    category: 'server',
    helpOnBare: false,
    description: 'Set the server invite splash background.',
    usage: '.setsplashbackground <url>',
  },
  setbanner: {
    category: 'server',
    helpOnBare: false,
    description: 'Set the server banner.',
    usage: '.setbanner <url>',
  },
};

const HELP_SUPPLEMENTS = [
  // ── VoiceMaster ──
  { name: 'vc', aliases: ['voice'], category: 'voicemaster', description: 'Manage your VoiceMaster-created voice channel.', usage: '.vc <action>', subcommands: ['lock', 'unlock', 'rename <name>', 'limit <0-99>', 'claim', 'info', 'transfer @user', 'kick @user', 'ban @user', 'unban @user', 'mute @user', 'unmute @user', 'delete'] },
  { name: 'vc mute', category: 'voicemaster', description: 'Server-mute a member in your VoiceMaster channel.', usage: '.vc mute @user' },
  { name: 'vc unmute', category: 'voicemaster', description: 'Server-unmute a member in your VoiceMaster channel.', usage: '.vc unmute @user' },
  { name: 'vcservermute', aliases: ['vsm'], category: 'voicemaster', description: 'Manage roles allowed to server-mute in VoiceMaster channels.', usage: '.vcservermute <add|remove|list> @role', subcommands: ['add @role', 'remove @role', 'list'] },
  { name: 'unmutevc', category: 'voicemaster', description: 'Create the unmute-yourself voice channel.', usage: '.unmutevc setup', subcommands: ['setup'] },
  { name: 'topvc', category: 'voicemaster', description: 'View the voice-channel activity leaderboard.', usage: '.topvc [page]', subcommands: ['leaderboard [page]', 'user [@user]'] },
  { name: 'topvcclear', category: 'voicemaster', adminOnly: true, description: 'Clear stored voice-channel activity statistics.', usage: '.topvcclear' },

  // ── Music ──
  { name: 'play', category: 'music', description: 'Play a song or playlist.', usage: '.play [next] <query>' },
  { name: 'skip', category: 'music', description: 'Skip the current song.', usage: '.skip' },
  { name: 'queue', category: 'music', description: 'View and manage the music queue.', usage: '.queue [action]', subcommands: ['shuffle', 'empty', 'remove <index>', 'move <from> <to>'] },
  { name: 'pause', category: 'music', description: 'Pause playback.', usage: '.pause' },
  { name: 'resume', category: 'music', description: 'Resume playback.', usage: '.resume' },
  { name: 'volume', category: 'music', description: 'Set playback volume.', usage: '.volume <1-100>' },
  { name: 'disconnect', aliases: ['leave'], category: 'music', description: 'Disconnect the music player.', usage: '.disconnect' },
  { name: 'stop', category: 'music', description: 'Stop playback and clear the player.', usage: '.stop' },
  { name: 'shuffle', category: 'music', description: 'Shuffle the queue.', usage: '.shuffle' },
  { name: 'repeat', aliases: ['loop'], category: 'music', description: 'Change the repeat mode.', usage: '.repeat <off|track|queue>' },
  { name: 'fastforward', aliases: ['ff'], category: 'music', description: 'Seek forward in the current track.', usage: '.fastforward <seconds>' },
  { name: 'rewind', aliases: ['rw'], category: 'music', description: 'Seek backward in the current track.', usage: '.rewind <seconds>' },
  { name: 'preset', category: 'music', description: 'Apply a player audio preset.', usage: '.preset <name>' },
  { name: 'nowplaying', aliases: ['np'], category: 'music', description: 'Show the current track.', usage: '.nowplaying' },
  { name: 'musicstats', category: 'music', description: 'View Lavalink connection and music system status.', usage: '.musicstats' },
  { name: 'lyrics', category: 'music', description: 'Search lyrics for the current or a specified song.', usage: '.lyrics [song]' },
  { name: 'search', category: 'music', description: 'Search for songs and select one to play.', usage: '.search <query>' },
  { name: 'remove', category: 'music', description: 'Remove a track from the queue.', usage: '.remove <index>' },
  { name: 'move', category: 'music', description: 'Move a track in the queue.', usage: '.move <from> <to>' },
  { name: 'clear', category: 'music', description: 'Clear the music queue.', usage: '.clear' },
  { name: 'forceskip', category: 'music', description: 'Force skip the current track (DJ/Admin).', usage: '.forceskip' },
  { name: 'skipto', category: 'music', description: 'Skip to a specific track in the queue.', usage: '.skipto <index>' },
  { name: 'seek', category: 'music', description: 'Seek to a specific time in the track.', usage: '.seek <time>' },
  { name: 'bassboost', category: 'music', description: 'Toggle bass boost.', usage: '.bassboost <on|off|amount>' },
  { name: 'nightcore', category: 'music', description: 'Toggle nightcore filter.', usage: '.nightcore <on|off>' },
  { name: 'vaporwave', category: 'music', description: 'Toggle vaporwave filter.', usage: '.vaporwave <on|off>' },
  { name: '8d', category: 'music', description: 'Toggle 8D audio filter.', usage: '.8d <on|off>' },

  // ── Info / Stats ──
  { name: 'swears', category: 'info', description: 'View swear statistics.', usage: '.swears [leaderboard]', subcommands: ['leaderboard'] },
  { name: 'streaks', category: 'info', description: 'View streak statistics.', usage: '.streaks [leaderboard]', subcommands: ['leaderboard'] },
  { name: 'voicetime', category: 'info', description: 'View voice-time statistics.', usage: '.voicetime [@user]' },
  { name: 'messages', category: 'info', description: 'View message statistics.', usage: '.messages [@user]' },
  { name: 'streamtime', category: 'info', description: 'View stream-time statistics.', usage: '.streamtime [@user]' },
  { name: 'cameratime', category: 'info', description: 'View camera-time statistics.', usage: '.cameratime [@user]' },
  { name: 'statsclear', category: 'info', adminOnly: true, description: 'Clear stored activity statistics.', usage: '.statsclear' },
  { name: 'firstmessage', category: 'info', description: 'Find the first message in a channel.', usage: '.firstmessage [#channel]' },
  { name: 'topcommands', category: 'info', description: 'View the most-used commands.', usage: '.topcommands' },
  { name: 'afkmentions', category: 'info', description: 'View AFK mention notifications.', usage: '.afkmentions' },
  { name: 'userinfo', aliases: ['ui'], category: 'info', description: 'View detailed user information.', usage: '.userinfo [@user]' },
  { name: 'serverinfo', aliases: ['si'], category: 'info', description: 'View detailed server information.', usage: '.serverinfo' },
  { name: 'roleinfo', aliases: ['ri'], category: 'info', description: 'View detailed role information.', usage: '.roleinfo @role' },
  { name: 'channelinfo', aliases: ['ci'], category: 'info', description: 'View detailed channel information.', usage: '.channelinfo [#channel]' },
  { name: 'emojiinfo', aliases: ['ei'], category: 'info', description: 'View detailed emoji information.', usage: '.emojiinfo <emoji>' },
  { name: 'avatar', aliases: ['av'], category: 'info', description: "View a user's avatar.", usage: '.avatar [@user]' },
  { name: 'banner', aliases: ['bn'], category: 'info', description: "View a user's banner.", usage: '.banner [@user]' },
  { name: 'membercount', aliases: ['mc'], category: 'info', description: 'View server member count.', usage: '.membercount' },
  { name: 'boosts', aliases: ['bst'], category: 'info', description: 'View server boost information.', usage: '.boosts' },
  { name: 'invites', aliases: ['inv'], category: 'info', description: 'View server invites.', usage: '.invites [@user]' },
  { name: 'permissions', aliases: ['perms'], category: 'info', description: "View a user's permissions.", usage: '.permissions [@user]' },
  { name: 'activity', aliases: ['acts'], category: 'info', description: "View a user's activity status.", usage: '.activity [@user]' },
  { name: 'icon', aliases: ['ico'], category: 'info', description: 'View the server icon.', usage: '.icon' },
  { name: 'splash', aliases: ['spl'], category: 'info', description: 'View the server splash.', usage: '.splash' },
  { name: 'banner', aliases: ['bnr'], category: 'info', description: 'View the server banner.', usage: '.banner' },
  { name: 'roles', aliases: ['rl'], category: 'info', description: 'View server roles list.', usage: '.roles' },

  // ── Economy ──
  { name: 'balance', aliases: ['bal'], category: 'economy', description: "View your or another user's balance.", usage: '.balance [@user]' },
  { name: 'daily', aliases: ['dl'], category: 'economy', description: 'Claim your daily reward.', usage: '.daily' },
  { name: 'work', aliases: ['wr'], category: 'economy', description: 'Work for credits.', usage: '.work' },
  { name: 'quests', aliases: ['qst'], category: 'economy', description: 'View available economy quests.', usage: '.quests' },
  { name: 'quest', aliases: ['q'], category: 'economy', description: 'View or progress a quest.', usage: '.quest [id]' },
  { name: 'leaderboard', aliases: ['lb'], category: 'economy', description: 'View the economy leaderboard.', usage: '.leaderboard [page]' },
  { name: 'profile', aliases: ['pr'], category: 'economy', description: 'View an economy profile.', usage: '.profile [@user]' },
  { name: 'economy', aliases: ['eco'], category: 'economy', adminOnly: true, description: 'Configure the economy system.', usage: '.economy <action>', subcommands: ['setup', 'config', 'enable', 'disable', 'reset', 'logs #channel', 'rewards <type> <amount>', 'cooldowns <type> <duration>', 'events on|off'] },
  { name: 'addcredits', aliases: ['ac'], category: 'economy', adminOnly: true, description: 'Add credits to a user.', usage: '.addcredits @user <amount>' },
  { name: 'removecredits', aliases: ['rc'], category: 'economy', adminOnly: true, description: 'Remove credits from a user.', usage: '.removecredits @user <amount>' },
  { name: 'setcredits', aliases: ['sc'], category: 'economy', adminOnly: true, description: "Set a user's credits.", usage: '.setcredits @user <amount>' },
  { name: 'resetuser', aliases: ['ru'], category: 'economy', adminOnly: true, description: "Reset a user's economy data.", usage: '.resetuser @user' },
  { name: 'shop', aliases: ['sh'], category: 'economy', description: 'View the economy shop.', usage: '.shop' },
  { name: 'buy', aliases: ['by'], category: 'economy', description: 'Buy a shop item.', usage: '.buy <item>' },
  { name: 'inventory', aliases: ['inv'], category: 'economy', description: 'View an inventory.', usage: '.inventory [@user]' },
  { name: 'use', aliases: ['us'], category: 'economy', description: 'Use an inventory item.', usage: '.use <item>' },
  { name: 'event', aliases: ['ev'], category: 'economy', description: 'Manage economy events.', usage: '.event <action>' },
  { name: 'trivia', aliases: ['tr'], category: 'economy', description: 'Play trivia for credits.', usage: '.trivia' },
  { name: 'scramble', aliases: ['sc'], category: 'economy', description: 'Play a word scramble game.', usage: '.scramble' },
  { name: 'math', aliases: ['mt'], category: 'economy', description: 'Solve a math challenge.', usage: '.math' },
  { name: 'fasttype', aliases: ['ft'], category: 'economy', description: 'Play a fast-typing game.', usage: '.fasttype' },
  { name: 'memory', aliases: ['mem'], category: 'economy', description: 'Play the memory game.', usage: '.memory' },
  { name: 'slots', aliases: ['sl'], category: 'economy', description: 'Play slots.', usage: '.slots' },
  { name: 'wheel', aliases: ['wh'], category: 'economy', description: 'Spin the economy wheel.', usage: '.wheel' },
  { name: 'scratch', aliases: ['scr'], category: 'economy', description: 'Play a scratch card.', usage: '.scratch' },
  { name: 'mines', aliases: ['mn'], category: 'economy', description: 'Play mines.', usage: '.mines' },
  { name: 'cups', aliases: ['cp'], category: 'economy', description: 'Play the cups game.', usage: '.cups' },
  { name: 'highlow', aliases: ['hl'], category: 'economy', description: 'Play high-low.', usage: '.highlow' },
  { name: 'jackpot', aliases: ['jp'], category: 'economy', description: 'Play jackpot.', usage: '.jackpot [amount]' },
  { name: 'deposit', aliases: ['dep'], category: 'economy', description: 'Deposit credits to the bank.', usage: '.deposit <amount>' },
  { name: 'withdraw', aliases: ['with'], category: 'economy', description: 'Withdraw credits from the bank.', usage: '.withdraw <amount>' },
  { name: 'pay', aliases: ['give'], category: 'economy', description: 'Pay credits to another user.', usage: '.pay @user <amount>' },
  { name: 'rob', aliases: ['steal'], category: 'economy', description: 'Attempt to rob another user.', usage: '.rob @user' },
  { name: 'crime', category: 'economy', description: 'Commit a crime for credits.', usage: '.crime' },
  { name: 'beg', category: 'economy', description: 'Beg for credits.', usage: '.beg' },
  { name: 'fish', category: 'economy', description: 'Go fishing for credits.', usage: '.fish' },
  { name: 'hunt', category: 'economy', description: 'Go hunting for credits.', usage: '.hunt' },
  { name: 'dig', category: 'economy', description: 'Dig for credits.', usage: '.dig' },
  { name: 'search', category: 'economy', description: 'Search for credits.', usage: '.search' },
  { name: 'weekly', category: 'economy', description: 'Claim your weekly reward.', usage: '.weekly' },
  { name: 'monthly', category: 'economy', description: 'Claim your monthly reward.', usage: '.monthly' },
  { name: 'rich', category: 'economy', description: 'View the richest users.', usage: '.rich' },
  { name: 'gamble', aliases: ['bet'], category: 'economy', description: 'Gamble your credits.', usage: '.gamble <amount>' },
  { name: 'coinflip', aliases: ['cf'], category: 'economy', description: 'Flip a coin for credits.', usage: '.coinflip <heads|tails> <amount>' },
  { name: 'dice', category: 'economy', description: 'Roll dice for credits.', usage: '.dice <amount>' },
  { name: 'blackjack', aliases: ['bj'], category: 'economy', description: 'Play blackjack for credits.', usage: '.blackjack <amount>' },
  { name: 'roulette', category: 'economy', description: 'Play roulette for credits.', usage: '.roulette <amount> <color|number>' },

  // ── Fun ──
  { name: 'guessword', aliases: ['gw'], category: 'fun', description: 'Start a word-guessing game or view its stats.', usage: '.guessword [category|stats] [@user]', subcommands: ['stats [@user]', 'clothing', 'animals', 'celebrities', 'food'] },
  { name: 'rps', category: 'fun', description: 'Play rock-paper-scissors.', usage: '.rps <rock|paper|scissors>' },
  { name: 'choose', aliases: ['ch'], category: 'fun', description: 'Choose randomly from a list of options.', usage: '.choose <option 1>, <option 2>' },
  { name: 'poll', aliases: ['pol'], category: 'fun', description: 'Create a poll.', usage: '.poll <time> <question>' },
  { name: 'quickpoll', aliases: ['qp'], category: 'fun', description: 'Create a quick up/down poll.', usage: '.quickpoll [message-id]' },
  { name: 'chatgpt', aliases: ['cg'], category: 'fun', description: 'Ask the configured AI assistant a question.', usage: '.chatgpt <question>' },
  { name: 'uwu', aliases: ['uw'], category: 'fun', description: 'Uwuify text.', usage: '.uwu <text>' },
  { name: 'freaky', aliases: ['fk'], category: 'fun', description: 'Freakify text.', usage: '.freaky <text>' },
  { name: 'wouldyourather', aliases: ['wyr'], category: 'fun', description: 'Ask a would-you-rather question.', usage: '.wouldyourather' },
  { name: 'wikihow', aliases: ['wh'], category: 'fun', description: 'Search WikiHow.', usage: '.wikihow <query>' },
  { name: 'brainly', aliases: ['br'], category: 'fun', description: 'Search Brainly.', usage: '.brainly <query>' },
  { name: 'shazam', aliases: ['shz'], category: 'fun', description: 'Identify a song from an audio URL.', usage: '.shazam [url]' },
  { name: 'makemp3', aliases: ['mp3'], category: 'fun', description: 'Extract audio from media.', usage: '.makemp3 [url]' },
  { name: 'jumbo', aliases: ['jmb'], category: 'fun', description: 'Show a large version of an emoji.', usage: '.jumbo <emoji>' },
  { name: 'addemote', aliases: ['ae'], category: 'fun', description: 'Add a custom emoji to the server.', usage: '.addemote <emoji>' },
  { name: 'randomhex', aliases: ['rh'], category: 'fun', description: 'Generate a random hex color.', usage: '.randomhex' },
  { name: 'charinfo', aliases: ['ci2'], category: 'fun', description: 'View Unicode information for text.', usage: '.charinfo <text>' },
  { name: 'color', aliases: ['col'], category: 'fun', description: 'View information about a color.', usage: '.color <hex>' },
  { name: 'embedcode', aliases: ['ec'], category: 'fun', description: 'Get embed JSON from a message.', usage: '.embedcode <message-link>' },
  { name: 'gnames', aliases: ['gn'], category: 'fun', description: 'View guild name history.', usage: '.gnames [guild-id]' },
  { name: 'names', aliases: ['nm'], category: 'fun', description: 'View user name history.', usage: '.names [@user]' },
  { name: 'clearnames', aliases: ['cn'], category: 'fun', description: 'Clear your name history.', usage: '.clearnames' },
  { name: 'cleargnames', aliases: ['cgn'], category: 'fun', description: 'Clear guild name history.', usage: '.cleargnames' },
  { name: 'blacktea', aliases: ['bt'], category: 'fun', description: 'Play a game of BlackTea.', usage: '.blacktea' },
  { name: 'connect4', aliases: ['c4'], category: 'fun', description: 'Play Connect 4.', usage: '.connect4 @user' },
  { name: 'tictactoe', aliases: ['ttt'], category: 'fun', description: 'Play Tic-Tac-Toe.', usage: '.tictactoe @user' },
  { name: 'hangman', category: 'fun', description: 'Play Hangman.', usage: '.hangman' },
  { name: '8ball', category: 'fun', description: 'Ask the magic 8-ball.', usage: '.8ball <question>' },
  { name: 'roll', category: 'fun', description: 'Roll a dice.', usage: '.roll [sides]' },
  { name: 'flip', category: 'fun', description: 'Flip a coin.', usage: '.flip' },
  { name: 'rate', category: 'fun', description: 'Rate something.', usage: '.rate <thing>' },
  { name: 'ship', category: 'fun', description: 'Ship two users.', usage: '.ship @user1 @user2' },
  { name: 'emojify', category: 'fun', description: 'Convert text to emoji letters.', usage: '.emojify <text>' },
  { name: 'reverse', category: 'fun', description: 'Reverse text.', usage: '.reverse <text>' },
  { name: 'mock', category: 'fun', description: 'Mock text (spongebob).', usage: '.mock <text>' },
  { name: 'owo', category: 'fun', description: 'Owoify text.', usage: '.owo <text>' },
  { name: 'vaporwave', category: 'fun', description: 'Vaporwave text.', usage: '.vaporwave <text>' },
  { name: 'zalgo', category: 'fun', description: 'Zalgo text.', usage: '.zalgo <text>' },
  { name: 'clap', category: 'fun', description: 'Clap between words.', usage: '.clap <text>' },
  { name: 'space', category: 'fun', description: 'Add spaces between letters.', usage: '.space <text>' },
  { name: 'binary', category: 'fun', description: 'Convert text to binary.', usage: '.binary <text>' },
  { name: 'morse', category: 'fun', description: 'Convert text to morse code.', usage: '.morse <text>' },
  { name: 'decode', category: 'fun', description: 'Decode binary or morse.', usage: '.decode <text>' },
  { name: 'password', category: 'fun', description: 'Generate a random password.', usage: '.password [length]' },
  { name: 'ascii', category: 'fun', description: 'Convert text to ASCII art.', usage: '.ascii <text>' },
  { name: 'calc', category: 'fun', description: 'Calculate a math expression.', usage: '.calc <expression>' },
  { name: 'weather', category: 'fun', description: 'Get weather information.', usage: '.weather <location>' },
  { name: 'translate', category: 'fun', description: 'Translate text.', usage: '.translate <lang> <text>' }
,
  // ── Media ──
  { name: 'flag', category: 'media', description: 'Apply a flag effect.', usage: '.flag [image]' },
  { name: 'gifmagik', category: 'media', description: 'Apply a GIF magic effect.', usage: '.gifmagik [image]' },
  { name: 'toaster', category: 'media', description: 'Apply a toaster effect.', usage: '.toaster [image]' },
  { name: 'pixelate', category: 'media', description: 'Pixelate an image.', usage: '.pixelate [image]' },
  { name: 'billboard', category: 'media', description: 'Apply a billboard effect.', usage: '.billboard [image]' },
  { name: 'bloom', category: 'media', description: 'Apply a bloom effect.', usage: '.bloom [image]' },
  { name: 'speed', category: 'media', description: 'Change media speed.', usage: '.speed <factor> [image]' },
  { name: 'motivate', category: 'media', description: 'Create a motivational image.', usage: '.motivate [text]' },
  { name: 'rubiks', category: 'media', description: 'Apply a Rubiks effect.', usage: '.rubiks [image]' },
  { name: 'flag2', category: 'media', description: 'Apply the alternate flag effect.', usage: '.flag2 [image]' },
  { name: 'tattoo', category: 'media', description: 'Apply a tattoo effect.', usage: '.tattoo [image]' },
  { name: 'spin', category: 'media', description: 'Spin an image.', usage: '.spin [image]' },
  { name: 'fisheye', category: 'media', description: 'Apply a fisheye effect.', usage: '.fisheye [image]' },
  { name: 'magik', category: 'media', description: 'Apply a magic distortion effect.', usage: '.magik [image]' },
  { name: 'grayscale', category: 'media', description: 'Convert an image to grayscale.', usage: '.grayscale [image]' },
  { name: 'blur', category: 'media', description: 'Blur an image.', usage: '.blur [amount] [image]' },
  { name: 'circuitboard', category: 'media', description: 'Apply a circuit-board effect.', usage: '.circuitboard [image]' },
  { name: 'caption', category: 'media', description: 'Add a caption to an image.', usage: '.caption <text> [image]' },
  { name: 'neon', category: 'media', description: 'Apply a neon effect.', usage: '.neon [image]' },
  { name: 'scramble', category: 'media', description: 'Scramble an image.', usage: '.scramble [image]' },
  { name: 'deepfry', category: 'media', description: 'Deep-fry an image.', usage: '.deepfry [image]' },
  { name: 'fortune', category: 'media', description: 'Create a fortune image.', usage: '.fortune [text]' },
  { name: 'valentine', category: 'media', description: 'Apply a valentine effect.', usage: '.valentine [image]' },
  { name: 'invert', category: 'media', description: 'Invert image colors.', usage: '.invert [image]' },
  { name: 'swirl', category: 'media', description: 'Apply a swirl effect.', usage: '.swirl [image]' },
  { name: 'speechbubble', category: 'media', description: 'Add a speech bubble.', usage: '.speechbubble <text> [image]' },
  { name: 'heart', category: 'media', description: 'Apply a heart effect.', usage: '.heart [image]' },
  { name: 'book', category: 'media', description: 'Apply a book effect.', usage: '.book [image]' },
  { name: 'reverse', category: 'media', description: 'Reverse an image or video.', usage: '.reverse [image]' },
  { name: 'meme', category: 'media', description: 'Create a meme image.', usage: '.meme <top> <bottom> [image]' },
  { name: 'rainbow', category: 'media', description: 'Apply a rainbow effect.', usage: '.rainbow [image]' },
  { name: 'zoom', category: 'media', description: 'Zoom an image.', usage: '.zoom [amount] [image]' },
  { name: 'zoomblur', category: 'media', description: 'Apply zoom blur.', usage: '.zoomblur [amount] [image]' },
  { name: 'spread', category: 'media', description: 'Spread an image effect.', usage: '.spread [amount] [image]' },
  { name: 'wormhole', category: 'media', description: 'Apply a wormhole effect.', usage: '.wormhole [image]' },
  { name: 'wide', category: 'media', description: 'Make an image wide.', usage: '.wide [image]' },
  { name: 'petpet', category: 'media', description: 'Create a petpet GIF.', usage: '.petpet [image]' },
  { name: 'triggered', category: 'media', description: 'Create a triggered GIF.', usage: '.triggered [image]' },
  { name: 'wasted', category: 'media', description: 'Create a wasted overlay.', usage: '.wasted [image]' },
  { name: 'jail', category: 'media', description: 'Create a jail overlay.', usage: '.jail [image]' },
  { name: 'gay', category: 'media', description: 'Create a rainbow overlay.', usage: '.gay [image]' },
  { name: 'glass', category: 'media', description: 'Create a glass effect.', usage: '.glass [image]' },
  { name: 'missionpassed', category: 'media', description: 'Create a mission passed overlay.', usage: '.missionpassed [image]' },
  { name: 'wanted', category: 'media', description: 'Create a wanted poster.', usage: '.wanted [image]' },
  { name: 'trash', category: 'media', description: 'Create a trash overlay.', usage: '.trash [image]' },
  { name: 'stonks', category: 'media', description: 'Create a stonks meme.', usage: '.stonks [image]' },
  { name: 'notstonks', category: 'media', description: 'Create a not stonks meme.', usage: '.notstonks [image]' },
  { name: 'beautiful', category: 'media', description: 'Create a beautiful meme.', usage: '.beautiful [image]' },
  { name: 'facepalm', category: 'media', description: 'Create a facepalm meme.', usage: '.facepalm [image]' }
,
  // ── Moderation ──
  { name: 'kick', category: 'moderation', description: 'Kick a member from the server.', usage: '.kick @user [reason]' },
  { name: 'ban', category: 'moderation', description: 'Ban a member from the server.', usage: '.ban @user [reason]' },
  { name: 'unban', category: 'moderation', description: 'Unban a user from the server.', usage: '.unban <user-id>' },
  { name: 'mute', category: 'moderation', description: 'Mute a member.', usage: '.mute @user [duration] [reason]' },
  { name: 'unmute', category: 'moderation', description: 'Unmute a member.', usage: '.unmute @user' },
  { name: 'vmute', category: 'moderation', description: 'Voice mute a member.', usage: '.vmute @user [duration] [reason]' },
  { name: 'vunmute', category: 'moderation', description: 'Voice unmute a member.', usage: '.vunmute @user' },
  { name: 'imute', category: 'moderation', description: 'Image mute a member.', usage: '.imute @user [duration] [reason]' },
  { name: 'iumute', category: 'moderation', description: 'Image unmute a member.', usage: '.iumute @user' },
  { name: 'rmute', category: 'moderation', description: 'Reaction mute a member.', usage: '.rmute @user [duration] [reason]' },
  { name: 'rumute', category: 'moderation', description: 'Reaction unmute a member.', usage: '.rumute @user' },
  { name: 'tmuted', category: 'moderation', description: 'View temporarily muted members.', usage: '.tmuted' },
  { name: 'tmutedinfo', category: 'moderation', description: 'View info about a temp mute.', usage: '.tmutedinfo @user' },
  { name: 'jail', category: 'moderation', description: 'Jail a member.', usage: '.jail @user [reason]' },
  { name: 'unjail', category: 'moderation', description: 'Unjail a member.', usage: '.unjail @user' },
  { name: 'jailsetup', category: 'moderation', description: 'Set up the jail system.', usage: '.jailsetup' },
  { name: 'warn', category: 'moderation', description: 'Warn a member.', usage: '.warn @user [reason]' },
  { name: 'warnings', category: 'moderation', description: 'View warnings for a member.', usage: '.warnings [@user]' },
  { name: 'clearwarn', category: 'moderation', description: 'Clear warnings for a member.', usage: '.clearwarn @user [count]' },
  { name: 'modlogs', category: 'moderation', description: 'View moderation logs.', usage: '.modlogs [@user]' },
  { name: 'cases', category: 'moderation', description: 'View moderation cases.', usage: '.cases [@user]' },
  { name: 'slowmode', category: 'moderation', description: 'Set channel slowmode.', usage: '.slowmode <duration>' },
  { name: 'lock', category: 'moderation', description: 'Lock a channel.', usage: '.lock [#channel]' },
  { name: 'unlock', category: 'moderation', description: 'Unlock a channel.', usage: '.unlock [#channel]' },
  { name: 'hide', category: 'moderation', description: 'Hide a channel.', usage: '.hide [#channel]' },
  { name: 'unhide', category: 'moderation', description: 'Unhide a channel.', usage: '.unhide [#channel]' },
  { name: 'purge', category: 'moderation', description: 'Purge messages.', usage: '.purge <amount>' },
  { name: 'nuke', category: 'moderation', description: 'Nuke and recreate a channel.', usage: '.nuke [#channel] [reason]' },
  { name: 'nick', category: 'moderation', description: 'Change a member nickname.', usage: '.nick @user <name>' },
  { name: 'nickreset', category: 'moderation', description: 'Reset a member nickname.', usage: '.nickreset @user' },
  { name: 'nicklock', category: 'moderation', description: 'Lock a member nickname.', usage: '.nicklock @user <name>' },
  { name: 'nickunlock', category: 'moderation', description: 'Unlock a member nickname.', usage: '.nickunlock @user' },
  { name: 'stickyroles', category: 'moderation', description: 'Manage sticky roles.', usage: '.stickyroles <action>', subcommands: ['add @user @role', 'remove @user @role', 'list @user'] }
,
  // ── Roleplay ──
  { name: 'hug', aliases: ['hg'], category: 'roleplay', description: 'Hug someone.', usage: '.hug [@user]' },
  { name: 'kiss', aliases: ['ks'], category: 'roleplay', description: 'Kiss someone.', usage: '.kiss [@user]' },
  { name: 'slap', aliases: ['sp'], category: 'roleplay', description: 'Slap someone.', usage: '.slap [@user]' },
  { name: 'pat', aliases: ['pt'], category: 'roleplay', description: 'Pat someone.', usage: '.pat [@user]' },
  { name: 'cuddle', aliases: ['cd'], category: 'roleplay', description: 'Cuddle someone.', usage: '.cuddle [@user]' },
  { name: 'poke', aliases: ['pk'], category: 'roleplay', description: 'Poke someone.', usage: '.poke [@user]' },
  { name: 'tickle', aliases: ['tk'], category: 'roleplay', description: 'Tickle someone.', usage: '.tickle [@user]' },
  { name: 'feed', aliases: ['fd'], category: 'roleplay', description: 'Feed someone.', usage: '.feed [@user]' },
  { name: 'bite', aliases: ['bt'], category: 'roleplay', description: 'Bite someone.', usage: '.bite [@user]' },
  { name: 'bonk', aliases: ['bk'], category: 'roleplay', description: 'Bonk someone.', usage: '.bonk [@user]' },
  { name: 'highfive', aliases: ['hf'], category: 'roleplay', description: 'High-five someone.', usage: '.highfive [@user]' },
  { name: 'wave', aliases: ['wv'], category: 'roleplay', description: 'Wave at someone.', usage: '.wave [@user]' },
  { name: 'wink', aliases: ['wk'], category: 'roleplay', description: 'Wink at someone.', usage: '.wink [@user]' },
  { name: 'blush', aliases: ['bl'], category: 'roleplay', description: 'Blush.', usage: '.blush' },
  { name: 'cry', aliases: ['cr'], category: 'roleplay', description: 'Cry.', usage: '.cry' },
  { name: 'dance', aliases: ['dn'], category: 'roleplay', description: 'Dance.', usage: '.dance' },
  { name: 'laugh', aliases: ['lh'], category: 'roleplay', description: 'Laugh.', usage: '.laugh' },
  { name: 'shrug', aliases: ['sh'], category: 'roleplay', description: 'Shrug.', usage: '.shrug' },
  { name: 'sleep', aliases: ['sp2'], category: 'roleplay', description: 'Sleep.', usage: '.sleep' },
  { name: 'think', aliases: ['th'], category: 'roleplay', description: 'Think.', usage: '.think' },
  { name: 'yes', aliases: ['ys'], category: 'roleplay', description: 'Yes reaction.', usage: '.yes' },
  { name: 'cool', aliases: ['cl'], category: 'roleplay', description: 'Cool reaction.', usage: '.cool' },
  { name: 'drool', aliases: ['dr'], category: 'roleplay', description: 'Drool reaction.', usage: '.drool' },
  { name: 'sweat', aliases: ['sw'], category: 'roleplay', description: 'Sweat reaction.', usage: '.sweat' },
  { name: 'woah', aliases: ['wh2'], category: 'roleplay', description: 'Woah reaction.', usage: '.woah' }
,
  // ── Staff ──
  { name: 'staff', aliases: ['sf'], category: 'staff', description: 'Manage staff members.', usage: '.staff <action>', subcommands: ['add @user', 'remove @user', 'list', 'info @user'] },
  { name: 'staffinfo', aliases: ['si2'], category: 'staff', description: 'View staff info.', usage: '.staffinfo [@user]' },
  { name: 'stafflist', aliases: ['sl2'], category: 'staff', description: 'List all staff.', usage: '.stafflist' },
  { name: 'stafftrack', aliases: ['st2'], category: 'staff', description: 'Track staff activity.', usage: '.stafftrack [@user]' },
  { name: 'staffreset', aliases: ['sr'], category: 'staff', description: 'Reset staff data.', usage: '.staffreset @user' }
,
  // ── Utility ──
  { name: 'snipe', aliases: ['sn'], category: 'utility', description: 'View recently deleted messages.', usage: '.snipe [count]' },
  { name: 'editsnipe', aliases: ['es'], category: 'utility', description: 'View a recently edited message.', usage: '.editsnipe' },
  { name: 'reactionsnipe', aliases: ['rs'], category: 'utility', description: 'View a recently removed reaction.', usage: '.reactionsnipe' },
  { name: 'reactionhistory', aliases: ['rh2'], category: 'utility', description: 'View recent reaction history.', usage: '.reactionhistory [count]' },
  { name: 'clearsnipe', aliases: ['cs'], category: 'utility', adminOnly: true, description: 'Clear the snipe cache.', usage: '.clearsnipe' },
  { name: 'timer', aliases: ['tm'], category: 'utility', description: 'Set a reminder timer.', usage: '.timer <duration> <text>', subcommands: ['<duration> <text>', 'list', 'cancel <id>'] },
  { name: 'reminder', aliases: ['rm'], category: 'utility', description: 'Set a reminder.', usage: '.reminder <time> <text>' },
  { name: 'reactionrole', aliases: ['rr'], category: 'utility', description: 'Configure emoji reaction roles.', usage: '.reactionrole <action>', subcommands: ['add <message-id> <emoji> @role', 'remove <message-id> <emoji>', 'list', 'clear <message-id>'] },
  { name: 'giveaway', aliases: ['gw2'], category: 'utility', description: 'Create and manage giveaways.', usage: '.giveaway <action>', subcommands: ['start <time> <winners> <prize>', 'end <id>', 'reroll <id>', 'cancel <id>', 'list', 'edit <id>'] },
  { name: 'autorole', aliases: ['ar2'], category: 'utility', description: 'Configure automatic roles.', usage: '.autorole <action>', subcommands: ['add @role', 'remove @role', 'list'] },
  { name: 'buttonrole', aliases: ['br2'], category: 'utility', description: 'Configure button roles.', usage: '.buttonrole <action>', subcommands: ['add <message-id> <label> @role', 'remove <message-id> <label>', 'list'] }
,
  // ── Server ──
  { name: 'serverinfo', aliases: ['si'], category: 'server', description: 'View detailed server information.', usage: '.serverinfo' },
  { name: 'icon', aliases: ['ico'], category: 'server', description: 'View the server icon.', usage: '.icon' },
  { name: 'splash', aliases: ['spl'], category: 'server', description: 'View the server splash.', usage: '.splash' },
  { name: 'banner', aliases: ['bnr'], category: 'server', description: 'View the server banner.', usage: '.banner' },
  { name: 'seticon', aliases: ['sico'], category: 'server', adminOnly: true, description: 'Set the server icon.', usage: '.seticon <url>' },
  { name: 'setsplashbackground', aliases: ['ssb'], category: 'server', adminOnly: true, description: 'Set the server invite splash background.', usage: '.setsplashbackground <url>' },
  { name: 'setbanner', aliases: ['sban'], category: 'server', adminOnly: true, description: 'Set the server banner.', usage: '.setbanner <url>' },
  { name: 'boosts', aliases: ['bst'], category: 'server', description: 'View server boost information.', usage: '.boosts' },
  { name: 'invites', aliases: ['inv'], category: 'server', description: 'View server invites.', usage: '.invites [@user]' },
  { name: 'firstmessage', aliases: ['fm'], category: 'server', description: 'Find the first message in a channel.', usage: '.firstmessage [#channel]' },
  { name: 'roles', aliases: ['rl'], category: 'server', description: 'View server roles list.', usage: '.roles' },
  { name: 'membercount', aliases: ['mc'], category: 'server', description: 'View server member count.', usage: '.membercount' }
,
  // ── Giveaways ──
  { name: 'giveaway', aliases: ['gw', 'gw2', 'giveaways'], category: 'giveaways', description: 'Create and manage giveaways.', usage: '.giveaway <action>', subcommands: ['start <time> <winners> <prize>', 'end <id>', 'reroll <id>', 'cancel <id>', 'list', 'edit <id>'] }
];

const ROLEPLAY_MISSING = ["yes", "cool", "drool", "sweat", "woah"];
for (const name of ROLEPLAY_MISSING) {
  HELP_SUPPLEMENTS.push({
    name,
    category: 'roleplay',
    description: `${titleCase(name)} roleplay reaction.`,
    usage: `.${name}`,
  });
}

function titleCase(value) {
  return String(value || '').replace(/[_-]+/g, ' ').replace(/\b\w/g, char => char.toUpperCase());
}

function categoryLabel(category) {
  return CATEGORY_META[category]?.label ?? titleCase(category);
}

function categoryEmoji(category) {
  return CATEGORY_META[category]?.emoji ?? "📚";
}

function clip(value, length = 100) {
  const text = String(value ?? '').replace(/\s+/g, ' ').trim();
  return text.length > length ? `${text.slice(0, length - 1)}…` : text;
}

function applyPrefix(value, prefix) {
  return String(value || '').replace(/^[,.]/, prefix);
}

function stripPrefix(value) {
  return String(value || '').trim().replace(/^[,.!]/, '').toLowerCase();
}

function commandCount(commands) {
  return commands.reduce((total, command) => total + 1 + (command.subcommands?.length || 0), 0);
}

function parameterCount(commands) {
  const count = value => (String(value || '').match(/<[^>]+>|\[[^\]]+\]/g) || []).length;
  return commands.reduce((total, command) => total + count(command.usage) +
    (command.subcommands || []).reduce((subTotal, subcommand) =>
      subTotal + count(typeof subcommand === "object" ? subcommand.name : subcommand), 0), 0);
}

function commandParams(def) {
  if (!def.usage) return 'n/a';
  const usage = String(def.usage).trim();
  const fullName = def.name.replace(/[\[\]*+?^${}()|\[\]\\]/g, '\\$&');
  const fullCommand = new RegExp(`^[,.]?${fullName}(?:\s+|$)`, 'i');
  const params = fullCommand.test(usage)
    ? usage.replace(fullCommand, '').trim()
    : usage.replace(/^[,.]?\S+\s*/, '').trim();
  return params || 'n/a';
}

function commandSyntax(def, prefix, extra = '') {
  const params = commandParams(def);
  const base = `${prefix}${def.name}${params !== 'n/a' ? ` ${params}` : ''}`;
  return `${base}${extra ? ` ${extra}` : ''}`;
}

function normalizeSubcommand(def, subcommand, prefix) {
  const isObject = typeof subcommand === 'object' && subcommand !== null;
  let usage = String(isObject ? subcommand.name : subcommand || '').trim();
  let description = isObject ? (subcommand.description || '') : '';

  if (!description) {
    const separator = usage.match(/\s+[—–-]\s+/);
    if (separator) {
      const parts = usage.split(separator[0]);
      usage = parts.shift().trim();
      description = parts.join(separator[0]).trim();
    }
  }

  usage = usage.replace(/^[,.]/, '');
  const commandName = def.name.toLowerCase();
  if (usage.toLowerCase().startsWith(`${commandName} `)) {
    usage = usage.slice(def.name.length).trim();
  } else if (usage.toLowerCase() === commandName) {
    usage = '';
  }

  const parentAction = def.name.split(/\s+/).pop().toLowerCase();
  if (usage.toLowerCase().startsWith(`${parentAction} `)) {
    usage = usage.slice(parentAction.length).trim();
  }

  const parameters = isObject && subcommand.parameters
    ? subcommand.parameters
    : usage.match(/(<[^>]+>|\[[^\]]+\]|\|)+/g)?.join(' ') || 'n/a';

  return {
    usage,
    description: description || `Run the ${usage || 'default'} action for this command.`,
    aliases: isObject && subcommand.aliases
      ? Array.isArray(subcommand.aliases) ? subcommand.aliases : [subcommand.aliases]
      : [],
    parameters,
    example: isObject && subcommand.example
      ? subcommand.example
      : `${prefix}${def.name}${usage ? ` ${usage}` : ''}`,
    syntax: `${prefix}${def.name}${usage ? ` ${usage}` : ''}`,
  };
}

function getHelpCommands() {
  const commands = getAll()
    .filter(command => !command.hidden)
    .map(command => HELP_OVERRIDES[command.name]
      ? { ...command, ...HELP_OVERRIDES[command.name] }
      : command);
  const names = new Set(commands.map(command => command.name));
  for (const supplement of HELP_SUPPLEMENTS) {
    if (names.has(supplement.name)) {
      const existing = commands.find(command => command.name === supplement.name);
      if (supplement.aliases?.length) {
        existing.aliases = [...new Set([...(existing.aliases || []), ...supplement.aliases])];
      }
      continue;
    }
    commands.push(supplement);
    names.add(supplement.name);
  }
  return commands;
}

function buildCategoryCatalog(commands, prefix) {
  const sourceCategories = new Map();
  for (const command of commands) {
    if (!sourceCategories.has(command.category)) sourceCategories.set(command.category, []);
    sourceCategories.get(command.category).push(command);
  }
  return [...sourceCategories.entries()]
    .map(([category, categoryCommands]) => makeCategory(category, categoryCommands, [category], prefix));
}

function makeCategory(key, commands, sourceCategories, prefix) {
  const entries = [];
  for (const def of commands) {
    entries.push({
      def,
      subcommand: null,
      searchText: [def.name, ...(def.aliases || [])].join(' ').toLowerCase(),
    });
    for (const subcommand of def.subcommands || []) {
      const normalized = normalizeSubcommand(def, subcommand, prefix);
      entries.push({
        def,
        subcommand: normalized,
        searchText: [
          def.name,
          normalized.usage,
          normalized.syntax,
          ...normalized.aliases,
          normalized.description,
        ].join(' ').toLowerCase(),
      });
    }
  }
  return {
    key,
    label: key === 'misc' ? 'Misc' : categoryLabel(key),
    emoji: key === 'misc' ? '📦' : categoryEmoji(key),
    commands,
    entries,
    total: entries.length,
    commandTotal: commands.length,
    subcommandTotal: Math.max(0, entries.length - commands.length),
    parameterTotal: parameterCount(commands),
    sourceCategories,
  };
}

function findCategory(catalog, query) {
  const normalized = stripPrefix(query);
  return catalog.find(category =>
    category.key.toLowerCase() === normalized ||
    category.label.toLowerCase() === normalized ||
    category.sourceCategories.some(source => source.toLowerCase() === normalized) ||
    category.entries.some(entry => entry.def.name.toLowerCase() === normalized ||
      entry.def.name.toLowerCase().startsWith(`${normalized} `))
  );
}

function findEntry(catalog, query) {
  const normalized = stripPrefix(query);
  let fuzzy = null;
  for (const category of catalog) {
    for (const [index, entry] of category.entries.entries()) {
      const exact = entry.searchText.split(/\s+/).includes(normalized) ||
        entry.def.name.toLowerCase() === normalized ||
        entry.subcommand?.syntax.toLowerCase().replace(/^[,.]/, '') === normalized ||
        `${entry.def.name} ${entry.subcommand?.usage || ''}`.trim().toLowerCase() === normalized;
      if (exact) return { category, index, entry };
      if (!fuzzy && entry.searchText.includes(normalized)) fuzzy = { category, index, entry };
    }
  }
  return fuzzy;
}

function findHelpTarget(catalog, query) {
  const entry = findEntry(catalog, query);
  if (entry) return entry;
  const category = findCategory(catalog, query);
  if (!category) return null;
  const normalized = stripPrefix(query);
  const index = category.entries.findIndex(item =>
    item.def.name.toLowerCase() === normalized ||
    item.def.name.toLowerCase().startsWith(`${normalized} `)
  );
  return { category, index: index >= 0 ? index : 0, entry: category.entries[index >= 0 ? index : 0] };
}

function shouldShowHelpForCommand(query, prefix = ',') {
  const normalized = stripPrefix(query);
  if (new Set([
    'nuke', 'levels', 'vc', 'voice', 'antiraid', 'antinuke',
    'automod', 'filter', 'reaction', 'previousreact', 'noselfreact',
  ]).has(normalized)) return false;

  const catalog = buildCategoryCatalog(getHelpCommands(), prefix);
  const target = findHelpTarget(catalog, query);
  if (!target) return false;
  const isNamedCategory = catalog.some(category =>
    category.key.toLowerCase() === normalized ||
    category.label.toLowerCase() === normalized ||
    category.sourceCategories.some(source => source.toLowerCase() === normalized)
  );
  const isExactCommand = target.entry &&
    (target.entry.def.name.toLowerCase() === normalized ||
    (target.entry.def.aliases || []).some(alias => alias.toLowerCase() === normalized));
  const isCommandGroup = !isNamedCategory && !isExactCommand &&
    target.category.entries.some(entry => entry.def.name.toLowerCase().startsWith(`${normalized} `));
  return isNamedCategory || isCommandGroup || Boolean(target.entry.def.subcommands?.length);
}

function commandAliases(entry, prefix) {
  const aliases = entry.subcommand?.aliases?.length
    ? entry.subcommand.aliases
    : entry.def.aliases || [];
  return aliases.length ? aliases.map(alias => `${prefix}${alias}`).join(', ') : 'n/a';
}

function buildHomeEmbed(invoker) {
  return new EmbedBuilder()
    .setColor(COLORS.primary)
    .setAuthor({
      name: invoker.displayName ?? invoker.username,
      iconURL: invoker.displayAvatarURL?.({ size: 64 }),
    })
    .setTitle('📚 Command Guide')
    .setDescription('Choose a category below or search for a command. Commands and subcommands are browsed one page at a time.');
}

function buildCommandEmbed({ entry, page, pageCount, category, invoker, prefix }) {
  const { def, subcommand } = entry;
  const syntax = subcommand?.syntax || commandSyntax(def, prefix);
  const parameters = subcommand?.parameters || commandParams(def);
  const example = applyPrefix(subcommand?.example || def.examples?.[0] || syntax, prefix);
  const description = subcommand
    ? subcommand.description
    : (def.description || 'No description available.');

  return new EmbedBuilder()
    .setColor(COLORS.primary)
    .setAuthor({
      name: invoker.displayName ?? invoker.username,
      iconURL: invoker.displayAvatarURL?.({ size: 64 }),
    })
    .setTitle(`${category.emoji} ${syntax}`)
    .setDescription(description)
    .addFields(
      { name: 'Aliases', value: commandAliases(entry, prefix), inline: true },
      { name: 'Parameters', value: parameters || 'n/a', inline: true },
      {
        name: 'Usage',
        value: `\`\`\`\nSyntax: ${syntax}\nExample: ${example}\n\`\`\``,
        inline: false,
      },
    )
    .setFooter({ text: `Page ${page}/${pageCount} • Module: ${category.label}` });
}

function selectRow(customId, placeholder, options) {
  return new ActionRowBuilder().addComponents(
    new StringSelectMenuBuilder()
      .setCustomId(customId)
      .setPlaceholder(placeholder)
      .addOptions(options),
  );
}

function button(customId, label, style = ButtonStyle.Secondary, disabled = false) {
  return new ButtonBuilder()
    .setCustomId(customId)
    .setLabel(label)
    .setStyle(style)
    .setDisabled(disabled);
}

function navRow(page, pageCount) {
  return new ActionRowBuilder().addComponents(
    button('h_prev', 'Prev', ButtonStyle.Primary, page <= 1),
    button('h_next', 'Next', ButtonStyle.Primary, page >= pageCount),
    button('h_page', 'Page'),
    button('h_search', 'Search'),
    button('h_close', 'Close', ButtonStyle.Danger),
  );
}

function buildPageModal(customId, pageCount) {
  return new ModalBuilder()
    .setCustomId(customId)
    .setTitle('Go to help page')
    .addComponents(
      new ActionRowBuilder().addComponents(
        new TextInputBuilder()
          .setCustomId('h_page_number')
          .setLabel(`Page number (1-${pageCount})`)
          .setPlaceholder(`Enter a number from 1 to ${pageCount}`)
          .setStyle(TextInputStyle.Short)
          .setRequired(true)
          .setMaxLength(8),
      ),
    );
}

function buildSearchModal(customId) {
  return new ModalBuilder()
    .setCustomId(customId)
    .setTitle('Search command guide')
    .addComponents(
      new ActionRowBuilder().addComponents(
        new TextInputBuilder()
          .setCustomId('h_search_query')
          .setLabel('Command, subcommand, or category')
          .setPlaceholder('e.g. autoresponder add, moderation, antinuke')
          .setStyle(TextInputStyle.Short)
          .setRequired(true)
          .setMaxLength(100),
      ),
    );
}

function homeComponents(catalog) {
  return [
    selectRow('h_category', 'Browse a command category', catalog.map(category => ({
      label: category.label,
      value: category.key,
      description: `${category.total} pages • ${category.commandTotal} commands • ${category.subcommandTotal} subcommands • ${category.parameterTotal} params`,
      emoji: category.emoji,
    }))),
    new ActionRowBuilder().addComponents(
      button('h_search', 'Search'),
      button('h_close', 'Close', ButtonStyle.Danger),
    ),
  ];
}

function categorySelectRow(catalog, selectedKey) {
  return selectRow('h_category', 'Switch command category', catalog.map(category => ({
    label: category.label,
    value: category.key,
    description: `${category.total} pages • ${category.parameterTotal} params`,
    emoji: category.emoji,
    default: category.key === selectedKey,
  })));
}

function entrySelectRow(category, page, prefix) {
  const windowStart = Math.floor(page / 25) * 25;
  const visible = category.entries.slice(windowStart, windowStart + 25);
  return selectRow(
    'h_entry',
    `Jump to a command (pages ${windowStart + 1}-${Math.min(category.total, windowStart + visible.length)})`,
    visible.map((item, offset) => {
      const index = windowStart + offset;
      const syntax = item.subcommand?.syntax || commandSyntax(item.def, prefix);
      const params = item.subcommand?.parameters || commandParams(item.def);
      return {
        label: clip(syntax.replace(/^[,.]/, ''), 100),
        value: String(index),
        description: clip(`Page ${index + 1} • params: ${params}`, 100),
        default: index === page,
      };
    }),
  );
}

async function handleHelp(ctx, args, client, prefix = ',') {
  const isInteraction = !!ctx.deferReply;
  if (isInteraction) {
    try { await ctx.deferReply(); } catch {}
  }

  const invoker = isInteraction ? (ctx.member ?? ctx.user) : ctx.member;
  const authorId = isInteraction ? ctx.user.id : ctx.author.id;
  const allCommands = getHelpCommands();
  const catalog = buildCategoryCatalog(allCommands, prefix);
  const query = args.join(' ').trim();
  const target = query ? findHelpTarget(catalog, query) : null;

  if (query && !target) {
    const message = `<:warn:1528892150698348727> <@${authorId}>: No command or category matching \`${query}\` found.`;
    if (isInteraction) return ctx.editReply({ content: message });
    return ctx.channel.send({ content: message });
  }

  const state = {
    category: target?.category || null,
    page: target?.index || 0,
    mode: target ? 'category' : 'home',
  };

  const render = () => {
    if (state.mode === 'home') {
      return { embeds: [buildHomeEmbed(invoker)], components: homeComponents(catalog) };
    }

    const pageCount = state.category.entries.length;
    state.page = Math.min(Math.max(state.page, 0), pageCount - 1);
    return {
      embeds: [buildCommandEmbed({
        entry: state.category.entries[state.page],
        page: state.page + 1,
        pageCount,
        category: state.category,
        invoker,
        prefix,
      })],
      components: [
        categorySelectRow(catalog, state.category.key),
        entrySelectRow(state.category, state.page, prefix),
        navRow(state.page + 1, pageCount),
      ],
    };
  };

  let sent;
  try {
    if (isInteraction) {
      await ctx.editReply(render());
      sent = await ctx.fetchReply().catch(() => null);
    } else {
      sent = await ctx.channel.send(render());
    }
  } catch {
    return;
  }
  if (!sent) return;

  const modalId = `h_search_${sent.id}`;
  const pageModalId = `h_page_${sent.id}`;
  const modalHandler = async interaction => {
    if (!interaction.isModalSubmit?.() ||
      ![modalId, pageModalId].includes(interaction.customId) ||
      interaction.user.id !== authorId) return;

    if (interaction.customId === pageModalId) {
      const requested = Number.parseInt(interaction.fields.getTextInputValue('h_page_number'), 10);
      const pageCount = state.category?.entries.length || 0;
      if (!state.category || !Number.isInteger(requested) || requested < 1 || requested > pageCount) {
        return interaction.reply({
          content: `Enter a page number from 1 to ${pageCount || 1}.`,
          ephemeral: true,
        }).catch(() => {});
      }
      state.page = requested - 1;
      return interaction.update(render()).catch(() => {});
    }

    const searchQuery = interaction.fields.getTextInputValue('h_search_query').trim();
    const searchTarget = findHelpTarget(catalog, searchQuery);
    if (!searchTarget) {
      return interaction.reply({
        content: `No command, subcommand, or category matching \`${searchQuery}\` was found.`,
        ephemeral: true,
      }).catch(() => {});
    }
    state.category = searchTarget.category;
    state.page = searchTarget.index;
    state.mode = 'category';
    return interaction.update(render()).catch(() => {});
  };
  client?.on('interactionCreate', modalHandler);

  const collector = sent.createMessageComponentCollector({
    time: TIMEOUT,
    filter: interaction => {
      if (interaction.user.id !== authorId) {
        interaction.reply({ content: '❌ This menu belongs to someone else.', ephemeral: true });
        return false;
      }
      return true;
    },
  });

  collector.on('collect', async interaction => {
    try {
      const id = interaction.customId;
      if (id === 'h_close') {
        collector.stop('closed');
        return interaction.message.delete().catch(() => interaction.update({ components: [] }));
      }
      if (id === 'h_search') {
        return interaction.showModal(buildSearchModal(modalId));
      }
      if (id === 'h_page') {
        return interaction.showModal(buildPageModal(pageModalId, state.category.entries.length));
      }
      if (id === 'h_category') {
        state.category = catalog.find(category => category.key === interaction.values[0]);
        state.mode = state.category ? 'category' : 'home';
        state.page = 0;
      } else if (id === 'h_entry') {
        state.mode = 'category';
        state.page = Number.parseInt(interaction.values[0], 10) || 0;
      } else if (id === 'h_prev') {
        state.page = Math.max(0, state.page - 1);
      } else if (id === 'h_next') {
        state.page = Math.min(state.category.entries.length - 1, state.page + 1);
      }
      await interaction.update(render());
    } catch {}
  });

  collector.on('end', (_collected, reason) => {
    client?.off('interactionCreate', modalHandler);
    if (reason !== 'closed') sent.edit({ components: [] }).catch(() => {});
  });
}

module.exports = {
  handleHelp,
  shouldShowHelpForCommand,
};
