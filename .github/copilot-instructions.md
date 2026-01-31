# Copilot Coding Agent Instructions

## MCP Servers

1. **Angular MCP**
   - Use the Angular MCP server for Angular-specific guidance and documentation
   - Query the Angular MCP for best practices on components, services, signals, and other Angular features
   - Consult Angular MCP when implementing new Angular features or resolving Angular-related issues

## Branch Management

1. **For any new task, always create a new branch**
   - Use descriptive branch names that reflect the task being worked on
   - Follow the naming convention: `feature/<task-description>` for features, `fix/<issue-description>` for bug fixes
   - Never commit directly to the `main` or `master` branch

## Code Quality

1. **Follow existing patterns and conventions**
   - Match the coding style already present in the codebase
   - Use consistent naming conventions (camelCase for variables/functions, PascalCase for classes/components)
   - Follow the project's file and folder structure

2. **Write clean, maintainable code**
   - Keep functions small and focused on a single responsibility
   - Use meaningful variable and function names
   - Avoid code duplication - extract reusable logic into shared utilities or services

3. **TypeScript best practices**
   - Use proper typing - avoid `any` type when possible
   - Define interfaces and types for data structures
   - Use strict null checks

## Testing

1. **Maintain test coverage**
   - Write unit tests for new functionality
   - Update existing tests when modifying code
   - Run tests before committing to ensure nothing is broken

2. **Test file conventions**
   - Place test files alongside the code they test with `.spec.ts` extension
   - Follow the existing test patterns in the project

## Angular-Specific Guidelines

1. **Component structure**
   - Keep components focused and reusable
   - Use standalone components
   - Separate template (`.html`), styles (`.scss`), and logic (`.ts`)

2. **State management**
   - Use the existing store patterns in `src/app/store/`
   - Keep state mutations predictable and traceable

3. **Services**
   - Use services for shared business logic and API calls
   - Follow the dependency injection patterns

## Documentation

1. **Code comments**
   - Add comments for complex logic
   - Document public APIs and interfaces
   - Keep comments up-to-date with code changes

2. **Commit messages**
   - Write clear, descriptive commit messages
   - Use conventional commit format: `type(scope): description`
   - Examples: `feat(play): add double down functionality`, `fix(dealer): correct hand calculation`

## Before Completing a Task

1. **Verify your changes**
   - Ensure the application builds without errors
   - Run the test suite
   - Test the feature manually if applicable

2. **Clean up**
   - Remove any debugging code or console logs
   - Remove unused imports and variables
   - Format code consistently
