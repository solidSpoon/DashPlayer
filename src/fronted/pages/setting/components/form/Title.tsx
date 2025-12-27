import { ReactElement } from 'react';

export interface HeaderProps {
    title: string;
    description?: string | undefined | ReactElement;
}

const Title = ({ title, description }: HeaderProps) => {
    return (
        <div>
            <h1 className='text-lg font-bold mb-2'>{title}</h1>
            <text className='text-base text-gray-600'>{description}</text>
        </div>
    );
};

Title.defaultProps = {
    description: undefined
};

export default Title;
