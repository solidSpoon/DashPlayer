import { render, screen, fireEvent } from '@testing-library/react'
import { describe, it, expect, vi } from 'vitest'
import {Button} from "@/fronted/components/ui/button";

describe('Button Component', () => {
  it('renders with title', () => {
    render(<Button title="Test Button" />)
    expect(screen.getByText('Test Button')).toBeInTheDocument()
  })

  it('calls onClick when clicked', () => {
    const mockOnClick = vi.fn()
    render(<Button title="Click me" onClick={mockOnClick} />)

    fireEvent.click(screen.getByText('Click me'))
    expect(mockOnClick).toHaveBeenCalledOnce()
  })

  it('renders children correctly', () => {
    const TestIcon = () => <span data-testid="test-icon">Icon</span>
    render(
      <Button title="With Icon">
        <TestIcon />
      </Button>
    )

    expect(screen.getByTestId('test-icon')).toBeInTheDocument()
    expect(screen.getByText('With Icon')).toBeInTheDocument()
  })

  it('applies custom className', () => {
    render(<Button title="Styled Button" className="custom-class" />)
    const buttonElement = screen.getByText('Styled Button').parentElement?.parentElement
    expect(buttonElement).toHaveClass('custom-class')
  })

  it('handles click state changes', () => {
    // Test that clicking triggers the onClick function
    const mockOnClick = vi.fn()
    render(<Button title="Click Test" onClick={mockOnClick} />)

    const button = screen.getByText('Click Test').parentElement?.parentElement
    if (button) {
      fireEvent.click(button)
    }

    expect(mockOnClick).toHaveBeenCalledOnce()
  })

  it('handles multiple rapid clicks', () => {
    const mockOnClick = vi.fn()
    render(<Button title="Rapid Click" onClick={mockOnClick} />)

    const button = screen.getByText('Rapid Click').parentElement?.parentElement

    if (button) {
      fireEvent.click(button)
      fireEvent.click(button)
      fireEvent.click(button)
    }

    expect(mockOnClick).toHaveBeenCalledTimes(3)
  })
})
