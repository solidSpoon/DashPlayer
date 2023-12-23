import { motion } from 'framer-motion';
import { cn } from '../../../../common/utils/Util';

const About = () => {
    return (
        <div
            className='absolute inset-0 grid grid-cols-3 grid-rows-4 overflow-hidden p-10 pt-0 pl-2'
            style={{
                gridTemplateColumns: '30% 40% 30%',
                gridTemplateRows: '5% 20% 20% 55%', // 这里定义每行的大小
            }}
        >
            <div className={cn(
                'row-start-3 row-end-5 col-start-1 col-end-4',
                'bg-white rounded-lg overflow-hidden'
            )}>
                ff
            </div>
            <motion.div className={cn(
                'row-start-2 row-end-4 col-start-2 col-end-3',
                'bg-white rounded-3xl backdrop-blur overflow-hidden drop-shadow-2xl'
            )}
                initial={{
                    scale: 0.9,
                    y: 50,
            }}
                animate={{
                    scale: 1,
                    y: 0,
                }}
                exit={{ scale: 0 }}
                transition={{
                    type: 'tween',
                    duration: 0.2,
                }}
            >
                ff
            </motion.div>
        </div>
    );
};

export default About;
