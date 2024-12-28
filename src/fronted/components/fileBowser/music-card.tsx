import { cn } from '@/fronted/lib/utils';
import { Music } from 'lucide-react';
import React from 'react';

// 预定义一些渐变色组合
const gradientCombinations = [
    ['#ea580c', '#fb923c', '#fed7aa'], // 橙色系
    ['#2563eb', '#60a5fa', '#bfdbfe'], // 蓝色系
    ['#16a34a', '#4ade80', '#bbf7d0'], // 绿色系
    ['#9333ea', '#a855f7', '#e9d5ff'], // 紫色系
    ['#dc2626', '#ef4444', '#fca5a5'], // 红色系
    ['#0d9488', '#2dd4bf', '#99f6e4'], // 青色系
    ['#db2777', '#ec4899', '#fbcfe8'], // 粉色系
    ['#854d0e', '#ca8a04', '#fef08a'], // 黄色系
];

interface MusicCardProps {
    fileName: string;
}

const MusicCard: React.FC<MusicCardProps> = ({ fileName }) => {
    // 使用文件名生成一个简单的哈希值
    const hashCode = (str: string) => {
        let hash = 0;
        for (let i = 0; i < str.length; i++) {
            const char = str.charCodeAt(i);
            hash = ((hash << 5) - hash) + char;
            hash = hash & hash;
        }
        return Math.abs(hash);
    };

    // 基于文件名选择一个渐变色组合
    const colorIndex = hashCode(fileName) % gradientCombinations.length;
    const [from, via, to] = gradientCombinations[colorIndex];

    return (
        <div
            style={{
                aspectRatio: '16/9',
                background: `radial-gradient(ellipse at bottom, ${from}, ${via}, ${to})`
            }}
            className={cn(
                'w-full relative flex items-center justify-center',
                'transition-all duration-300',
            )}
        >
            <div className="absolute inset-0 bg-gradient-to-t from-background/30 to-transparent" />
            <Music className="w-12 h-12 text-primary-foreground drop-shadow-lg z-10" />
        </div>
    );
};

export default MusicCard;
