import { cn } from '../../../common/utils/Util';

export interface ButtonProps {
    handleSubmit: () => void;
    disabled?: boolean;
    kind?: 'primary' | 'secondary';
    text?: string;
}

const SettingButton = ({ handleSubmit, disabled, kind, text }: ButtonProps) => {
    //inline-flex items-center justify-center whitespace-nowrap rounded-md text-sm font-medium transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring disabled:pointer-events-none disabled:opacity-50 bg-primary text-primary-foreground shadow hover:bg-primary/90 h-9 px-4 py-2
    return (
        <button
            className={cn('text-white py-2 px-4 rounded h-fit w-fit text-sm border-2 border-black',
                kind === 'primary' && 'bg-black hover:bg-black/90 hover:border-black/90 disabled:bg-black/80 disabled:border-black/80',
                kind === 'secondary' && 'text-black bg-white  hover:border-black/90 disabled:border-black/80'
            )}
            onClick={handleSubmit}
            disabled={disabled}
            type='button'
        >
            {text}
        </button>
    );
};

SettingButton.defaultProps = {
    disabled: false,
    kind: 'primary',
    text: 'Apply'
};

export default SettingButton;
