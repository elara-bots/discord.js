'use strict';

const Base = require('./Base');
const TextBasedChannel = require('./interfaces/TextBasedChannel');
const { Error } = require('../errors');
const Snowflake = require('../util/Snowflake');
const UserFlags = require('../util/UserFlags');

let Structures;

/**
 * Represents a user on Discord.
 * @implements {TextBasedChannel}
 * @extends {Base}
 */
class User extends Base {
  /**
   * @param {Client} client The instantiating client
   * @param {Object} data The data for the user
   */
  constructor(client, data) {
    super(client);

    /**
     * The ID of the user
     * @type {Snowflake}
     */
    this.id = data.id;

    this.system = null;
    this.locale = null;
    this.flags = null;

    this._patch(data);
  }

  _patch(data) {
    if ('username' in data) {
      /**
       * The username of the user
       * @type {?string}
       */
      this.username = data.username;
    } else if (typeof this.username !== 'string') {
      this.username = null;
    }

    if ('bot' in data || typeof this.bot !== 'boolean') {
      /**
       * Whether or not the user is a bot
       * @type {boolean}
       */
      this.bot = Boolean(data.bot);
    }

    if ('discriminator' in data) {
      /**
       * A discriminator based on username for the user
       * @type {?string}
       */
      this.discriminator = data.discriminator;
    } else if (typeof this.discriminator !== 'string') {
      this.discriminator = null;
    }

    if ('avatar' in data) {
      /**
       * The ID of the user's avatar
       * @type {?string}
       */
      this.avatar = data.avatar;
    } else if (typeof this.avatar !== 'string') {
      this.avatar = null;
    }

    if ('banner' in data) {
      /**
       * The ID of the user's banner
       * @type {?string}
       */
      this.banner = data.banner;
    } else if (typeof this.banner !== 'string') {
      this.banner = null;
    }
    
    if ('system' in data) {
      /**
       * Whether the user is an Official Discord System user (part of the urgent message system)
       * @type {?boolean}
       */
      this.system = Boolean(data.system);
    }

    if ('locale' in data) {
      /**
       * The locale of the user's client (ISO 639-1)
       * @type {?string}
       */
      this.locale = data.locale;
    }

    if ('public_flags' in data) {
      /**
       * The flags for this user
       * @type {?UserFlags}
       */
      this.flags = new UserFlags(data.public_flags);
    }

  }

  /**
   * Whether this User is a partial
   * @type {boolean}
   * @readonly
   */
  get partial() {
    return typeof this.username !== 'string';
  }

  /**
   * The timestamp the user was created at
   * @type {number}
   * @readonly
   */
  get createdTimestamp() {
    return Snowflake.deconstruct(this.id).timestamp;
  }

  /**
   * The time the user was created at
   * @type {Date}
   * @readonly
   */
  get createdAt() {
    return new Date(this.createdTimestamp);
  }

  /**
   * The presence of this user
   * @type {Presence}
   * @readonly
   */
  get presence() {
    for (const guild of this.client.guilds.cache.values()) {
      if (guild.presences.cache.has(this.id)) return guild.presences.cache.get(this.id);
    }
    if (!Structures) Structures = require('../util/Structures');
    const Presence = Structures.get('Presence');
    return new Presence(this.client, { user: { id: this.id } });
  }

  /**
   * A link to the user's avatar.
   * @param {ImageURLOptions} [options={}] Options for the Image URL
   * @returns {?string}
   */
  avatarURL({ format, size, dynamic } = {}) {
    if (!this.avatar) return null;
    return this.client.rest.cdn.Avatar(this.id, this.avatar, format, size, dynamic);
  }
  
  /**
   * A link to the user's banner.
   * @param {ImageURLOptions} [options={}] Options for the Image URL
   * @returns {?string}
   */
  bannerURL({ format, size, dynamic } = {}) {
    if (!this.banner) return null;
    return this.client.rest.cdn.Banner(this.id, this.banner, format, size, dynamic);
  }

