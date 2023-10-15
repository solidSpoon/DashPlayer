export interface ItemWapperProps {
    children: React.ReactNode;
}
const ItemWrapper = ({ children }: ItemWapperProps) => {
    return (
        <div className="flex-1 flex flex-col pl-14 gap-5 h-0 overflow-y-auto scrollbar-thin scrollbar-thumb-rounded-full scrollbar-thumb-stone-400">
            {children}
        </div>
    );
};

export default ItemWrapper;
