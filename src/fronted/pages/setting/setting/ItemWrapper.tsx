export interface ItemWapperProps {
    children: React.ReactNode;
}
const ItemWrapper = ({ children }: ItemWapperProps) => {
    return (
        <div className="flex-1 flex flex-col flex-shrink-0 gap-8 h-0 overflow-y-auto scrollbar-thin scrollbar-thumb-rounded-full scrollbar-thumb-stone-200">
            {children}
        </div>
    );
};

export default ItemWrapper;
