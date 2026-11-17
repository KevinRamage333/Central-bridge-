# Cletus AI Bridge

A local workspace for sending the same Cletus task to selected Grok, Claude, Gemini and OpenAI models and comparing the answers. The Grok Bot / Cursor button copies the task for the existing agent workflow.

## Run locally

1. Install Node.js 22 or later.
2. Copy `.env.example` to `.env`.
3. Set `AI_GATEWAY_API_KEY` and model IDs from the Vercel AI Gateway catalog for the providers you want to use. Leave unused models blank.
4. Run `npm start` and open http://127.0.0.1:3030.

Model credentials stay on the server. Each checked provider receives the task through Vercel AI Gateway and may consume API credits. Existing chat accounts, chats, and Cursor agents are separate from model API access. Paste only material you want to send to the selected providers. The server binds to loopback for local use.
