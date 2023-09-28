const colors = require('tailwindcss/colors');

module.exports = {
    content: ['./src/renderer/**/*.{js,jsx,ts,tsx,ejs}'],
    darkMode: false, // or 'media' or 'class'
    theme: {
        extend: {
            colors: {
                sky: colors.sky,
                cyan: colors.cyan,
            },
        },
    },
    variants: {
        extend: {},
    },
    // eslint-disable-next-line global-require
    plugins: [require('tailwind-scrollbar')({ nocompatible: true })],
};
