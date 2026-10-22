import { Plugin } from "@opencode/plugin"

/**
 * Server-side entrypoint of the "usage-remaining" plugin.
 *
 * The indicator itself lives in the terminal UI (see ./tui.tsx), but OpenCode
 * only loads a plugin's `tui` entrypoint when the package is registered on the
 * server, so this file keeps the package discoverable and active.
 */
export default Plugin.define({
  id: "usage-remaining",
  async setup() {},
})
