import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { describe, expect, it, vi, beforeEach } from 'vitest';
import Playable from '@/fronted/components/shared/common/Playable';
import * as AudioPlayer from '@/fronted/infrastructure/audio/AudioPlayer';

vi.mock('@/fronted/infrastructure/audio/AudioPlayer', () => ({
    getTtsUrl: vi.fn().mockResolvedValue('http://mock-tts-url'),
    playAudioUrl: vi.fn().mockResolvedValue(undefined),
}));

describe('Playable Component', () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    it('renders text content with selection allowed', () => {
        render(<Playable>This is an example sentence.</Playable>);
        expect(screen.getByText('This is an example sentence.')).toBeInTheDocument();
    });

    it('plays audio on direct click when no text selection/drag happened', async () => {
        render(<Playable>Play this sentence</Playable>);
        const textElement = screen.getByText('Play this sentence');
        const container = textElement.parentElement!;

        fireEvent.mouseDown(container, { clientX: 100, clientY: 100 });
        fireEvent.mouseUp(container, { clientX: 101, clientY: 100 });

        await waitFor(() => {
            expect(AudioPlayer.getTtsUrl).toHaveBeenCalledWith('Play this sentence');
            expect(AudioPlayer.playAudioUrl).toHaveBeenCalledWith('http://mock-tts-url');
        });
    });

    it('does not play audio on drag selection', async () => {
        render(<Playable>Drag and select this sentence</Playable>);
        const textElement = screen.getByText('Drag and select this sentence');
        const container = textElement.parentElement!;

        // Simulate drag
        fireEvent.mouseDown(container, { clientX: 100, clientY: 100 });
        fireEvent.mouseUp(container, { clientX: 150, clientY: 100 });

        expect(AudioPlayer.getTtsUrl).not.toHaveBeenCalled();
        expect(AudioPlayer.playAudioUrl).not.toHaveBeenCalled();
    });

    it('plays audio when clicking the volume button', async () => {
        render(<Playable showIcon={true}>Click button to play</Playable>);
        const button = screen.getByTitle('朗读');

        fireEvent.click(button);

        await waitFor(() => {
            expect(AudioPlayer.getTtsUrl).toHaveBeenCalledWith('Click button to play');
            expect(AudioPlayer.playAudioUrl).toHaveBeenCalledWith('http://mock-tts-url');
        });
    });
});

