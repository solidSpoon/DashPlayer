export interface ThemePreviewParam {
    className: string;
}
const themePreview = ({ className }: ThemePreviewParam) => {
    return (
        <div className={`${className} flex bg-background`}>
            <div className="flex-1 flex flex-col">
                <div className="flex-1 bg-gradient-to-br from-indigo-500/50 via-purple-500/50 to-pink-500/50" />
                <div className="h-1 bg-gutterBackground" />
                <div className="h-1/3 pt-1 px-2">
                    <div className="w-full h-4 rounded bg-sentenceBackground" />
                </div>
            </div>
            <div className="w-1 bg-gutterBackground" />
            <div className="w-1/3 flex flex-col gap-1 overflow-y-hidden px-1">
                {[...Array(10)].map((_, i) => (
                    <div className="flex-shrink-0 rounded h-4 bg-sentenceBackground" />
                ))}
            </div>
        </div>
    );
};

export default themePreview;
