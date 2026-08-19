// Start command for the Workflow service. Importing tasks.ts registers every
// task with the SDK; the task server then starts itself automatically
// because Render sets RENDER_SDK_SOCKET_PATH in the workflow runtime -- see
// the @renderinc/sdk README's "Task Definition" section.
import "dotenv/config";
import "./tasks";
