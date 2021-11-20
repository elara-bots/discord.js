'use strict';

const Base = require('./Base');
const Role = require('./Role');
const TextBasedChannel = require('./interfaces/TextBasedChannel');
const { Error } = require('../errors');
const GuildMemberRoleManager = require('../managers/GuildMemberRoleManager');
const Permissions = require('../util/Permissions');
let Structures;

/**
 * Represents a member of a guild on Discord.
 * @implements {TextBasedChannel}
 * @extends {Base}
 */
class GuildMember extends Base {
  /**
   * @param {Client} client The instantiating client
   * @param {Object} data The data for the guild member
   * @param {Guild} guild The guild the member is part of
   */
  constructor(client, data, guild) {
    super(client);

    /**
     * The guild that this member is part of
     * @type {Guild}
     */
    this.guild = guild;

    /**
     * The timestamp the member joined the guild at
     * @type {?number}
     */
    this.joinedTimestamp = null;

    /**
     * The timestamp of when the member used their Nitro boost on the guild, if it was used
     * @type {?number}
     */
    this.premiumSinceTimestamp = null;

    /**
     * Whether the member has been removed from the guild
     * @type {boolean}
     */
    this.deleted = false;

    /**
     * The nickname of this member, if they have one
     * @type {?string}
     */
    this.nickname = null;
    
     /**
     * When this member will be unmuted, if they are muted
     * @type {?number}
     */
    this.communicationDisabledUntilTimestamp = null;

    this._roles = [];
    if (data) this._patch(data);
  }

  _patch(data) {
    if ('user' in data) {
      /**
       * The user that this guild member instance represents
       * @type {User}
       */
      this.user = this.client.users.add(data.user, true);
    }

    if ('nick' in data) this.nickname = data.nick;
    if ('joined_at' in data) this.joinedTimestamp = new Date(data.joined_at).getTime();
    if ('premium_since' in data) this.premiumSinceTimestamp = new Date(data.premium_since).getTime();
    if ('roles' in data) this._roles = data.roles;
    if ('communication_disabled_until' in data) {
      this.communicationDisabledUntilTimestamp = data.communication_disabled_until
      ?  new Date(data.communication_disabled_until).getTime()
      :  null;
    }
    if ('avatar' in data) {
      /**
       * The ID of the member's guild avatar
       * @type {?string}
       */
      this.avatar = data.avatar;
    } else if (typeof this.avatar !== 'string') {
      this.avatar = null;
    }
    this.pending = data.pending ?? false;
  }

  _clone() {
    const clone = super._clone();
    clone._roles = this._roles.slice();
    return clone;
  }

  /**
   * A manager for the roles belonging to this member
   * @type {GuildMemberRoleManager}
   * @readonly
   */
  get roles() {
    return new GuildMemberRoleManager(this);
  }

  /**
   * The voice state of this member
   * @type {VoiceState}
   * @readonly
   */
  get voice() {
    if (!Structures) Structures = require('../util/Structures');
    const VoiceState = Structures.get('VoiceState');
    return this.guild.voiceStates.cache.get(this.id) || new VoiceState(this.guild, { user_id: this.id });
  }

  /**
   * The time this member joined the guild
   * @type {?Date}
   * @readonly
   */
  get joinedAt() {
    return this.joinedTimestamp ? new Date(this.joinedTimestamp) : null;
  }
  
    /**
   * Whether this member is kickable by the client user
   * @type {boolean}
   * @readonly
   */
  get kickable() {
    return this.manageable && this.guild.me.permissions.has(Permissions.FLAGS.KICK_MEMBERS);
  }

  /**
   * Whether this member is bannable by the client user
   * @type {boolean}
   * @readonly
   */
  get bannable() {
    return this.manageable && this.guild.me.permissions.has(Permissions.FLAGS.BAN_MEMBERS);
  }

  /**
   * The time of when the member used their Nitro boost on the guild, if it was used
   * @type {?Date}
   * @readonly
   */
  get premiumSince() {
    return this.premiumSinceTimestamp ? new Date(this.premiumSinceTimestamp) : null;
  }
  
  /**
   * The time the member will be unmuted, if muted
   * @type {?Date}
   * @readonly
   */
  get communicationDisabledUntil() {
    return this.communicationDisabledUntilTimestamp ? new Date(this.communicationDisabledUntilTimestamp) : null;
  }

  /**
   * The presence of this guild member
   * @type {Presence}
   * @readonly
   */
  get presence() {
    if (!Structures) Structures = require('../util/Structures');
    const Presence = Structures.get('Presence');
    return (
      this.guild.presences.cache.get(this.id) ||
      new Presence(this.client, {
        user: {
          id: this.id,
        },
        guild: this.guild,
      })
    );
  }

