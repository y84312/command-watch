# Command Watch

A real-time strategy game you play in your browser.
Build a base, gather resources, train units, and destroy your enemy.

**For**: Fans of Command & Conquer and classic RTS games.

## Play now
Just open [the demo](https://stennu718.github.io/command-watch/) — no install needed.

## How to play
- **Select** units by clicking them
- **Move** by clicking on the map
- **Build** structures from the bottom panel
- **Gather** resources to train more units
- **Destroy** the enemy Command Center to win

## Features
- Fast-paced real-time gameplay
- Multiple unit types (soldiers, vehicles, builders)
- Fog of war — explore the map to reveal enemies
- AI opponent with multiple difficulty levels
- Works offline after first load

## Screenshot
![Gameplay](screenshots/gameplay.png)

## Technical Highlights

- **Stack**: TypeScript + React + Vite
- **Rendering**: HTML5 Canvas with requestAnimationFrame
- **AI**: State machine-based AI with Easy/Normal/Hard difficulty levels
- **Testing**: 142 tests (unit + integration)
- **Performance**: Object pooling, viewport culling, 60fps target
- **Offline**: Works completely offline after first load

## Architecture

```
src/
  game/
    Engine.ts     # Game loop, entity management, rendering
    AI.ts         # AI opponent logic and decision trees
    saveLoad.ts   # LocalStorage-based save system
    replay.ts     # Game recording and playback
    config.ts     # Game balance configuration
    keyboard.ts    # Keyboard shortcuts and input handling
    touch.ts      # Mobile touch controls
    performance.ts # FPS monitoring and profiling
  App.tsx         # Main React component
```

## License
MIT
