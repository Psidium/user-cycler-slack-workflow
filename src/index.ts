import { slack } from "./slack";

// The function that AWS Lambda will call
/**
 * Default Lambda Handler
 *
 * @param {Object} event - The Lambda event
 * @param {Object} context - The Lambda context
 * @param {Function} callback - The Lambda callback
 */
exports.handler = function (event, context) {
  switch (event.httpMethod) {
    case "GET":
      console.info(`Received a AUTH`);
      return slack.oauth(event, context);
    case "POST":
      console.info(`Received a POST`);
      return slack.event(event, context);
    default:
      console.info("Unsupported call");
      throw new Error("Unsupported call");
  }
};

slack.on("shortcut", async ({ msg, bot }) => {
  switch (msg.callback_id) {
    case "create_list_in_channel":
      console.info("creating list in channel received");
      const ret = await bot.send("views.open", {
        trigger_id: msg.trigger_id,
        view: {
          type: "modal",
          title: {
            type: "plain_text",
            text: "Create list",
            emoji: true,
          },
          submit: {
            type: "plain_text",
            text: "Submit",
            emoji: true,
          },
          close: {
            type: "plain_text",
            text: "Cancel",
            emoji: true,
          },
          blocks: [
            {
              type: "input",
              block_id: "cycleUsers",
              element: {
                action_id: "list",
                type: "multi_users_select",
                placeholder: {
                  type: "plain_text",
                  text: "Select users",
                  emoji: true,
                },
              },
              label: {
                type: "plain_text",
                text: "Select the users that can be cycled from:",
                emoji: true,
              },
            },
          ],
        },
      });
      console.info(`Returned from call ${ret}`);
      break;
  }
});

slack.on("workflow_step_execute", async ({ msg, bot }) => {
  console.log("received from workflow_step_execute");
  const { workflow_step } = msg.event;
  const id = msg.team_id;
  try {
    const stored = (await slack.store.get(id)) || {};
    const usersObject = stored?.workflows?.[workflow_step.workflow_id] || {};
    usersObject.currentIndex =
      (usersObject.currentIndex + 1) % usersObject.users.length;
    const selectedUser = usersObject.users[usersObject.currentIndex];
    await bot.send("workflows.stepCompleted", {
      workflow_step_execute_id: workflow_step.workflow_step_execute_id,
      outputs: {
        assigned_user: selectedUser,
      },
    });
    await slack.store.save(stored);
  } catch (e) {}
});

slack.on("workflow_step_edit", async ({ msg, bot }) => {
  console.log("we are in workflow_step_edit, sending views.open");
  console.log(`In edit we received ${JSON.stringify(msg)}`);
  const { workflow_step } = msg;
  workflow_step.workflow_id;
  // TODO: mandar os usuarios já selecionados nesse workflow
  switch (msg.callback_id) {
    case "select_one_from_list":
      console.log("answering select n from list ");
      const { id } = msg.team;
      const stored = (await slack.store.get(id)) || {};
      const users = stored?.workflows?.[workflow_step.workflow_id]?.users || [];
      await bot.send("views.open", {
        trigger_id: msg.trigger_id,
        view: {
          type: "workflow_step",
          blocks: [
            {
              type: "input",
              block_id: "cycleUsers",
              element: {
                action_id: "list",
                type: "multi_users_select",
                placeholder: {
                  type: "plain_text",
                  text: "Select users",
                  emoji: true,
                },
                initial_users: users,
              },
              label: {
                type: "plain_text",
                text: "Select the users that can be cycled from:",
                emoji: true,
              },
            },
          ],
        },
      });
      console.log("answered already");
      break;
  }
});

slack.on("view_submission", async ({ msg, bot, setResponse }) => {
  console.log(`received  from view_submission ${JSON.stringify(msg)}`);
  if (msg.view.type === "workflow_step") {
    const { workflow_step } = msg;
    const workflowId = workflow_step.workflow_id;
    const selectedUsers = msg.view.state.values.cycleUsers.list.selected_users;
    const id = msg.team.id;
    const stored = (await slack.store.get(id)) || {};
    stored.workflows = stored.workflows || {};
    stored.workflows[workflowId] = {
      users: selectedUsers,
      currentIndex:
        stored.workflows?.[workflowId]?.currentIndex ||
        selectedUsers.length - 1,
    };
    await slack.store.save(stored);
    await bot.send("workflows.updateStep", {
      trigger: msg.trigger_id,
      workflow_step_edit_id: workflow_step.workflow_step_edit_id,
      outputs: [
        {
          name: "assigned_user",
          type: "user",
          label: "The user assigned in the list",
        },
      ],
    });
  }
});
