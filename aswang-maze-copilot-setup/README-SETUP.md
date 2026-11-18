# Copilot setup for Aswang Maze

Copy everything in this bundle into the ROOT of your repo (keep the `.github` folder as is).

- `.github/copilot-instructions.md`: always-on project rules
- `.github/skills/*/SKILL.md`: 6 specialist skills, loaded automatically by Copilot
- `.github/prompts/*.prompt.md`: slash commands for VS Code Copilot Chat (Agent mode)
- `Plan.md`: the build plan with checkboxes

## Slash commands (type in Copilot Chat)

| Command | Use |
|---|---|
| `/phase-0-setup` | Project setup |
| `/phase-1-backend` | DB, models, API |
| `/phase-2-raycaster` | 3D engine |
| `/phase-3-gameplay` | Keys, exit, timer, submit run |
| `/phase-4-aswang-ai` | Enemy AI |
| `/phase-5-ui` | jQuery + Bootstrap UI |
| `/phase-6-horror-polish` | Audio and scares |
| `/phase-7-levels-deploy` | Levels, tests, deploy |
| `/next-phase` | Auto-detect the active phase from Plan.md |
| `/confirm-tasks` | After you verify the work, ticks checkboxes and updates the log |

## Workflow
1. Run the phase prompt. 2. Build and test what Copilot gives you. 3. Run `/confirm-tasks`. 4. Commit. Repeat.

Note: prompt files work in VS Code only. Skills and `copilot-instructions.md` work in VS Code, Copilot CLI, and the coding agent. In the CLI, just paste the phase prompt text.
