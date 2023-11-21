import {
    PiToggleLeftLight,
    PiToggleRight,
    PiToggleRightLight,
} from 'react-icons/pi';
import { cn } from '../../utils/Util';

export interface SwitchParam {
    checked?: boolean;
    onChange?: (checked: boolean) => void;
    title?: string;
    className?: string;
}
const Switch = ({ checked, onChange, title, className }: SwitchParam) => {
    return (
        <div
            onClick={() => {
                onChange?.(!checked);
            }}
            className={cn(
                'flex gap-2 rounded-lg hover:bg-gray-100 p-2 w-full justify-between',
                className
            )}
        >
            <div className={cn('flex flex-col justify-center')}>
                <span>{title}</span>
            </div>
            {checked ? (
                <PiToggleRightLight
                    className={cn('text-green-500 w-10 h-10')}
                />
            ) : (
                <PiToggleLeftLight className="text-gray-500 w-10 h-10" />
            )}
        </div>
    );
};
Switch.defaultProps = {
    checked: false,
    onChange: (checked: boolean) => {},
    title: 'Toggle me',
    className: '',
};

export default Switch;
