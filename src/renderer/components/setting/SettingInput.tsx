export interface SettingInputProps {
    title: string;
    placeHolder?: string;
    value: string;
    setValue: (value: string) => void;
    type?: string;
    inputWidth?: string;
}
const SettingInput = ({
    title,
    placeHolder,
    value,
    setValue,
    type,
    inputWidth,
}: SettingInputProps) => {
    return (
        <div className="flex items-center gap-4  text-gray-700 text-sm select-none">
            <div className="text-sm text-right w-28">{title} :</div>
            <input
                className={`appearance-none border h-6 rounded text-sm px-3 text-gray-700  focus:outline-none focus:shadow-outline ${inputWidth}`}
                type={type}
                placeholder={placeHolder}
                value={value || ''}
                onChange={(event) => setValue(event.target.value)}
            />
        </div>
    );
};

SettingInput.defaultProps = {
    placeHolder: '',
    type: 'text',
    inputWidth: 'w-44',
};
export default SettingInput;
