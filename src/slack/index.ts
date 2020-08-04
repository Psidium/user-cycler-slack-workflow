import Client from './client';
import Emittery = require('emittery');
import { dynamo, Dynamo } from "./dynamo";
import * as qs from 'querystring';


export class Slack extends Emittery {
  store: Dynamo;
  ignoreBots: boolean;
  
  constructor() {
    super();
    this.store = dynamo;
    this.ignoreBots = true; // ignore other bot message
  }


  /**
   * Default Lambda Handler
   *
   * @param {Object} event - The Lambda event
   * @param {Object} context - The Lambda context
   */
  handler(event, context) {     
    switch(event.method) {
      case "GET": this.oauth(event, context); break;
      case "POST": this.event(event, context); break;
    }
  }


  /**
   * OAuth Lambda Handler
   *
   * @param {Object} event - The Lambda event
   * @param {Object} context - The Lambda context
   */
  async oauth(event, context) {
    let client = new Client();
    let payload = event.queryStringParameters || {};
    let redirectUrl = `${process.env.INSTALL_REDIRECT}?state=${payload.state}`;
    if (payload.code) {
      try {
        const auth = await client.install(payload);
        this.store.save({ id: auth.team_id, ...auth });
        this.emit('*', payload);
        this.emit('install_success', payload);
        return {
          statusCode: 302,
          headers: {
            Location: redirectUrl,
            "Cache-Control": "'no-cache, no-store, must-revalidate'"
          },
          body: ""
        };
      } catch (e) {
        this.emit('*', { error: e, payload });
        this.emit('install_error', { error: e, payload });
        console.error("instal error");
        return {
          statusCode: 302,
          headers: {
            Location: `${redirectUrl}&error=${JSON.stringify(e)}`,
            "Cache-Control": "'no-cache, no-store, must-revalidate'"
          },
          body: ""
        };
      }
    } else { 
      const url = client.getAuthUrl(payload);
      console.info(`redirecting to ${url}`)
      return {
        statusCode: 302,
        headers: {
          Location: url,
          "Cache-Control": "'no-cache, no-store, must-revalidate'"
        },
        body: ""
      };
    }
  }


  /**
   * Event Lambda Handler
   *
   * @param {Object} event - The Lambda event
   * @param {Object} context - The Lambda context
   * @param {Function} callback - The Lambda callback
   */
  async event(event, context) {
    let payload: any = null, id: any = null;
    let token = process.env.VERIFICATION_TOKEN;
    if (event.headers["Content-Type"] === "application/json") {
      payload = JSON.parse(event.body);
      id = payload.team_id;
    } else {
      payload = qs.parse(event.body);
      id = payload.team_id;
      // Interactive Messages
      if (payload.payload) {
        payload = JSON.parse(payload.payload as string);
        id = payload.team.id;
      }
    }

    // Verification Token
    if (token && token !== payload.token) {
      console.error(`Error: received token ${payload.token}, but it is different fromm ${token}`)
      console.error(`received payload ${JSON.stringify(payload)}`)
      return context.fail("[401] Unauthorized");
    }
    // Events API challenge
    if (payload.challenge) {
      return payload.challenge;
    }

    // Ignore Bot Messages
    if (!this.ignoreBots || !(payload.event || payload).bot_id) {
      // Load Auth And Trigger Events
      console.log(`trying to get store id ${id}`)
      const auth = await this.store.get(id)
      const response = await this.notify(payload, auth);
      if (response) {
        console.log(`Returning ${JSON.stringify(response)}`)
        return response
      } else  {
        console.log("returning 200 OK");
        return {
          statusCode: 200
        }
      }
    }
  }


  /**
   * Notify message and process events
   * @param {Object} payload - The Lambda event
   * @param {Object} auth - The Slack authentication
   */
  async notify(payload, auth) {
    let events = ['*'];
    let bot = new Client(auth, payload);

    // notify incoming message by type
    if (payload.type) events.push(payload.type);

    // notify event triggered by event type
    if (payload.event) events.push('event', payload.event.type);

    // notify slash command by command
    if (payload.command) events.push('slash_command', payload.command);

    // notify webhook triggered by trigger word
    if (payload.trigger_word) events.push('webhook', payload.trigger_word);

    // notify message button triggered by callback_id
    if (payload.callback_id) events.push('interactive_message', payload.callback_id);
    let output = null;
    // trigger all events
    await Promise.all(
      events.map((name) =>
        this.emit(name, {
          msg: payload,
          bot,
          store: this.store,
          setResponse: (res: any) => (output = res),
        })
      )
    );
    return output;
  }

}

export const slack = new Slack();