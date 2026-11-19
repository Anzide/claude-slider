# Claude Slider

A Chrome extension that replaces the model dropdown on [claude.ai](https://claude.ai) with two always-visible sliders next to the composer: one for the model, one for reasoning effort. It works in chat and in Claude Code (`claude.ai/code`), including sessions that run on another computer.

<img src="docs/chat.png" alt="Model and effort sliders under the claude.ai composer" width="705">

In a Claude Code session:

<img src="docs/code.png" alt="Sliders and the UltraCode button under the Claude Code composer" width="784">

- **Model slider**: Haiku → Sonnet → Opus → Fable (whatever your account's menu lists, least to most capable).
- **Effort slider**: Low → Medium → High → Extra → Max. It keeps its level when you change the model; the site on its own remembers a separate level per model.
- **UltraCode button**: turns the Ultracode switch on or off. It appears only in Claude Code sessions whose Effort menu has that switch.
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

The option lists are read from the menu itself and cached in the page's `localStorage`, so new models or effort levels show up without an update. The first time you open a Claude Code session, the extension opens the menu once, invisibly, to see whether that session has Ultracode.

## Limits

- It depends on the page's DOM (the `data-testid` of the model button and ARIA menu roles). A redesign of claude.ai can break it.
- A model picked from "More models" is shown by name, but it has no stop on the slider.
