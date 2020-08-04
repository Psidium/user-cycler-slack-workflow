import axios from 'axios';
import * as qs from "querystring";

export default class Client {
  payload: any;
  auth: any;
  api: any;

  /**
   * Constructor
   *
   * @param {object} auth - The team's oauth info
   * @param {object} payload - The message payload to use for context
   */
  constructor(auth?: any, payload?: any) {
    this.payload = payload || {};
    this.auth = auth || {};

    this.api = axios.create({
      baseURL: 'https://slack.com/api'
    });
  }


  /**
   * Response Url
   * 
   * @return {String} the payload's response url
   */
  get response_url() {
    if (this.payload) return this.payload.response_url;
  }


  /**
   * Channel
   *
   * @return {String} the payload's channel
   */
  get channel() {
    let payload = this.payload, event = payload.event, auth = this.auth;
    // Slash Commands
    if (payload.channel_id) return payload.channel_id;
    
    // Interactive Messages
    else if (payload.channel) return payload.channel.id;
    
    // Events API
    else if (event && event.channel) return event.channel;
    else if (event && event.item) return event.item.channel;
  }


  /**
   * API Token
   * 
   * @return {String} the team's API token
   */
  get token() {
    let auth = this.auth, bot = auth.bot;
    return auth.bot ? auth.bot.bot_access_token : auth.access_token;
  }


  /**
   * Send Reply
   *
   * @param {object} message - The message to reply with
   * @param {boolean} ephemeral - Flag to make the message ephemeral
   * @return {Promise} A promise with the API response
   */
  reply(message, ephemeral) {
    // invalid ephemeral requests
    if (!this.response_url && ephemeral) {
      return Promise.reject("Message can't be private");
    
    // slash commands and interactive messages
    } else if (this.response_url) {
      if (!ephemeral) message.response_type = 'in_channel';
      return this.send(this.response_url, message);
    
    // incoming webhooks
    } else if (this.auth.incoming_webhook && !this.channel && !message.channel) {
      return this.send(this.auth.incoming_webhook.url, message);
    
    // fallback
    } else {
      return this.say(message);
    }
  }


  /**
   * Send Private Reply
   *
   * @param {object} message - The message to reply with
   * @return {Promise} A promise with the API response
   */
  replyPrivate(message) {
    return this.reply(message, true);
  }


  /**
   * Send Message
   *
   * @param {object} message - The message to post
   * @return {Promise} A promise with the API result
   */
  say(message) {
    return this.send('chat.postMessage', message);
  }


  /**
   * Send data to Slack's API
   *
   * @param {string} endPoint - The method name or url (optional - defaults to chat.postMessage)
   * @param {object} data - The JSON payload to send
   * @return {Promise} A promise with the API response
   */
  async send(endPoint, message) {
    console.log("sending message back")
    // convert the string message to a message object
    if (typeof(message) === 'string') message = { text: message };

    // set defaults when available
    message = Object.assign({ token: this.token, channel: this.channel }, message);

    console.log(`writing post ${endPoint} and auth ${this.token} with arg ${JSON.stringify(message)} `)
    //console.log(`Posting to ${endPoint} with ${JSON.stringify(message)}`);
    // convert json except when passing in a url
    // if (!endPoint.match(/^http/i)) message = qs.stringify(message);
    //console.log(`Posting to ${endPoint} with ${message}`);
    const response = await this.api.post(endPoint, message, {
      headers: {
        "content-type": "application/json",
        authorization: `Bearer ${this.token}`,
      },
    });
    console.log(`Received ${JSON.stringify(response.data)} from slack`)
    return this.getData(response);
  }


  /**
   * OK Check for Responses
   *
   * @param {object} response - The API response to check
   * @return {Promise} A promise with the API response
   */
  async getData({ data }) {
    if (data.ok) {
      delete data.ok;
      return data;
    } else {
      throw data.error;
    }
  }


  /**
   * OAuth Authorization Url
   * 
   * @param {object} args - Arguments for the url
   * @return {String} The payload's response url
   */
  getAuthUrl(args) {
    args = Object.assign({}, args, {
      scope: process.env.CLIENT_SCOPES,
      client_id: process.env.CLIENT_ID
    });

    // sends a 301 redirect
    return 'https://slack.com/oauth/authorize?' + qs.stringify(args);
  }


  /**
   * OAuth Access
   * 
   * @param {object} args - Arguments for oauth access
   * @return {Promise} A promise with the API response
   */
  getToken(args) {
    return this.send('oauth.access', { 
      code: args.code,
      state: args.state, 
      client_id: process.env.CLIENT_ID, 
      client_secret: process.env.CLIENT_SECRET 
    });
  }


  /**
   * OAuth Test
   * 
   * @param {object} auth - The team's access data
   * @return {Promise} A promise with the updated team access data
   */
  async updateTeamUrl(auth) {
    const data = await this.send('auth.test', { token: auth.access_token });
    auth.url = data.url;
    return auth;
  }


  /**
   * OAuth Install
   * 
   * @param {object} payload - The install request
   * @return {Promise} A promise with the team access data
   */
  async install(payload) {
    const auth = await this.getToken(payload);
    return this.updateTeamUrl(auth)
  }
}