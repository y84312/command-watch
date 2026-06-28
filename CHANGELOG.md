# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

### Added
- Architecture documentation in README with module breakdown and game loop description
- Screenshots directory for documentation assets
- CHANGELOG.md

### Changed
- Rewrote README with improved structure: description, controls table, building/unit reference, architecture section, testing instructions

## [0.1.0] - 2026-01-01

### Added
- Real-time strategy game engine with canvas rendering
- Building system: Command Center, Power Plant, Ore Refinery, Barracks, War Factory, Defense Turret
- Unit system: Harvesters, Infantry, Light Tanks with distinct behaviors and stats
- Resource harvesting mechanics (ore collection → refinery → credits)
- AI opponent with strategic state machine and tactical decision-making
- Fog of War system with grid-based visibility tracking
- Camera panning via edge-scrolling
- Unit selection (click and drag selection box)
- Build queue with progress tracking
- Audio system for sound effects
- React HUD overlay showing credits, power, and build menu
- Docker support for containerized deployment
- GitHub Actions CI/CD: automated testing, Docker builds, and GitHub Pages deployment
- Live demo hosted on GitHub Pages
- Unit and integration tests with Vitest
- TypeScript strict mode throughout the codebase
