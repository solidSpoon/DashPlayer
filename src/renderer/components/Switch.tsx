export interface SwitchParam {
    checked?: boolean;
    onChange?: (checked: boolean) => void;
    title?: string;
}
const Switch = ({ checked, onChange, title }: SwitchParam) => {
    return (
        <label
            className="relative inline-flex items-center cursor-pointer"
        >
            <input
                type="checkbox"
                value=""
                className="sr-only peer"
                checked={checked}
                onChange={(e) => {
                    onChange?.(e.target.checked);
                }}
            />
            <div className="w-11 h-6 bg-gray-200  dark:peer-focus:ring-blue-800 rounded-full peer dark:bg-gray-700 peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all dark:border-gray-600 peer-checked:bg-blue-600" />
            <span className="ml-3 text-sm font-medium text-gray-900 dark:text-gray-300">
                {title}
            </span>
        </label>
    );
};
Switch.defaultProps = {
    checked: false,
    onChange: (checked: boolean) => {},
    title: 'Toggle me',
};

export default Switch;
