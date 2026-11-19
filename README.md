# Claude Slider

A Chrome extension that replaces the model dropdown on [claude.ai](https://claude.ai) with two always-visible sliders next to the composer: one for the model, one for reasoning effort. It works in chat and in Claude Code (`claude.ai/code`).

- **Model slider**: Haiku → Sonnet → Opus → Fable (whatever your account's menu lists, least to most capable).
- **Effort slider**: Low → Medium → High → Extra → Max.
- **UltraCode button** (Claude Code only): adds or removes the word `ultracode` in the composer. Claude Code starts multi-agent orchestration when a prompt contains that word, which uses many more tokens. The word stays visible in your message, and you turn it on per message.
- **⋯ button**: opens the original menu, for "More models".

Drag a slider or click anywhere on its track. Arrow keys work when a slider has focus. Changing the model in the original menu moves the sliders too.

## Install

1. Download or clone this repository.
2. Open `chrome://extensions` and turn on **Developer mode**.
3. Click **Load unpacked** and choose this folder.
4. Reload any open claude.ai tabs.

After you pull an update, click the reload icon on the extension's card in `chrome://extensions`, then reload claude.ai.

## How it works

The extension is one content script with no permissions beyond running on `claude.ai`. When you move a slider it opens the site's own model menu (kept invisible for that moment), clicks the matching item, and closes it. It calls no private API and sends no data anywhere.

The option lists are read from the menu itself and cached in the page's `localStorage`, separately for chat and Claude Code, so new models or effort levels show up without an update.

## Limits

- It depends on the page's DOM (the `data-testid` of the model button and ARIA menu roles). A redesign of claude.ai can break it.
- A model picked from "More models" is shown by name, but it has no stop on the slider.
