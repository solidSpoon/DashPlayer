export interface ItemWapperProps {
    children: React.ReactNode;
}
const ItemWrapper = ({ children }: ItemWapperProps) => {
    return (
        <div className="flex-1 flex flex-col pl-14 gap-5 h-0 overflow-y-auto scrollbar-none scrollbar-thumb-stone-400 scrollbar-thumb-rounded-sm">
            {children}
        </div>
    );
};

export default ItemWrapper;
