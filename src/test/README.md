# Testing in DashPlayer

This project uses Vitest for testing with React Testing Library for frontend component tests.

## Running Tests

```bash
# Run all tests
yarn test

# Run tests in watch mode
yarn test:watch

# Run tests once
yarn test:run

# Run tests with UI
yarn test:ui

# Run tests with coverage (when coverage package is installed)
yarn test:coverage
```

## Test Structure

- **Frontend Tests**: Located in `src/fronted/components/__tests__/`
- **Backend Tests**: Located in `src/backend/services/__tests__/`
- **Test Setup**: Configuration in `src/test/setup.ts`

## Writing Tests

### Frontend Component Tests

Use React Testing Library for component testing:

```typescript
import { render, screen, fireEvent } from '@testing-library/react'
import { describe, it, expect, vi } from 'vitest'
import MyComponent from '../MyComponent'

describe('MyComponent', () => {
  it('renders correctly', () => {
    render(<MyComponent title="Test" />)
    expect(screen.getByText('Test')).toBeInTheDocument()
  })
})
```

### Backend Service Tests

Mock dependencies and test business logic:

```typescript
import { describe, it, expect, vi } from 'vitest'

// Mock external dependencies
vi.mock('@/backend/db', () => ({
  default: { /* mock implementation */ }
}))

describe('MyService', () => {
  it('handles business logic correctly', async () => {
    // Test implementation
  })
})
```

## Configuration

- **Vitest Config**: `vitest.config.ts`
- **Test Setup**: `src/test/setup.ts` - includes mocks for Electron APIs and testing utilities