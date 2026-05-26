// Load fonts via @remotion/google-fonts.
// Inter for UI/body, Anton for display.
import { loadFont as loadInter } from '@remotion/google-fonts/Inter';
import { loadFont as loadAnton } from '@remotion/google-fonts/Anton';

const inter = loadInter('normal', {
  weights: ['400', '600', '700', '800', '900'],
  subsets: ['latin'],
});
const anton = loadAnton('normal', {
  weights: ['400'],
  subsets: ['latin'],
});

export const fontFamily = {
  inter: inter.fontFamily,
  anton: anton.fontFamily,
};

export const waitForFonts = () =>
  Promise.all([inter.waitUntilDone(), anton.waitUntilDone()]);
