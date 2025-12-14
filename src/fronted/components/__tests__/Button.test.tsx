import React from 'react';
import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { Button } from '@/fronted/components/ui/button';

describe('Button Component', () => {
    it('renders children as label', () => {
        render(<Button>Test Button</Button>);
        expect(screen.getByRole('button', { name: 'Test Button' })).toBeInTheDocument();
    });

    it('supports title attribute', () => {
        render(<Button title="Tooltip Title">Click me</Button>);
        expect(screen.getByRole('button', { name: 'Click me' })).toHaveAttribute('title', 'Tooltip Title');
    });

    it('calls onClick when clicked', () => {
        const mockOnClick = vi.fn();
        render(<Button onClick={mockOnClick}>Click me</Button>);

        fireEvent.click(screen.getByRole('button', { name: 'Click me' }));
        expect(mockOnClick).toHaveBeenCalledOnce();
    });

    it('renders children correctly', () => {
        const TestIcon = () => <span data-testid="test-icon">Icon</span>;
        render(
            <Button>
                With Icon
                <TestIcon />
            </Button>,
        );

        expect(screen.getByRole('button', { name: /With Icon/ })).toBeInTheDocument();
        expect(screen.getByTestId('test-icon')).toBeInTheDocument();
    });

    it('applies custom className', () => {
        render(<Button className="custom-class">Styled Button</Button>);
        expect(screen.getByRole('button', { name: 'Styled Button' })).toHaveClass('custom-class');
    });

    it('handles multiple rapid clicks', () => {
        const mockOnClick = vi.fn();
        render(<Button onClick={mockOnClick}>Rapid Click</Button>);

        const button = screen.getByRole('button', { name: 'Rapid Click' });
        fireEvent.click(button);
        fireEvent.click(button);
        fireEvent.click(button);

        expect(mockOnClick).toHaveBeenCalledTimes(3);
    });
});
