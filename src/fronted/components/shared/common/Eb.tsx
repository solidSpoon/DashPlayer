import React from 'react';
import { ErrorBoundary } from 'react-error-boundary';
import FallBack from '@/fronted/components/shared/common/FallBack';

const Eb = ({children}:{
    children?: React.ReactNode
}) => {
    return (
        <ErrorBoundary FallbackComponent={FallBack}>
            {children}
        </ErrorBoundary>
    )
}
export default Eb;
