import { useNavigate } from 'react-router-dom';

const WordManagement = () => {
    const navite = useNavigate();
    return (
        <div
            className="w-full h-full grid place-content-center text-8xl text-black"
        >
            WordManagement
        </div>
    );
};

export default WordManagement;
