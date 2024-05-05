import {cn} from "@/fronted/lib/utils";

const Background = ({ className }: { className?: string }) => {
    return <div className={cn('w-full h-full bg-stone-200')} />;
};

Background.defaultProps = {
    className: '',
};

export default Background;