  /**
   * The displayed color of this member in base 10
   * @type {number}
   * @readonly
   */
  get displayColor() {
    const role = this.roles.color;
    return (role && role.color) || 0;
  }

  /**
   * The displayed color of this member in hexadecimal
   * @type {string}
   * @readonly
   */
  get displayHexColor() {
    const role = this.roles.color;
    return (role && role.hexColor) || '#000000';
  }

  /**
   * The ID of this member
   * @type {Snowflake}
   * @readonly
   */
  get id() {
    return this.user.id;
  }

  /**
   * The nickname of this member, or their username if they don't have one
   * @type {?string}
   * @readonly
   */
  get displayName() {
    return this.nickname || this.user.username;
  }

  /**
   * The overall set of permissions for this member, taking only roles into account
   * @type {Readonly<Permissions>}
   * @readonly
   */
  get permissions() {
    if (this.user.id === this.guild.ownerID) return new Permissions(Permissions.ALL).freeze();
    return new Permissions(this.roles.cache.map(role => role.permissions)).freeze();
  }

  /**
   * Whether the client user is above this user in the hierarchy, according to role position and guild ownership.
   * This is a prerequisite for many moderative actions.
   * @type {boolean}
   * @readonly
   */
  get manageable() {
    if (this.user.id === this.guild.ownerID) return false;
    if (this.user.id === this.client.user.id) return false;
    if (this.client.user.id === this.guild.ownerID) return true;
    if (!this.guild.me) throw new Error('GUILD_UNCACHED_ME');
    return this.guild.me.roles.highest.comparePositionTo(this.roles.highest) > 0;
  }

  /**
   * Returns `channel.permissionsFor(guildMember)`. Returns permissions for a member in a guild channel,
   * taking into account roles and permission overwrites.
   * @param {ChannelResolvable} channel The guild channel to use as context
   * @returns {Readonly<Permissions>}
   */
  permissionsIn(channel) {
    channel = this.guild.channels.resolve(channel);
    if (!channel) throw new Error('GUILD_CHANNEL_RESOLVE');
    return channel.memberPermissions(this);
  }
  
  /**
   * Checks if any of this member's roles have a permission.
   * @param {PermissionResolvable} permission Permission(s) to check for
   * @param {Object} [options] Options
   * @param {boolean} [options.checkAdmin=true] Whether to allow the administrator permission to override
   * @param {boolean} [options.checkOwner=true] Whether to allow being the guild's owner to override
   * @returns {boolean}
   */
  hasPermission(permission, { checkAdmin = true, checkOwner = true } = {}) {
    if (checkOwner && this.user.id === this.guild.ownerID) return true;
    const permissions = new Permissions(this.roles.cache.map(role => role.permissions));
    return permissions.has(permission, checkAdmin);
  }
  
  /**
   * A link to the member's guild avatar.
   * @param {ImageURLOptions} [options={}] Options for the Image URL
   * @returns {?string}
   */
  avatarURL({ format, size, dynamic } = {}) {
    if (!this.avatar) return null;
    return this.client.rest.cdn.GuildAvatar(this.guild.id, this.id, this.avatar, format, size, dynamic);
  }

  /**
   * A link to the member's guild avatar if they have one.
   * Otherwise a link to their user display avatar will be returned.
   * @param {ImageURLOptions} [options={}] Options for the Image URL
   * @returns {string}
   */
  displayAvatarURL(options) {
    return this.avatarURL(options) || this.user.displayAvatarURL(options);
  }

  /**
   * The data for editing a guild member.
   * @typedef {Object} GuildMemberEditData
   * @property {string} [nick] The nickname to set for the member
   * @property {Collection<Snowflake, Role>|RoleResolvable[]} [roles] The roles or role IDs to apply
   * @property {boolean} [mute] Whether or not the member should be muted
   * @property {boolean} [deaf] Whether or not the member should be deafened
   * @property {ChannelResolvable|null} [channel] Channel to move member to (if they are connected to voice), or `null`
   * if you want to kick them from voice
   */

