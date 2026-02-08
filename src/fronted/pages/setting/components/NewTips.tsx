import * as React from 'react';
import {
    Carousel, CarouselApi,
    CarouselContent,
    CarouselItem,
    CarouselNext,
    CarouselPrevious
} from '@/fronted/components/ui/carousel';
import { Card, CardContent } from '@/fronted/components/ui/card';
import { useTranslation as useI18nTranslation } from 'react-i18next';

const NewTips = () => {
    const { t } = useI18nTranslation('settings');
    const tips = [
        t('checkUpdate.tips.transcriptionBackground'),
    ];
    const [api, setApi] = React.useState<CarouselApi>();
    const [current, setCurrent] = React.useState(0);
    const [count, setCount] = React.useState(0);

    React.useEffect(() => {
        if (!api) {
            return;
        }

        setCount(api.scrollSnapList().length);
        setCurrent(api.selectedScrollSnap() + 1);

        api.on('select', () => {
            setCurrent(api.selectedScrollSnap() + 1);
        });
    }, [api]);

    return (
        <div>
            <Carousel
                opts={{
                    loop: true,
                }}
                setApi={setApi} className="w-full max-w-xs">
                <CarouselContent>
                    {tips.map((content, index) => (
                        <CarouselItem key={index}>
                            <Card>
                                <CardContent className="flex aspect-square items-center justify-center p-6">
                                    {content}
                                </CardContent>
                            </Card>
                        </CarouselItem>
                    ))}
                </CarouselContent>
                <CarouselPrevious />
                <CarouselNext />
            </Carousel>
            <div className="py-2 text-center text-sm text-muted-foreground">
                {t('checkUpdate.tips.slideCounter', { current, count })}
            </div>
        </div>
    );
};

export default NewTips;
