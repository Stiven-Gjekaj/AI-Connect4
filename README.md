# AI Connect 4

A responsive, animated Connect 4 web game with an AI opponent using minimax + alpha-beta pruning. Pure HTML, CSS, and vanilla JavaScript — no frameworks, no build tools.

## Features

- Board: 7×6 grid. Player is red, AI is blue.
- Controls: New Game, Undo (reverts one player+AI pair), Hint.
- Toggle: Player first or AI first.
- Difficulty: Easy (depth 3), Medium (depth 5), Hard (depth 7).
- Status: turn indicator and AI search stats (depth and nodes searched).
- Input: click any column or press keys 1–7.
- Hint: highlights the best column for the player.
- End states: overlay with You win / AI wins / Draw; disables moves until restart.
- Theme: cartoony palette, glossy discs, board shadows, responsive layout.

## Technical Notes

- `game.js`: board state, rendering, click/keyboard handling, undo, win detection, and animation hooks.
- `ai.js`: minimax with alpha-beta pruning, move ordering (center-first), and heuristic evaluation.
- `utils.js`: small helpers (clone board, random choice, sleep).
- `style.css`: palette, layout, discs, ghosts, and animations.
- `logo.svg`: Connect 4 token (half red, half blue) with glossy highlight and rim. Used as favicon.

### Heuristic Details

Scored from the perspective of the “maximizing” token (AI when it’s thinking, player for hints):

- 4 token in a window: +∞ (win)
- 4 opponent in a window: −∞ (loss)
- 3 token + 1 empty: +120
- 3 opponent + 1 empty: −120
- 2 token + 2 empty: +15
- 2 opponent + 2 empty: −15
- +3 per token piece in the center column

Minimax stops at a fixed depth per difficulty and uses alpha-beta pruning. Move ordering prefers center columns first for better pruning.

### Accessibility

- Controls have ARIA labels.
- Status region uses `aria-live` for turn and AI updates.
- Keyboard input: number keys 1–7 drop a piece in that column.
