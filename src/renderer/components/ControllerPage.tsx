import { twMerge } from 'tailwind-merge';

const ControllerPage = () => {
    return (
        <div
            className={twMerge(
                'fixed left-0 top-0 flex items-center justify-center z-50 w-full h-full bg-black/50'
            )}
        >
            <div
                onClick={(e) => {
                    e.stopPropagation();
                }}
                className={twMerge(
                    'flex items-center justify-center w-[300px] h-[300px] bg-white rounded-lg'
                )}
            />
        </div>
    );
};

export default ControllerPage;
