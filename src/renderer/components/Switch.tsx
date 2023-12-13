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
                'flex gap-2 rounded-lg hover:bg-gray-100 px-2 py-1 w-full text-base justify-start items-center h-10',
                className
            )}
        >
            {checked ? (
                <PiToggleRightLight
                    className={cn('text-green-500 w-8 h-8')}
                />
            ) : (
                <PiToggleLeftLight className="text-gray-500 w-8 h-8" />
            )}
            <div className={cn('flex flex-col justify-center'
                // checked ? 'text-green-500' : 'text-gray-500'
            )}>
                <span>{title}</span>
            </div>
            {/*{checked ? (*/}
            {/*    <PiToggleRightLight*/}
            {/*        className={cn('text-green-500 w-8 h-8')}*/}
            {/*    />*/}
            {/*) : (*/}
            {/*    <PiToggleLeftLight className="text-gray-500 w-8 h-8" />*/}
            {/*)}*/}
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
