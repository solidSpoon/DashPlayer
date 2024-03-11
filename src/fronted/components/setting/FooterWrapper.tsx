export interface FooterWrapperProps {
    children: React.ReactNode;
}
const FooterWrapper = ({ children }: FooterWrapperProps) => {
    return (
        <div className="h-20 w-full flex items-center justify-end px-8 pb-4 gap-2">
            {children}
        </div>
    );
};

export default FooterWrapper;