  /**
   * A link to the user's default avatar
   * @type {string}
   * @readonly
   */
  get defaultAvatarURL() {
    return this.client.rest.cdn.DefaultAvatar(this.discriminator % 5);
  }

  /**
   * A link to the user's avatar if they have one.
   * Otherwise a link to their default avatar will be returned.
   * @param {ImageURLOptions} [options={}] Options for the Image URL
   * @returns {string}
   */
  displayAvatarURL(options) {
    return this.avatarURL(options) || this.defaultAvatarURL;
  }

  /**
   * The Discord "tag" (e.g. `hydrabolt#0001`) for this user
   * @type {?string}
   * @readonly
   */
  get tag() {
    return typeof this.username === 'string' ? `${this.username}#${this.discriminator}` : null;
  }

  /**
   * The DM between the client's user and this user
   * @type {?DMChannel}
   * @readonly
   */
  get dmChannel() {
    return this.client.channels.cache.find(c => c.type === 'dm' && c.recipient.id === this.id) || null;
  }

  /**
   * Creates a DM channel between the client and the user.
   * @param {boolean} [force=false] Whether to skip the cache check and request the API
   * @returns {Promise<DMChannel>}
   */
  async createDM(force = false) {
    if (!force) {
      const { dmChannel } = this;
      if (dmChannel && !dmChannel.partial) return dmChannel;
    }

    const data = await this.client.api.users(this.client.user.id).channels.post({
      data: {
        recipient_id: this.id,
      },
    });
    return this.client.actions.ChannelCreate.handle(data).channel;
  }

  /**
   * Deletes a DM channel (if one exists) between the client and the user. Resolves with the channel if successful.
   * @returns {Promise<DMChannel>}
   */
  async deleteDM() {
    const { dmChannel } = this;
    if (!dmChannel) throw new Error('USER_NO_DMCHANNEL');
    const data = await this.client.api.channels(dmChannel.id).delete();
    return this.client.actions.ChannelDelete.handle(data).channel;
  }

  /**
   * Checks if the user is equal to another. It compares ID, username, discriminator, avatar, and bot flags.
   * It is recommended to compare equality by using `user.id === user2.id` unless you want to compare all properties.
   * @param {User} user User to compare with
   * @returns {boolean}
   */
  equals(user) {
    let equal =
      user &&
      this.id === user.id &&
      this.username === user.username &&
      this.discriminator === user.discriminator &&
      this.avatar === user.avatar && 
      this.banner === user.banner;

    return equal;
  }

  /**
   * Fetches this user's flags.
   * @param {boolean} [force=false] Whether to skip the cache check and request the AP
   * @returns {Promise<UserFlags>}
   */
  async fetchFlags(force = false) {
    if (this.flags && !force) return this.flags;
    const data = await this.client.api.users(this.id).get();
    this._patch(data);
    return this.flags;
  }

  /**
   * Fetches this user.
   * @param {boolean} [force=false] Whether to skip the cache check and request the AP
   * @returns {Promise<User>}
   */
  fetch(force = false) {
    return this.client.users.fetch(this.id, true, force);
  }

  /**
   * When concatenated with a string, this automatically returns the user's mention instead of the User object.
   * @returns {string}
   * @example
   * // Logs: Hello from <@123456789012345678>!
   * console.log(`Hello from ${user}!`);
   */
  toString() {
    return `<@${this.id}>`;
  }

  toJSON(...props) {
    const json = super.toJSON(
      {
        createdTimestamp: true,
        defaultAvatarURL: true,
        tag: true
      },
      ...props,
    );
    json.avatarURL = this.avatarURL({ dynamic: true });
    json.displayAvatarURL = this.displayAvatarURL({ dynamic: true });
    json.bannerURL = this.bannerURL({ dynamic: true });
    return json;
  }

  // These are here only for documentation purposes - they are implemented by TextBasedChannel
  /* eslint-disable no-empty-function */
  send() {}
}

TextBasedChannel.applyToClass(User);

module.exports = User;
