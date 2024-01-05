import { cn } from '../../../common/utils/Util';
import Title from './Title';

export interface SettingInputProps {
    title: string;
    placeHolder?: string;
    value: string;
    setValue: (value: string) => void;
    type?: string;
    inputWidth?: string;
    description?: string;
}

const SettingInput = ({
    title,
    description,
    placeHolder,
    value,
    setValue,
    type,
    inputWidth,
}: SettingInputProps) => {
    return (
        <div className="text-gray-700 text-sm select-none pr-10">
            <Title title={title} />
            {/* <div className='text-sm text-left w-full'>{title} :</div> */}
            <input
                className={cn(
                    `appearance-none border h-10 px-3 text-gray-700  outline-2 outline-black w-full rounded-xl font-mono`
                )}
                type={type}
                placeholder={placeHolder}
                value={value || ''}
                onChange={(event) => setValue(event.target.value)}
            />
            <div className={cn('text-sm text-left w-full text-gray-500 mt-2')}>
                {description}
            </div>
        </div>
    );
};

SettingInput.defaultProps = {
    placeHolder: '',
    type: 'text',
    inputWidth: 'w-96',
    description: '',
};
export default SettingInput;
