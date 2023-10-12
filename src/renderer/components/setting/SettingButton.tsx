export interface ButtonProps {
    handleSubmit: () => void;
    disabled?: boolean;
    kind?: 'primary' | 'secondary';
    text?: string;
}
const SettingButton = ({ handleSubmit, disabled, kind, text }: ButtonProps) => {
    return (
        <button
            className={`text-white py-0.5 px-4 rounded h-fit w-fit text-sm
            ${kind === 'primary' && 'bg-settingButton'}
            ${kind === 'secondary' && 'bg-white'}
                        disabled:bg-settingButton/80 bg-settingButton hover:bg-settingButtonHover`}
            onClick={handleSubmit}
            disabled={disabled}
            type="button"
        >
            {text}
        </button>
    );
};

SettingButton.defaultProps = {
    disabled: false,
    kind: 'primary',
    text: 'Apply',
};

export default SettingButton;
