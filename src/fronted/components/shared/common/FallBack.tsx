import React from 'react';

const FallBack = () => {
    return (
        <div className="flex items-center justify-center">
            <div className="bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded relative" role="alert">
                <strong className="font-bold">Oh no! </strong>
                <span className="block sm:inline">Something went wrong.</span>
            </div>
        </div>
    );
};

export default FallBack;
