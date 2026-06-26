# Contributing to Command Watch

Thank you for your interest in contributing! This document provides guidelines for setting up the project and submitting contributions.

## Development Setup

### Prerequisites

- Node.js 18+
- npm 9+

### Installation

```bash
git clone https://github.com/stennu718/command-watch.git
cd command-watch
npm install
```

### Running the Development Server

```bash
npm run dev
```

The app will be available at `http://localhost:3000`.

### Running Tests

```bash
# Run all tests
npm test

# Run tests in watch mode
npm run test:watch
```

### Linting

```bash
npm run lint
```

## How to Contribute

1. **Fork** the repository on GitHub
2. **Clone** your fork locally
3. **Create a branch** for your feature or fix:
   ```bash
   git checkout -b feature/your-feature-name
   ```
4. **Make your changes** and ensure tests pass
5. **Commit** with a clear, descriptive message
6. **Push** to your fork:
   ```bash
   git push origin feature/your-feature-name
   ```
7. **Open a Pull Request** against the `master` branch

### Pull Request Guidelines

- Keep PRs focused on a single feature or fix
- Ensure all tests pass before submitting
- Update documentation if your changes affect public APIs or behavior
- Write a clear PR description explaining the "what" and "why"

## Code Style

- **Language:** TypeScript (strict mode enabled)
- **Formatting:** Consistent with the existing codebase style
- **Naming:** Use descriptive variable and function names in English
- **Comments:** Add comments for complex logic; avoid stating the obvious
- **Components:** Keep React components small and focused on a single responsibility
- **Testing:** Write tests for new features and bug fixes

## License

By contributing to this project, you agree that your contributions will be licensed under the MIT License.
