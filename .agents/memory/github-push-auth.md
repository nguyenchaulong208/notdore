---
name: GitHub push authentication
description: Recovery guidance for rejected Git pushes from this workspace.
---

For this workspace, an authorized-looking GitHub OAuth connection may still fail during a shell `git push` with an invalid-credentials error.

**Why:** Replit's connection reported healthy, but pushes were rejected; reconnect attempts could not be started from the integration card.

**How to apply:** Do not request or place a GitHub token in chat. Verify repository access from Replit's Git pane, and clearly distinguish a local commit from a pushed/deployed change.
