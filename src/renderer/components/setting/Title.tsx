import { ReactElement } from 'react';

export interface TieleProps {
    title: string;
}

const Tiele = ({ title }: TieleProps) => {
    return (
        <div className="pl-6">
            <h2 className="text-xl font-bold">{title}</h2>
        </div>
    );
};

export default Tiele;
