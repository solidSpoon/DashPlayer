import { ReactElement } from 'react';

export interface HeaderProps {
    title: string;
    description?: string | undefined | ReactElement;
}

const Header = ({ title, description }: HeaderProps) => {
    return (
        <div className="pl-6">
            <h1 className="text-lg font-bold">{title}</h1>
            {description && (
                <text className="text-sm text-gray-600">{description}</text>
            )}
        </div>
    );
};

Header.defaultProps = {
    description: undefined,
};

export default Header;
