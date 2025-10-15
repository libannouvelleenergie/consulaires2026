/** @type {import('tailwindcss').Config} */
export default {
  // CRUCIAL : Indique à Tailwind où trouver vos classes React
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}", 
  ],
  theme: {
    extend: {
        fontFamily: {
            sans: ['Inter', 'sans-serif'],
        },
    },
  },
  plugins: [],
}
