import { gsap } from 'gsap';
import { ScrollTrigger } from 'gsap/ScrollTrigger';

// Registered once, when this module is first loaded (with the landing page).
gsap.registerPlugin(ScrollTrigger);

export { gsap, ScrollTrigger };
