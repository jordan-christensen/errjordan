// tailwind.config.js (in your project root)
import daisyui from 'daisyui'

export default {
  content: [
    './assets/js/**/*.js', 
    './lib/errjordan_web/**/*.{ex,heex,html}' 
  ],

  plugins: [
    require('@tailwindcss/forms'),
    daisyui,
  ],

  // Configure DaisyUI
  daisyui: {
    themes: ["walla-walla"], // Only list your custom light theme
    darkTheme: false,    // This formally opts-out of OS-level dark mode
  },
}