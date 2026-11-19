# Claude Slider

A Chrome extension that replaces the model dropdown on [claude.ai](https://claude.ai) with two always-visible sliders next to the composer: one for the model, one for reasoning effort.

- **Model slider**: Haiku → Sonnet → Opus → Fable (whatever your account's menu lists, least to most capable).
- **Effort slider**: Low → Medium → High → Extra → Max.
- **⋯ button**: opens the original menu, for "More models".

Changing the model in the original menu moves the sliders too.

## Install

1. Download or clone this repository.
2. Open `chrome://extensions` and turn on **Developer mode**.
3. Click **Load unpacked** and choose this folder.
4. Reload any open claude.ai tabs.

## How it works

The extension is one content script with no permissions beyond running on `claude.ai`. When you move a slider it opens the site's own model menu (kept invisible for that moment), clicks the matching item, and closes it. It calls no private API and sends no data anywhere.

The option lists are read from the menu itself and cached in the page's `localStorage`, so new models or effort levels show up without an update.

## Limits

- It depends on the page's DOM (`data-testid="model-selector-dropdown"` and ARIA menu roles). A redesign of claude.ai can break it.
- A model picked from "More models" is shown by name, but it has no stop on the slider.
