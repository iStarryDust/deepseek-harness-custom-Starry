# Edit a message and regenerate

English | [中文](message-edit.zh.md)

Every user message in a conversation offers an **edit** action next to copy and branch. Editing rewrites the prompt and regenerates the conversation from that point; the turns that followed the original message are not kept.

## Edit a sent message

1. Hover a sent user message and choose the pencil action. Editing is unavailable while the agent is running a turn.
2. The inline editor opens with the original text focused. A strip below it shows the images the message carries.
3. Change the text. Remove an image with the **×** on its thumbnail; add images with **＋** or by dropping files onto the strip (png, jpeg, webp, and gif are accepted).
4. Choose **Regenerate**, or press <kbd>Ctrl</kbd>+<kbd>Enter</kbd> (<kbd>Cmd</kbd>+<kbd>Enter</kbd> on macOS). Press <kbd>Esc</kbd> or choose **Cancel** to discard the edit.

## What happens on resend

The conversation **forks at the edited message**: the harness creates a branched session that replays every turn before the edited message, sends the edited prompt in place of the original, and opens the branch. The turns after the edited message are not carried over.

- The original session is preserved in the sidebar, and the branch appears as a new session. Neither is removed automatically; remove branch sessions that are no longer needed manually.
- The branch inherits the model of the original session, so resending a message with images does not fall back to a text-only default model.
- Images kept from the original message are reused as-is; newly added images go through the same upload pipeline as the composer.

## If the resend fails

The view stays on the current session, and the editor reopens with the entered text and a failure notice. The leftover empty branch is removed automatically.

## Limits

- Only user messages can be edited; assistant replies offer copy and branch only.
- Editing is unavailable while the agent is running a turn, and for user messages whose turn is no longer in the loaded window after context compaction.
- The original session keeps its full transcript; the append-only record is never rewritten.
