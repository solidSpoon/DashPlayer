import { clipboard } from 'electron';

const writeToClipboard = (text: string) => {
    clipboard.writeText(text);
};

const readFromClipboard = () => {
    return clipboard.readText();
};

export { writeToClipboard, readFromClipboard };
