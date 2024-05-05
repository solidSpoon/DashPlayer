import usePlayerToaster from '../hooks/usePlayerToaster';

const Notification = () => {
    const text = usePlayerToaster((state) => state.text);
    const type = usePlayerToaster((state) => state.type);

    return (
        <>
            {type !== 'none' ? (
                <div className="fixed top-0 left-0 flex w-full h-full  items-center justify-center pointer-events-none z-50">
                    <div
                        className={`text-lg bg-stone-200/70 border-[0.5px] border-stone-400 rounded-lg w-40 py-4 px-6 flex items-centr justify-center mt-4 backdrop-blur
                        ${type === 'info' ? 'text-stone-600' : 'text-red-500'}
                    `}
                    >
                        {text}
                    </div>
                </div>
            ) : (
                <></>
            )}
        </>
    );
};
export default Notification;