  /**
   * Edits this member.
   * @param {GuildMemberEditData} data The data to edit the member with
   * @param {string} [reason] Reason for editing this user
   * @returns {Promise<GuildMember>}
   */
  async edit(data, reason) {
    // Clone the data object for immutability
    const _data = { ...data };
    if (_data.communicationDisabledUntil) {
      if (_data.communicationDisabledUntil instanceof Date) {
        _data.communication_disabled_until = _data.communicationDisabledUntil;
        if(_data.communication_disabled_until.getTime() < Date.now()) throw new Error('COMMUNICATION_DISABLED_PAST_DATE');
      } else {
        _data.communication_disabled_until = new Date(Date.now() + _data.communicationDisabledUntil * 1000);
        if(_data.communication_disabled_until.getTime() < Date.now()) throw new Error('COMMUNICATION_DISABLED_PAST_DATE');
      };
      _data.communication_disabled_until = _data.communication_disabled_until.toISOString();
      delete _data.communicationDisabledUntil;
    };
    if (_data.channel) {
        _data.channel = this.guild.channels.resolve(_data.channel);
      if (!_data.channel || _data.channel.type !== 'voice') {
        throw new Error('GUILD_VOICE_CHANNEL_RESOLVE');
      }
      _data.channel_id = _data.channel.id;
      _data.channel = undefined;
    } else if (_data.channel === null) {
      _data.channel_id = null;
      _data.channel = undefined;
    }
    if (_data.roles) _data.roles = _data.roles.map(role => (role instanceof Role ? role.id : role));
    let endpoint = this.client.api.guilds(this.guild.id);
    if (this.user.id === this.client.user.id) {
      const keys = Object.keys(_data);
      if (keys.length === 1 && keys[0] === 'nick') endpoint = endpoint.members('@me').nick;
      else endpoint = endpoint.members(this.id);
    } else {
      endpoint = endpoint.members(this.id);
    }
    const d = await endpoint.patch({ data: _data, reason });

    const clone = this._clone();
    d.user = this.user;
    clone._patch(d);
    return clone;
  }
  /**
   * Disables or enables communication for this member.
   * @param {?number | Date} seconds The duration in seconds or a date in the future until the member should have
   * their communication disabled. Passing `null` will enable communication for them. 
   * @param {string} [reason] Reason for setting the nickname
   * @returns {Promise<GuildMember>}
   */
  disableCommunication(seconds, reason) {
    return this.edit({ communicationDisabledUntil: seconds }, reason);
  }

  /**
   * Creates a DM channel between the client and this member.
   * @returns {Promise<DMChannel>}
   */
  createDM() {
    return this.user.createDM();
  }

  /**
   * Deletes any DMs with this member.
   * @returns {Promise<DMChannel>}
   */
  deleteDM() {
    return this.user.deleteDM();
  }

  /**
   * Kicks this member from the guild.
   * @param {string} [reason] Reason for kicking user
   * @returns {Promise<GuildMember>}
   */
  kick(reason) {
    return this.client.api
      .guilds(this.guild.id)
      .members(this.user.id)
      .delete({ reason })
      .then(() => this);
  }

  /**
   * Bans this guild member.
   * @param {Object} [options] Options for the ban
   * @param {number} [options.days=0] Number of days of messages to delete, must be between 0 and 7
   * @param {string} [options.reason] Reason for banning
   * @returns {Promise<GuildMember>}
   * @example
   * // ban a guild member
   * guildMember.ban({ days: 7, reason: 'They deserved it' })
   *   .then(console.log)
   *   .catch(console.error);
   */
  ban(options) {
    return this.guild.members.ban(this, options);
  }

  /**
   * Fetches this GuildMember.
   * @param {boolean} [force=false] Whether to skip the cache check and request the API
   * @returns {Promise<GuildMember>}
   */
  fetch(force = false) {
    return this.guild.members.fetch({ user: this.id, cache: true, force });
  }

  /**
   * Whether this guild member equals another guild member. It compares all properties, so for most
   * comparison it is advisable to just compare `member.id === member2.id` as it is significantly faster
   * and is often what most users need.
   * @param {GuildMember} member The member to compare with
   * @returns {boolean}
   */
   equals(member) {
    return (
      member instanceof this.constructor &&
      this.id === member.id &&
      this.guild.id === member.guild.id &&
      this.joinedTimestamp === member.joinedTimestamp &&
      this.avatar === member.avatar &&
      this.nickname === member.nickname &&
      this.pending === member.pending &&
      this.premiumSince === member.premiumSince &&
      (this._roles === member._roles ||
        (this._roles.length === member._roles.length && this._roles.every((role, i) => role === member._roles[i])))
    );
  }

  /**
   * When concatenated with a string, this automatically returns the user's mention instead of the GuildMember object.
   * @returns {string}
   * @example
   * // Logs: Hello from <@123456789012345678>!
   * console.log(`Hello from ${member}!`);
   */
  toString() {
    return `<@${this.nickname ? '!' : ''}${this.user.id}>`;
  }

  toJSON() {
    return super.toJSON({
      guild: 'guildID',
      user: 'userID',
      displayName: true,
      speaking: false,
      roles: true,
    });
  }

  // These are here only for documentation purposes - they are implemented by TextBasedChannel
  /* eslint-disable no-empty-function */
  send() {}
}

TextBasedChannel.applyToClass(GuildMember);

module.exports = GuildMember;
